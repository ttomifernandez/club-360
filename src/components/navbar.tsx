"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "./cart-context";

export function Navbar() {
  const { totalQty, openCart } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bump, setBump] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (totalQty > 0) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 450);
      return () => clearTimeout(t);
    }
  }, [totalQty]);

  return (
    <nav className={`navbar${scrolled ? " scrolled" : ""}`}>
      <div className="navbar-inner">
        <a href="#inicio" className="nav-logo" aria-label="Plataforma Agropecuaria 360 - Inicio">
          <span className="nav-logo-mark">360</span>
          <span className="nav-logo-text">
            <strong>Plataforma 360</strong>
            <span>Club de Beneficios</span>
          </span>
        </a>
        <div className="nav-links">
          <a href="#inicio">Inicio</a>
          <a href="#catalogo">Catálogo</a>
          <a href="#club" className="nav-cta">Solicitar Info</a>
        </div>
        <div className="nav-right">
          <button className="nav-cart" onClick={openCart} aria-label="Abrir carrito">
            <span className="material-symbols-outlined">shopping_cart</span>
            <span className={`cart-count${totalQty > 0 ? " show" : ""}${bump ? " bump" : ""}`}>
              {totalQty}
            </span>
          </button>
          <button
            className="menu-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Abrir menú"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
      </div>
      <div className={`mobile-menu${menuOpen ? " open" : ""}`} onClick={() => setMenuOpen(false)}>
        <a href="#inicio">Inicio</a>
        <a href="#catalogo">Catálogo</a>
        <a href="#club" className="nav-cta">Contactar Ahora</a>
      </div>
    </nav>
  );
}
