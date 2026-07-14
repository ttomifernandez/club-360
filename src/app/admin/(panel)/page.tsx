import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [products, categories, pending, paid] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "paid"),
  ]);

  const cards = [
    {
      href: "/admin/products",
      label: "Productos",
      value: products.count ?? 0,
      icon: "inventory_2",
    },
    {
      href: "/admin/categories",
      label: "Categorías",
      value: categories.count ?? 0,
      icon: "category",
    },
    {
      href: "/admin/orders",
      label: "Pedidos pendientes",
      value: pending.count ?? 0,
      icon: "hourglass_top",
    },
    {
      href: "/admin/orders",
      label: "Pedidos pagados",
      value: paid.count ?? 0,
      icon: "paid",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Resumen</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition border border-slate-200"
          >
            <span className="material-symbols-outlined text-emerald-700">{c.icon}</span>
            <p className="text-3xl font-bold text-slate-900 mt-2">{c.value}</p>
            <p className="text-sm font-semibold text-slate-500">{c.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
