import { createClient } from "@/lib/supabase/server";
import type { Category, Product } from "@/lib/types";
import { CartProvider } from "@/components/cart-context";
import { Navbar } from "@/components/navbar";
import { Catalog } from "@/components/catalog";
import { CartDrawer } from "@/components/cart-drawer";
import { WaFloat } from "@/components/wa-float";
import { ClubCtaButton } from "@/components/club-cta";
import { ScrollAnimations } from "@/components/scroll-animations";

export const revalidate = 60;

const MARQUEE_ITEMS = [
  { icon: "emoji_food_beverage", text: "Mates & Yerberas" },
  { icon: "work", text: "Bolsos de Cuero" },
  { icon: "restaurant", text: "Cuchillos Artesanales" },
  { icon: "workspace_premium", text: "Calidad Ultrapremium" },
  { icon: "sell", text: "Precios de Socio" },
  { icon: "verified", text: "Hecho a Mano" },
];

async function getData(): Promise<{ categories: Category[]; products: Product[] }> {
  try {
    const supabase = await createClient();
    const [{ data: categories }, { data: products }] = await Promise.all([
      supabase.from("categories").select("*").order("position"),
      supabase
        .from("products")
        .select("*, categories(id, name, slug)")
        .eq("active", true)
        .order("position"),
    ]);
    return { categories: categories ?? [], products: products ?? [] };
  } catch {
    // Sin Supabase configurado (dev inicial): catálogo vacío.
    return { categories: [], products: [] };
  }
}

export default async function Home() {
  const { categories, products } = await getData();

  return (
    <CartProvider>
      <ScrollAnimations />
      <Navbar />

      {/* HERO */}
      <header className="hero" id="inicio">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot"></span>
            <span>Club de Beneficios 360°</span>
          </div>
          <h1>
            CLUB <span className="highlight">ULTRAPREMIUM</span>
          </h1>
          <p className="hero-sub">
            Mates y yerberas, bolsos de cuero y cuchillos con mango de ciervo. Piezas
            artesanales de altísima calidad con{" "}
            <strong style={{ color: "#fff" }}>
              precios especiales y descuentos exclusivos
            </strong>{" "}
            para socios de la Plataforma Agropecuaria 360.
          </p>
          <a href="#catalogo" className="hero-cta">
            VER BENEFICIOS
            <span className="material-symbols-outlined">arrow_downward</span>
          </a>
        </div>
      </header>

      {/* MARQUEE */}
      <div className="marquee-section">
        <div className="marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <div className="marquee-item" key={i}>
              <span className="material-symbols-outlined">{item.icon}</span> {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* CATALOG */}
      <section id="catalogo" className="catalog">
        <div className="catalog-inner">
          <div className="section-header animate-on-scroll">
            <h2>Club de Beneficios</h2>
            <p>
              Piezas artesanales ultrapremium con descuentos exclusivos para socios. Agregá
              al carrito y pagá online con Mercado Pago o finalizá tu pedido por WhatsApp.
            </p>
          </div>
          <Catalog categories={categories} products={products} />
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="cta-banner" id="club">
        <div className="cta-banner-inner animate-on-scroll">
          <h2>
            Sé parte del <span>Club 360</span>
          </h2>
          <p>
            Los socios de la Plataforma Agropecuaria 360 acceden a descuentos exclusivos y
            precios especiales en todas las piezas ultrapremium. ¿Todavía no sos socio?
            Escribinos y activá tus beneficios.
          </p>
          <ClubCtaButton />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="contact">
        <div className="footer-bar">
          <p>© 2026 PLATAFORMA AGROPECUARIA 360 SAS.</p>
          <div className="footer-links">
            <span className="footer-location">
              <span className="material-symbols-outlined">location_on</span> Córdoba,
              Argentina
            </span>
            <a href="#inicio">Volver al Inicio</a>
          </div>
        </div>
      </footer>

      <CartDrawer />
      <WaFloat />
    </CartProvider>
  );
}
