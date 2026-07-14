import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";

const STATUS_MAP: Record<string, string> = {
  approved: "paid",
  rejected: "rejected",
  cancelled: "cancelled",
  refunded: "cancelled",
  charged_back: "cancelled",
};

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) return NextResponse.json({ ok: true });

    const url = request.nextUrl;
    let paymentId =
      url.searchParams.get("data.id") ||
      (url.searchParams.get("topic") === "payment" ? url.searchParams.get("id") : null);
    let type = url.searchParams.get("type") || url.searchParams.get("topic");

    // MP también manda la notificación en el body
    try {
      const body = await request.json();
      if (!paymentId && body?.data?.id) paymentId = String(body.data.id);
      if (!type && body?.type) type = body.type;
    } catch {
      /* body vacío o no-JSON */
    }

    if (type !== "payment" || !paymentId) {
      return NextResponse.json({ ok: true });
    }

    const mp = new MercadoPagoConfig({ accessToken });
    const payment = await new Payment(mp).get({ id: paymentId });

    const orderId = payment.external_reference;
    if (!orderId) return NextResponse.json({ ok: true });

    const status = STATUS_MAP[payment.status ?? ""] ?? "pending";

    const supabase = createAdminClient();
    await supabase
      .from("orders")
      .update({ status, mp_payment_id: String(payment.id) })
      .eq("id", orderId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[mp-webhook]", e);
    // 500 para que Mercado Pago reintente la notificación
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
