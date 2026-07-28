// Renovación del acceso de Mercado Pago. Lo ejecuta el cron diario de Vercel.
// El acceso dura 180 días: lo renovamos cuando le quedan menos de 30 para que
// los cobros nunca se corten. Sin conexión activa, no hace nada.
export const REFRESH_MARGIN_DAYS = 30;

export async function refreshMercadoPago({ force = false } = {}) {
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const clientId = process.env.MP_CLIENT_ID || "";
  const clientSecret = process.env.MP_CLIENT_SECRET || "";
  if (!supabaseUrl || !serviceKey || !clientId || !clientSecret) return { skipped: "config" };

  const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" };
  const res = await fetch(`${supabaseUrl}/rest/v1/payment_credentials?provider=eq.mercadopago&select=refresh_token,expires_at`, { headers });
  const rows = res.ok ? await res.json() : [];
  const row = rows[0];
  if (!row || !row.refresh_token) return { skipped: "sin conexión" };

  const daysLeft = row.expires_at ? (new Date(row.expires_at) - Date.now()) / 86400000 : 0;
  if (!force && daysLeft > REFRESH_MARGIN_DAYS) return { skipped: "todavía vigente", daysLeft: Math.floor(daysLeft) };

  const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: row.refresh_token }),
  });
  const token = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !token.access_token) return { error: token.message || "Mercado Pago rechazó la renovación." };

  const patch = await fetch(`${supabaseUrl}/rest/v1/payment_credentials?provider=eq.mercadopago`, {
    method: "PATCH",
    headers: { ...headers, prefer: "return=minimal" },
    body: JSON.stringify({
      access_token: token.access_token,
      // Mercado Pago rota el token de refresco: hay que guardar el nuevo.
      refresh_token: token.refresh_token || row.refresh_token,
      public_key: token.public_key || null,
      expires_at: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!patch.ok) return { error: "No se pudo guardar el acceso renovado." };
  return { refreshed: true };
}

export default async function handler(request, response) {
  const secret = process.env.CRON_SECRET || "";
  const provided = (request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const fromVercelCron = String(request.headers["user-agent"] || "").includes("vercel-cron");
  if (secret ? provided !== secret : !fromVercelCron) {
    return response.status(401).json({ error: "No autorizado." });
  }
  const result = await refreshMercadoPago();
  return response.status(result.error ? 500 : 200).json(result);
}
