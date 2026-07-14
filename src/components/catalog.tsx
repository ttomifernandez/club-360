"use client";

import { useState } from "react";
import type { Category, Product } from "@/lib/types";
import { fmt } from "@/lib/format";
import { useCart } from "./cart-context";

function ProductCard({
  product,
  delay,
  hidden,
}: {
  product: Product;
  delay: number;
  hidden: boolean;
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    add(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <article
      className={`product-card animate-on-scroll delay-${(delay % 3) + 1}${hidden ? " hidden" : ""}`}
    >
      <div className="product-img">
        {product.tag && <span className="product-tag">{product.tag}</span>}
        {product.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} loading="lazy" width={800} height={600} />
        )}
        {product.discount_label && (
          <span className="product-tag discount">
            <span className="material-symbols-outlined">sell</span> {product.discount_label}
          </span>
        )}
      </div>
      <div className="product-body">
        <div className="product-cat">{product.categories?.name ?? ""}</div>
        <h3 className="product-title">{product.name}</h3>
        <p className="product-desc">{product.description}</p>
        <div className="product-footer">
          <div className="product-price">
            {product.price_old != null && (
              <span className="price-old">{fmt(Number(product.price_old))}</span>
            )}
            <span className="price-value">{fmt(Number(product.price))}</span>
            <span className="price-label">Precio socio</span>
          </div>
          <button className={`product-btn${added ? " added" : ""}`} onClick={handleAdd}>
            <span className="material-symbols-outlined">
              {added ? "check" : "add_shopping_cart"}
            </span>{" "}
            {added ? "Agregado" : "Agregar"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function Catalog({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const [filter, setFilter] = useState<string>("all");

  // Los productos filtrados se ocultan con la clase `hidden` (no se desmontan)
  // para que la animación on-scroll inicial no se pierda al cambiar de filtro.

  return (
    <>
      <div className="filters animate-on-scroll delay-1">
        <button
          className={`filter-btn${filter === "all" ? " active" : ""}`}
          onClick={() => setFilter("all")}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`filter-btn${filter === c.slug ? " active" : ""}`}
            onClick={() => setFilter(c.slug)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="products-grid">
        {products.map((p, i) => (
          <ProductCard
            key={p.id}
            product={p}
            delay={i}
            hidden={filter !== "all" && p.categories?.slug !== filter}
          />
        ))}
      </div>
    </>
  );
}
