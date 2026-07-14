import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export const metadata = { title: "Admin | Club 360" };

const NAV = [
  { href: "/admin", label: "Inicio", icon: "dashboard" },
  { href: "/admin/products", label: "Productos", icon: "inventory_2" },
  { href: "/admin/categories", label: "Categorías", icon: "category" },
  { href: "/admin/orders", label: "Pedidos", icon: "receipt_long" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/admin/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-emerald-950 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-800 grid place-items-center text-emerald-300 font-bold text-sm">
              360
            </span>
            <span className="font-bold">Panel Club 360</span>
          </Link>
          <nav className="flex items-center gap-1 flex-wrap">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-emerald-100 hover:bg-emerald-900 transition"
              >
                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                {item.label}
              </Link>
            ))}
            <a
              href="/"
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-emerald-300 hover:bg-emerald-900 transition"
            >
              <span className="material-symbols-outlined text-[18px]">storefront</span>
              Ver tienda
            </a>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
