export default async function handler(request, response) {
  const rawUrl = process.env.SUPABASE_URL || "";
  const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  // La tienda necesita saber si puede ofrecer el pago online. Acá sale un
  // sí o no: las credenciales nunca salen del servidor.
  let payments = false;
  if (supabaseUrl && serviceKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/payment_credentials?provider=eq.mercadopago&select=provider`, {
        headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
      });
      payments = res.ok && (await res.json()).length > 0;
    } catch (error) {
      payments = false;
    }
  }

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    supabaseUrl,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    configured: Boolean(supabaseUrl && process.env.SUPABASE_ANON_KEY),
    payments,
  });
}
