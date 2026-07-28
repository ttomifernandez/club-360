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

// Todas las respuestas son idénticas a propósito: si variaran según el caso,
// cualquiera podría usar este endpoint para averiguar si un pago pertenece a
// la tienda y en qué estado está.
const ack = response => response.status(200).json({ received: true });

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));

// Comprobante para el cliente con el link para seguir su pedido.
async function sendCustomerEmail(order, origin) {
  const key = process.env.RESEND_API_KEY || "";
  const from = process.env.NOTIFY_FROM || "";
  if (!key || !from || !order.public_token) return;
  const link = `${origin}/seguimiento?p=${order.public_token}`;
  const money = "$" + Number(order.total || 0).toLocaleString("es-AR");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
    <div style="background:#047857;color:#fff;padding:24px;border-radius:14px 14px 0 0;text-align:center">
      <div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.85">Bienestar Rural 360</div>
      <h1 style="margin:8px 0 0;font-size:23px">¡Recibimos tu pago!</h1>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 14px 14px;padding:26px;text-align:center">
      <p style="margin:0 0 6px;font-size:16px">Hola ${esc(String(order.customer_name || "").split(" ")[0])}, tu pedido <strong>#${esc(order.order_number)}</strong> quedó confirmado.</p>
      <p style="margin:0 0 20px;color:#475569">Total abonado: <strong>${money}</strong></p>
      ${order.shipping_method ? `<p style="margin:0 0 20px;padding:12px;background:#ecfdf5;border-radius:10px;font-size:14px;color:#0f172a"><strong>Entrega:</strong> ${esc(order.shipping_method)}${order.shipping_address ? `<br>${esc(order.shipping_address)}` : ""}</p>` : ""}
      <a href="${esc(link)}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;padding:14px 26px;border-radius:10px;font-weight:700">Seguir mi pedido</a>
      <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;line-height:1.6">Guardá este correo: desde ese enlace vas a ver en qué estado está tu compra en todo momento.</p>
    </div>
  </div>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [order.customer_email],
      subject: `Tu pedido #${order.order_number} está confirmado`,
      html,
    }),
  });
}

export default async function handler(request, response) {
  const cfg = env();
  const paymentId = paymentIdFrom(request);
  // Siempre respondemos 200: si devolvemos error, Mercado Pago reintenta sin fin.
  if (!paymentId || !cfg.supabaseUrl || !cfg.serviceKey) return ack(response);

  try {
    const credRes = await rest(cfg, "payment_credentials?provider=eq.mercadopago&select=access_token");
    const credentials = (credRes.ok ? await credRes.json() : [])[0];
    if (!credentials?.access_token) return ack(response);

    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { authorization: `Bearer ${credentials.access_token}` },
    });
    if (!payRes.ok) return ack(response);
    const payment = await payRes.json();

    const orderId = payment.external_reference;
    if (!orderId) return ack(response);

    const statusMap = { approved: "paid", refunded: "cancelled", charged_back: "cancelled" };
    const newStatus = statusMap[payment.status];
    if (!newStatus) return ack(response);

    const orderRes = await rest(cfg, `orders?id=eq.${encodeURIComponent(orderId)}&select=id,status,order_number,customer_name,customer_email,total,public_token,shipping_method,shipping_address`);
    const order = (orderRes.ok ? await orderRes.json() : [])[0];
    if (!order) return ack(response);
    if (order.status === newStatus) return ack(response);
    // Un pedido ya cancelado no se reabre desde un aviso.
    if (order.status === "cancelled" && newStatus === "paid") return ack(response);

    // Vía la función, no por edición directa: es la que sabe devolver el
    // stock cuando un pago se reembolsa o se desconoce.
    await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/set_order_status`, {
      method: "POST",
      headers: { apikey: cfg.serviceKey, authorization: `Bearer ${cfg.serviceKey}`, "content-type": "application/json" },
      body: JSON.stringify({ p_order_id: orderId, p_status: newStatus }),
    });
    await rest(cfg, `orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({ payment_provider: "mercadopago", payment_reference: String(payment.id) }),
    });

    // Con el pago acreditado le mandamos al cliente su comprobante y el link
    // de seguimiento. Solo si dejó un email al comprar.
    if (newStatus === "paid" && order.customer_email) {
      const origin = `https://${request.headers["x-forwarded-host"] || request.headers.host}`;
      await sendCustomerEmail(order, origin).catch(() => {});
    }
    return ack(response);
  } catch (error) {
    return ack(response);
  }
}
