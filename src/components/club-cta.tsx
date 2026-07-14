"use client";

const WA_NUMBER = process.env.NEXT_PUBLIC_WA_NUMBER || "5493515929043";

export function ClubCtaButton() {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const msg =
      "¡Hola! Quiero sumarme al Club de Beneficios 360 y acceder a los precios de socio.";
    window.open(
      `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener"
    );
  };

  return (
    <a href="#" className="hero-cta" onClick={handleClick}>
      QUIERO SER SOCIO
      <span className="material-symbols-outlined">arrow_forward</span>
    </a>
  );
}
