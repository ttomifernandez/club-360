// Aviso por email de cada pedido nuevo. Lo dispara un Database Webhook de
// Supabase al insertarse una fila en orders. La clave de Resend vive solo
// acá, en las variables de entorno de Vercel.
const RESEND_URL = "https://api.resend.com/emails";

function env() {
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
  return {
    supabaseUrl,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    resendKey: process.env.RESEND_API_KEY || "",
    from: process.env.NOTIFY_FROM || "",
    to: (process.env.NOTIFY_TO || "").split(",").map(e => e.trim()).filter(Boolean),
    secret: process.env.ORDER_WEBHOOK_SECRET || "",
  };
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
const money = n => "$" + Number(n || 0).toLocaleString("es-AR");

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Método no permitido." });
  const cfg = env();

  // El webhook se identifica con un secreto compartido.
  const provided = request.headers["x-webhook-secret"] || "";
  if (!cfg.secret) return response.status(500).json({ error: "Falta ORDER_WEBHOOK_SECRET en las variables de Vercel (o falta el Redeploy)." });
  if (!provided) return response.status(401).json({ error: "El aviso llegó sin el header x-webhook-secret." });
  if (provided !== cfg.secret) return response.status(401).json({ error: "El secreto del header no coincide con el de Vercel." });
  if (!cfg.resendKey || !cfg.from || !cfg.to.length) {
    return response.status(500).json({ error: "Faltan RESEND_API_KEY, NOTIFY_FROM o NOTIFY_TO." });
  }

  const order = request.body?.record;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(order?.id || ""))) {
    return response.status(200).json({ ignored: "sin pedido válido" });
  }

  // Los ítems se leen de la base, no del aviso.
  let items = [];
  if (cfg.supabaseUrl && cfg.serviceKey) {
    const res = await fetch(`${cfg.supabaseUrl}/rest/v1/order_items?order_id=eq.${order.id}&select=product_name,quantity,unit_price`, {
      headers: { apikey: cfg.serviceKey, authorization: `Bearer ${cfg.serviceKey}` },
    });
    if (res.ok) items = await res.json().catch(() => []);
  }

  const phone = String(order.customer_phone || "").replace(/\D/g, "");
  const wa = phone ? `https://wa.me/${phone.length <= 10 ? "549" + phone.slice(-10) : phone}` : "";
  const rows = items.map(i => `<tr><td style="padding:8px 0;border-bottom:1px solid #eceeed">${esc(i.product_name)}</td><td style="padding:8px 0;border-bottom:1px solid #eceeed;text-align:center">${i.quantity}</td><td style="padding:8px 0;border-bottom:1px solid #eceeed;text-align:right">${money(i.unit_price)}</td></tr>`).join("");

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#17211d">
    <div style="background:#174f3d;color:#fff;padding:22px 24px;border-radius:14px 14px 0 0">
      <div style="font-size:13px;opacity:.85;letter-spacing:.08em;text-transform:uppercase">Bienestar Rural 360</div>
      <h1 style="margin:6px 0 0;font-size:22px">Pedido nuevo #${esc(order.order_number)}</h1>
    </div>
    <div style="border:1px solid #e5e9e6;border-top:0;border-radius:0 0 14px 14px;padding:24px">
      <p style="margin:0 0 4px;font-size:17px"><strong>${esc(order.customer_name)}</strong></p>
      <p style="margin:0 0 18px;color:#66716b">${esc(order.customer_phone)}${order.customer_email ? ` · ${esc(order.customer_email)}` : ""}</p>
      ${rows ? `<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th style="text-align:left;padding-bottom:6px;color:#66716b;font-size:12px">Producto</th><th style="padding-bottom:6px;color:#66716b;font-size:12px">Cant.</th><th style="text-align:right;padding-bottom:6px;color:#66716b;font-size:12px">Precio</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
      <p style="margin:18px 0 0;font-size:20px;text-align:right"><strong>Total: ${money(order.total)}</strong></p>
      ${Number(order.discount) > 0 ? `<p style="margin:2px 0 0;text-align:right;color:#66716b;font-size:13px">Descuento aplicado: −${money(order.discount)}</p>` : ""}
      ${order.shipping_method ? `<p style="margin:18px 0 0;padding:12px;background:#e8f1ed;border-radius:10px;font-size:14px"><strong>Entrega:</strong> ${esc(order.shipping_method)}${order.shipping_address ? ` — ${esc(order.shipping_address)}` : ""}</p>` : ""}
      ${order.notes ? `<p style="margin:10px 0 0;padding:12px;background:#f4f6f4;border-radius:10px;font-size:14px"><strong>Notas:</strong> ${esc(order.notes)}</p>` : ""}
      ${order.public_token ? `<p style="margin:14px 0 0;font-size:13px;color:#66716b">Link de seguimiento del cliente:<br><a href="https://${esc(request.headers["x-forwarded-host"] || request.headers.host)}/seguimiento?p=${esc(order.public_token)}">ver seguimiento</a></p>` : ""}
      <div style="margin-top:24px">
        ${wa ? `<a href="${wa}" style="display:inline-block;background:#25d366;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px">Escribirle por WhatsApp</a>` : ""}
        <a href="https://club-360-eight.vercel.app/admin" style="display:inline-block;background:#174f3d;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px;margin-left:6px">Abrir el panel</a>
      </div>
    </div>
  </div>`;

  const send = await fetch(RESEND_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.resendKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: cfg.from,
      to: cfg.to,
      subject: `Pedido #${order.order_number} · ${order.customer_name} · ${money(order.total)}`,
      html,
      reply_to: order.customer_email || undefined,
    }),
  });
  const out = await send.json().catch(() => ({}));
  if (!send.ok) return response.status(502).json({ error: out.message || "Resend rechazó el envío." });
  return response.status(200).json({ ok: true, id: out.id });
}
