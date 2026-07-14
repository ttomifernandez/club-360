import Link from "next/link";

const CONTENT = {
  success: {
    icon: "check_circle",
    color: "#059669",
    title: "¡Pago aprobado!",
    text: "Recibimos tu pago correctamente. Nos vamos a contactar con vos para coordinar la entrega. ¡Gracias por tu compra!",
  },
  pending: {
    icon: "schedule",
    color: "#f59e0b",
    title: "Pago pendiente",
    text: "Tu pago está siendo procesado. Apenas se acredite nos contactamos para coordinar la entrega.",
  },
  failure: {
    icon: "cancel",
    color: "#dc2626",
    title: "El pago no se completó",
    text: "Hubo un problema con el pago. Podés intentar de nuevo desde el carrito o finalizar tu pedido por WhatsApp.",
  },
} as const;

export default async function CheckoutResult({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const key = (status === "success" || status === "pending" ? status : "failure") as
    | "success"
    | "pending"
    | "failure";
  const c = CONTENT[key];

  return (
    <main className="result-page">
      <div className="result-card">
        <span className="material-symbols-outlined" style={{ color: c.color }}>
          {c.icon}
        </span>
        <h1>{c.title}</h1>
        <p>{c.text}</p>
        <Link href="/" className="hero-cta" style={{ animation: "none" }}>
          Volver a la tienda
        </Link>
      </div>
    </main>
  );
}
