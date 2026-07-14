import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderItem } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { error: "Pago online no disponible por el momento. Usá WhatsApp." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const requested: { id: string; qty: number }[] = Array.isArray(body?.items)
      ? body.items.filter(
          (it: unknown): it is { id: string; qty: number } =>
            !!it &&
            typeof (it as { id?: unknown }).id === "string" &&
            Number.isInteger((it as { qty?: unknown }).qty) &&
            ((it as { qty: number }).qty as number) > 0 &&
            ((it as { qty: number }).qty as number) <= 99
        )
      : [];

    if (requested.length === 0) {
      return NextResponse.json({ error: "Carrito vacío" }, { status: 400 });
    }

    // Precios reales desde la DB (nunca confiar en el cliente)
    const supabase = createAdminClient();
    const { data: products, error: prodError } = await supabase
      .from("products")
      .select("id, name, price, image_url, active")
      .in(
        "id",
        requested.map((it) => it.id)
      );

    if (prodError) throw prodError;

    const items: OrderItem[] = [];
    for (const req of requested) {
      const p = products?.find((x) => x.id === req.id);
      if (!p || !p.active) {
        return NextResponse.json(
          { error: "Un producto del carrito ya no está disponible" },
          { status: 409 }
        );
      }
      items.push({ product_id: p.id, name: p.name, price: Number(p.price), qty: req.qty });
    }

    const total = items.reduce((t, it) => t + it.price * it.qty, 0);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({ status: "pending", total, items })
      .select()
      .single();

    if (orderError) throw orderError;

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;

    const mp = new MercadoPagoConfig({ accessToken });
    const preference = await new Preference(mp).create({
      body: {
        items: items.map((it) => ({
          id: it.product_id,
          title: it.name,
          quantity: it.qty,
          unit_price: it.price,
          currency_id: "ARS",
        })),
        external_reference: order.id,
        back_urls: {
          success: `${origin}/checkout/result?status=success`,
          failure: `${origin}/checkout/result?status=failure`,
          pending: `${origin}/checkout/result?status=pending`,
        },
        auto_return: "approved",
        notification_url: `${origin}/api/mp/webhook`,
        statement_descriptor: "CLUB 360",
      },
    });

    await supabase
      .from("orders")
      .update({ mp_preference_id: preference.id })
      .eq("id", order.id);

    return NextResponse.json({ init_point: preference.init_point, order_id: order.id });
  } catch (e) {
    console.error("[checkout]", e);
    return NextResponse.json(
      { error: "No se pudo iniciar el pago. Probá de nuevo o usá WhatsApp." },
      { status: 500 }
    );
  }
}
