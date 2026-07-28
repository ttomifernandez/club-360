// Conexión de la cuenta de Mercado Pago (OAuth). Solo el propietario.
// - status: si hay una cuenta conectada y hasta cuándo vale el acceso.
// - start: genera el link de autorización que el panel muestra como QR.
// - disconnect: borra las credenciales guardadas.
// Las credenciales viven en Supabase y nunca salen hacia el navegador.
import crypto from "node:crypto";
import { refreshMercadoPago } from "./mp-refresh.js";

const MP_AUTH_URL = "https://auth.mercadopago.com/authorization";

function env() {
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
  return {
    supabaseUrl,
    anonKey: process.env.SUPABASE_ANON_KEY || "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    clientId: process.env.MP_CLIENT_ID || "",
    redirectUri: process.env.MP_REDIRECT_URI || "",
    usePkce: (process.env.MP_PKCE || "").toLowerCase() === "true",
    // Emails habilitados a conectar o desconectar el cobro. Vive solo en
    // Vercel: nadie puede ampliarlo desde el panel. Vacío = cualquier owner.
    admins: (process.env.MP_ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean),
  };
}

function rest(cfg, path, options = {}) {
  return fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: cfg.serviceKey,
      authorization: `Bearer ${cfg.serviceKey}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
}

async function requireOwner(request, cfg) {
  const token = (request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Sesión requerida.", status: 401 };
  const userRes = await fetch(`${cfg.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: cfg.anonKey, authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return { error: "Sesión inválida o vencida.", status: 401 };
  const user = await userRes.json();
  const profRes = await rest(cfg, `profiles?id=eq.${user.id}&select=role,active`);
  const profiles = profRes.ok ? await profRes.json() : [];
  if (!profiles.length || profiles[0].role !== "owner" || !profiles[0].active) {
    return { error: "Solo el propietario puede configurar los cobros.", status: 403 };
  }
  const email = String(user.email || "").toLowerCase();
  return { user, canManage: !cfg.admins.length || cfg.admins.includes(email) };
}

export default async function handler(request, response) {
  const cfg = env();
  if (!cfg.supabaseUrl || !cfg.serviceKey) {
    return response.status(500).json({ error: "Faltan variables de entorno de Supabase." });
  }
  const auth = await requireOwner(request, cfg);
  if (auth.error) return response.status(auth.status).json({ error: auth.error });

  const action = request.method === "GET" ? "status" : (request.body || {}).action;
  const redirectUri = cfg.redirectUri || `https://${request.headers.host}/api/mp-callback`;

  if (action === "status") {
    // Además del cron diario, aprovechamos esta visita para renovar si hace falta.
    await refreshMercadoPago().catch(() => {});
    const [res, setRes] = await Promise.all([
      rest(cfg, "payment_credentials?provider=eq.mercadopago&select=nickname,email,mp_user_id,live_mode,expires_at,connected_at"),
      rest(cfg, "payment_settings?provider=eq.mercadopago&select=*"),
    ]);
    const rows = res.ok ? await res.json() : [];
    const row = rows[0] || null;
    const settings = (setRes.ok ? await setRes.json() : [])[0] || null;
    return response.status(200).json({
      configured: Boolean(cfg.clientId && process.env.MP_CLIENT_SECRET),
      canManage: auth.canManage,
      redirectUri,
      settings: settings && {
        maxInstallments: settings.max_installments,
        acceptCash: settings.accept_cash,
        acceptCredit: settings.accept_credit,
        acceptDebit: settings.accept_debit,
        binaryMode: settings.binary_mode,
      },
      connected: Boolean(row),
      account: row && {
        nickname: row.nickname,
        email: row.email,
        userId: row.mp_user_id,
        liveMode: row.live_mode,
        expiresAt: row.expires_at,
        connectedAt: row.connected_at,
        daysLeft: row.expires_at ? Math.floor((new Date(row.expires_at) - Date.now()) / 86400000) : null,
      },
    });
  }

  // Conectar y desconectar quedan reservados a los emails habilitados.
  if ((action === "start" || action === "disconnect") && !auth.canManage) {
    return response.status(403).json({ error: "Tu usuario no está habilitado para cambiar la configuración de cobros." });
  }

  if (action === "start") {
    if (!cfg.clientId || !process.env.MP_CLIENT_SECRET) {
      return response.status(400).json({ error: "Faltan MP_CLIENT_ID y MP_CLIENT_SECRET en las variables de entorno." });
    }
    // Limpieza de intentos abandonados.
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await rest(cfg, `payment_oauth_state?created_at=lt.${cutoff}`, { method: "DELETE" });

    const state = crypto.randomBytes(24).toString("hex");
    const verifier = crypto.randomBytes(32).toString("base64url");
    const insert = await rest(cfg, "payment_oauth_state", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify([{ state, code_verifier: verifier, created_by: auth.user.id }]),
    });
    if (!insert.ok) return response.status(500).json({ error: "No se pudo iniciar la conexión." });

    const params = new URLSearchParams({
      client_id: cfg.clientId,
      response_type: "code",
      platform_id: "mp",
      state,
      redirect_uri: redirectUri,
    });
    if (cfg.usePkce) {
      params.set("code_challenge", crypto.createHash("sha256").update(verifier).digest("base64url"));
      params.set("code_challenge_method", "S256");
    }
    return response.status(200).json({ url: `${MP_AUTH_URL}?${params}` });
  }

  if (action === "save-settings") {
    const s = request.body || {};
    const row = {
      provider: "mercadopago",
      max_installments: Math.min(24, Math.max(1, Number(s.maxInstallments) || 6)),
      accept_cash: Boolean(s.acceptCash),
      accept_credit: s.acceptCredit !== false,
      accept_debit: s.acceptDebit !== false,
      binary_mode: s.binaryMode !== false,
      updated_at: new Date().toISOString(),
    };
    const res = await rest(cfg, "payment_settings", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([row]),
    });
    if (!res.ok) return response.status(500).json({ error: "No se pudieron guardar las opciones." });
    return response.status(200).json({ ok: true });
  }

  if (action === "disconnect") {
    const res = await rest(cfg, "payment_credentials?provider=eq.mercadopago", { method: "DELETE" });
    if (!res.ok) return response.status(500).json({ error: "No se pudo desconectar." });
    return response.status(200).json({ ok: true });
  }

  return response.status(400).json({ error: "Acción desconocida." });
}
