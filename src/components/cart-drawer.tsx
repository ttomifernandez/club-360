"use client";

import { useEffect, useState } from "react";
import { fmt } from "@/lib/format";
import { useCart } from "./cart-context";

const WA_NUMBER = process.env.NEXT_PUBLIC_WA_NUMBER || "5493515929043";

const WhatsAppIcon = () => (
  <svg viewBox="0 0 32 32" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 0C7.16344 0 0 7.16344 0 16C0 19.0832 0.87325 21.9631 2.3855 24.4091L0 32L7.82869 29.5446C10.2796 31.1147 13.0645 32 16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0ZM23.4974 21.6033C23.1873 22.4766 21.8415 23.2307 20.8402 23.4479C20.1479 23.595 19.2458 23.7042 16.1953 22.4419C12.3015 20.831 9.77125 16.8906 9.57725 16.6346C9.38944 16.3786 8.00031 14.5369 8.00031 12.6288C8.00031 10.7208 8.96919 9.79463 9.35625 9.39494C9.67306 9.06825 10.19 8.91031 10.6934 8.91031C10.8549 8.91031 11.0031 8.91681 11.1384 8.92325C11.5385 8.94263 11.7386 8.96856 12.0033 9.60106C12.3323 10.3951 13.1328 12.3444 13.2294 12.5442C13.326 12.7441 13.4227 13.0154 13.2874 13.2801C13.1585 13.5513 13.0425 13.6741 12.8485 13.9001C12.6545 14.126 12.4673 14.3005 12.2674 14.5458C12.0868 14.7588 11.8866 14.9848 12.1124 15.3721C12.3382 15.7594 13.1194 17.0315 14.2685 18.0579C15.7523 19.3813 16.9531 19.8009 17.4049 19.9881C17.7404 20.1302 18.1406 20.1043 18.3858 19.8396C18.6891 19.5106 19.0635 18.9684 19.4379 18.4455C19.7024 18.0776 20.0315 18.026 20.3736 18.1551C20.7221 18.2778 22.5815 19.1945 22.956 19.3817C23.3305 19.5689 23.5822 19.6593 23.6725 19.8143C23.7629 19.9693 23.7629 20.7303 23.4974 21.6033Z" />
  </svg>
);

export function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    increment,
    decrement,
    remove,
    totalPrice,
  } = useCart();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeCart]);

  const checkoutWhatsApp = () => {
    if (items.length === 0) return;
    let msg =
      "¡Hola! Soy socio de la Plataforma Agropecuaria 360 y quiero hacer este pedido:\n\n";
    items.forEach((it) => {
      msg += `• ${it.qty}x ${it.name} — ${fmt(it.price)} c/u\n`;
    });
    msg += `\nTotal estimado: ${fmt(totalPrice)}\n\n¿Me confirman precio de socio y disponibilidad? ¡Gracias!`;
    window.open(
      `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener"
    );
  };

  const checkoutMercadoPago = async () => {
    if (items.length === 0 || paying) return;
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({ id: it.id, qty: it.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.init_point) {
        throw new Error(data.error || "No se pudo iniciar el pago");
      }
      window.location.href = data.init_point;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setPaying(false);
    }
  };

  return (
    <>
      <div className={`cart-overlay${isOpen ? " open" : ""}`} onClick={closeCart} />
      <aside className={`cart-drawer${isOpen ? " open" : ""}`} aria-label="Carrito de compras">
        <div className="cart-head">
          <h3>
            <span className="material-symbols-outlined">shopping_cart</span> Tu pedido
          </h3>
          <button className="cart-close" onClick={closeCart} aria-label="Cerrar carrito">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="cart-items">
          {items.length === 0 ? (
            <div className="cart-empty">
              <span className="material-symbols-outlined">production_quantity_limits</span>
              <p>Tu carrito está vacío</p>
              <small>Agregá piezas del catálogo para empezar tu pedido</small>
            </div>
          ) : (
            items.map((it) => (
              <div className="cart-item" key={it.id}>
                {it.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="cart-item-img" src={it.image_url} alt={it.name} />
                ) : (
                  <div className="cart-item-img" />
                )}
                <div className="cart-item-info">
                  <h4>{it.name}</h4>
                  <div className="cart-item-price">{fmt(it.price)}</div>
                  <div className="cart-qty">
                    <button onClick={() => decrement(it.id)} aria-label="Restar">
                      −
                    </button>
                    <span>{it.qty}</span>
                    <button onClick={() => increment(it.id)} aria-label="Sumar">
                      +
                    </button>
                  </div>
                </div>
                <button
                  className="cart-item-remove"
                  onClick={() => remove(it.id)}
                  aria-label={`Quitar ${it.name}`}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ))
          )}
        </div>
        <div className="cart-foot">
          <div className="cart-total">
            <span>Total estimado</span>
            <strong>{fmt(totalPrice)}</strong>
          </div>
          <p className="cart-note">
            Pagá online con Mercado Pago o finalizá tu pedido por WhatsApp. Envío a coordinar.
          </p>
          {error && (
            <p className="cart-note" style={{ color: "#dc2626", fontWeight: 700 }}>
              {error}
            </p>
          )}
          <button
            className="cart-checkout mp"
            disabled={items.length === 0 || paying}
            onClick={checkoutMercadoPago}
          >
            <span className="material-symbols-outlined">credit_card</span>
            {paying ? "Redirigiendo…" : "Pagar con Mercado Pago"}
          </button>
          <button
            className="cart-checkout"
            disabled={items.length === 0}
            onClick={checkoutWhatsApp}
          >
            <WhatsAppIcon />
            Finalizar pedido por WhatsApp
          </button>
        </div>
      </aside>
    </>
  );
}
