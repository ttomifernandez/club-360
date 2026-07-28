// Crea la preferencia de pago de Mercado Pago para un pedido ya registrado.
// El navegador solo manda el identificador del pedido: el importe, los ítems
// y el estado salen de la base con la clave del servidor, así que manipular
// la página no cambia lo que se cobra.
import { refreshMercadoPago } from "./mp-refresh.js";

const PREF_URL = "https://api.mercadopago.com/checkout/preferences";

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

const money = n => Math.round(Number(n) * 100) / 100;

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Método no permitido." });
  const cfg = env();
  if (!cfg.supabaseUrl || !cfg.serviceKey) return response.status(500).json({ error: "Servidor sin configurar." });

  const { orderId } = request.body || {};
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(String(orderId))) {
    return response.status(400).json({ error: "Pedido inválido." });
  }

  // Renovamos el acceso si está por vencer, para no fallar en medio de una venta.
  await refreshMercadoPago().catch(() => {});

  const [credRes, orderRes, itemsRes, settingsRes] = await Promise.all([
    rest(cfg, "payment_credentials?provider=eq.mercadopago&select=access_token,live_mode"),
    rest(cfg, `orders?id=eq.${orderId}&select=id,order_number,status,total,discount,customer_name,customer_email,customer_phone`),
    rest(cfg, `order_items?order_id=eq.${orderId}&select=product_name,quantity,unit_price`),
    rest(cfg, "payment_settings?provider=eq.mercadopago&select=*"),
  ]);

  const credentials = (credRes.ok ? await credRes.json() : [])[0];
  if (!credentials?.access_token) return response.status(400).json({ error: "La tienda todavía no tiene Mercado Pago conectado." });

  const order = (orderRes.ok ? await orderRes.json() : [])[0];
  if (!order) return response.status(404).json({ error: "No encontramos el pedido." });
  if (order.status !== "pending") return response.status(409).json({ error: "Este pedido ya no está pendiente de pago." });
  const total = money(order.total);
  if (!(total > 0)) return response.status(400).json({ error: "El pedido no tiene importe a pagar." });

  const items = itemsRes.ok ? await itemsRes.json() : [];
  const settings = (settingsRes.ok ? await settingsRes.json() : [])[0] || {};

  // Con cupón aplicado mandamos un único renglón por el total real del pedido,
  // para que lo que cobra Mercado Pago coincida siempre con lo registrado.
  const discount = money(order.discount || 0);
  const prefItems = discount > 0 || !items.length
    ? [{ title: `Pedido #${order.order_number}`, quantity: 1, unit_price: total, currency_id: "ARS" }]
    : items.map(i => ({ title: String(i.product_name).slice(0, 250), quantity: Number(i.quantity), unit_price: money(i.unit_price), currency_id: "ARS" }));

  const excludedTypes = [];
  if (settings.accept_cash === false) excludedTypes.push({ id: "ticket" }, { id: "atm" });
  if (settings.accept_credit === false) excludedTypes.push({ id: "credit_card" });
  if (settings.accept_debit === false) excludedTypes.push({ id: "debit_card" });

  // El dominio sale del pedido entrante: si mañana cambia, esto sigue andando.
  const origin = `https://${request.headers["x-forwarded-host"] || request.headers.host}`;
  const preference = {
    items: prefItems,
    external_reference: order.id,
    statement_descriptor: "BIENESTAR RURAL",
    payer: {
      name: order.customer_name || undefined,
      email: order.customer_email || undefined,
      phone: order.customer_phone ? { number: String(order.customer_phone) } : undefined,
    },
    back_urls: {
      success: `${origin}/?pago=ok&pedido=${order.order_number}`,
      pending: `${origin}/?pago=pendiente&pedido=${order.order_number}`,
      failure: `${origin}/?pago=error&pedido=${order.order_number}`,
    },
    auto_return: "approved",
    notification_url: `${origin}/api/mp-webhook`,
    binary_mode: settings.binary_mode !== false,
    payment_methods: {
      installments: Number(settings.max_installments) || 6,
      excluded_payment_types: excludedTypes,
    },
  };

  const prefRes = await fetch(PREF_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${credentials.access_token}`, "content-type": "application/json" },
    body: JSON.stringify(preference),
  });
  const created = await prefRes.json().catch(() => ({}));
  if (!prefRes.ok || !(created.init_point || created.sandbox_init_point)) {
    return response.status(502).json({ error: created.message || "Mercado Pago no pudo generar el pago." });
  }

  const url = credentials.live_mode === false ? (created.sandbox_init_point || created.init_point) : created.init_point;
  await rest(cfg, `orders?id=eq.${orderId}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ payment_provider: "mercadopago", payment_reference: created.id, updated_at: new Date().toISOString() }),
  });

  return response.status(200).json({ url });
}
