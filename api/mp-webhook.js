// Aviso de Mercado Pago cuando cambia un pago. No confiamos en el contenido
// del aviso: solo tomamos el id y consultamos el pago a Mercado Pago con
// nuestro token, que es la única fuente válida.
function env() {
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
  return { supabaseUrl, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "" };
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

// Mercado Pago manda el pago de varias formas según la versión del aviso.
function paymentIdFrom(request) {
  const query = request.query || {};
  const body = request.body || {};
  const topic = query.topic || query.type || body.type || body.topic;
  if (topic && !String(topic).includes("payment")) return null;
  return String(query["data.id"] || query.id || body?.data?.id || body?.id || "").trim() || null;
}

export default async function handler(request, response) {
  const cfg = env();
  const paymentId = paymentIdFrom(request);
  // Siempre respondemos 200: si devolvemos error, Mercado Pago reintenta sin fin.
  if (!paymentId || !cfg.supabaseUrl || !cfg.serviceKey) return response.status(200).json({ ignored: true });

  try {
    const credRes = await rest(cfg, "payment_credentials?provider=eq.mercadopago&select=access_token");
    const credentials = (credRes.ok ? await credRes.json() : [])[0];
    if (!credentials?.access_token) return response.status(200).json({ ignored: "sin credenciales" });

    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { authorization: `Bearer ${credentials.access_token}` },
    });
    if (!payRes.ok) return response.status(200).json({ ignored: "pago no accesible" });
    const payment = await payRes.json();

    const orderId = payment.external_reference;
    if (!orderId) return response.status(200).json({ ignored: "sin referencia" });

    const statusMap = { approved: "paid", refunded: "cancelled", charged_back: "cancelled" };
    const newStatus = statusMap[payment.status];
    if (!newStatus) return response.status(200).json({ ignored: payment.status });

    const orderRes = await rest(cfg, `orders?id=eq.${encodeURIComponent(orderId)}&select=id,status`);
    const order = (orderRes.ok ? await orderRes.json() : [])[0];
    if (!order) return response.status(200).json({ ignored: "pedido inexistente" });
    if (order.status === newStatus) return response.status(200).json({ ok: true, sinCambios: true });
    // Un pedido ya cancelado no se reabre desde un aviso.
    if (order.status === "cancelled" && newStatus === "paid") return response.status(200).json({ ignored: "pedido cancelado" });

    await rest(cfg, `orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        status: newStatus,
        payment_provider: "mercadopago",
        payment_reference: String(payment.id),
        updated_at: new Date().toISOString(),
      }),
    });
    return response.status(200).json({ ok: true, status: newStatus });
  } catch (error) {
    return response.status(200).json({ ignored: "error interno" });
  }
}
