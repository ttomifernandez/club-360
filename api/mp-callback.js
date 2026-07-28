// Vuelta de la autorización de Mercado Pago. Esta URL es la que se registra
// como "Redirect URI" en la aplicación de Mercado Pago Developers.
// Cambia el código temporal por las credenciales de la cuenta y las guarda.
const TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const ME_URL = "https://api.mercadopago.com/users/me";

function env() {
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
  return {
    supabaseUrl,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    clientId: process.env.MP_CLIENT_ID || "",
    clientSecret: process.env.MP_CLIENT_SECRET || "",
    redirectUri: process.env.MP_REDIRECT_URI || "",
    usePkce: (process.env.MP_PKCE || "").toLowerCase() === "true",
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

const back = (response, params) => {
  response.setHeader("location", `/admin?${new URLSearchParams(params)}`);
  return response.status(302).end();
};

export default async function handler(request, response) {
  const cfg = env();
  const { code, state, error: mpError } = request.query || {};

  if (mpError) return back(response, { mp: "error", detalle: "Autorización cancelada en Mercado Pago." });
  if (!code || !state) return back(response, { mp: "error", detalle: "Faltan datos en la respuesta de Mercado Pago." });
  if (!cfg.supabaseUrl || !cfg.serviceKey || !cfg.clientId || !cfg.clientSecret) {
    return back(response, { mp: "error", detalle: "Faltan variables de entorno del servidor." });
  }

  // El nonce debe existir y no tener más de una hora (da margen para que el
  // dueño autorice desde su celular con el link que le mandaron).
  const stateRes = await rest(cfg, `payment_oauth_state?state=eq.${encodeURIComponent(state)}&select=state,code_verifier,created_by,created_at`);
  const stateRows = stateRes.ok ? await stateRes.json() : [];
  const stateRow = stateRows[0];
  if (!stateRow) return back(response, { mp: "error", detalle: "La solicitud venció o no es válida. Probá de nuevo." });
  await rest(cfg, `payment_oauth_state?state=eq.${encodeURIComponent(state)}`, { method: "DELETE" });
  if (Date.now() - new Date(stateRow.created_at).getTime() > 60 * 60 * 1000) {
    return back(response, { mp: "error", detalle: "El link venció (dura una hora). Generá uno nuevo desde el panel." });
  }

  const redirectUri = cfg.redirectUri || `https://${request.headers.host}/api/mp-callback`;
  const body = {
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  };
  if (cfg.usePkce) body.code_verifier = stateRow.code_verifier;

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  const token = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !token.access_token) {
    return back(response, { mp: "error", detalle: token.message || token.error || "Mercado Pago rechazó la autorización." });
  }

  // Datos de la cuenta autorizada, para mostrar "Conectado como…".
  let account = {};
  const meRes = await fetch(ME_URL, { headers: { authorization: `Bearer ${token.access_token}` } });
  if (meRes.ok) account = await meRes.json().catch(() => ({}));

  const expiresAt = token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null;
  const save = await rest(cfg, "payment_credentials", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      provider: "mercadopago",
      mp_user_id: String(token.user_id || account.id || ""),
      nickname: account.nickname || null,
      email: account.email || null,
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      public_key: token.public_key || null,
      live_mode: token.live_mode ?? null,
      expires_at: expiresAt,
      connected_at: new Date().toISOString(),
      connected_by: stateRow.created_by,
      updated_at: new Date().toISOString(),
    }]),
  });
  if (!save.ok) return back(response, { mp: "error", detalle: "No se pudieron guardar las credenciales." });

  return back(response, { mp: "ok", cuenta: account.nickname || "" });
}
