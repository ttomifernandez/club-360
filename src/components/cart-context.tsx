"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CartItem, Product } from "@/lib/types";

const STORE_KEY = "club360-cart-v2";

type CartContextType = {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (p: Product) => void;
  increment: (id: string) => void;
  decrement: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  totalQty: number;
  totalPrice: number;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      if (Array.isArray(raw)) {
        setItems(
          raw.filter(
            (it) =>
              it && typeof it.id === "string" && typeof it.price === "number" && it.qty > 0
          )
        );
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const add = useCallback((p: Product) => {
    setItems((prev) => {
      const found = prev.find((it) => it.id === p.id);
      if (found) {
        return prev.map((it) => (it.id === p.id ? { ...it, qty: it.qty + 1 } : it));
      }
      return [
        ...prev,
        { id: p.id, name: p.name, price: Number(p.price), image_url: p.image_url, qty: 1 },
      ];
    });
  }, []);

  const increment = useCallback((id: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, qty: it.qty + 1 } : it)));
  }, []);

  const decrement = useCallback((id: string) => {
    setItems((prev) =>
      prev
        .map((it) => (it.id === id ? { ...it, qty: it.qty - 1 } : it))
        .filter((it) => it.qty > 0)
    );
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totalQty = useMemo(() => items.reduce((t, it) => t + it.qty, 0), [items]);
  const totalPrice = useMemo(
    () => items.reduce((t, it) => t + it.price * it.qty, 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      add,
      increment,
      decrement,
      remove,
      clear,
      totalQty,
      totalPrice,
    }),
    [items, isOpen, add, increment, decrement, remove, clear, totalQty, totalPrice]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
