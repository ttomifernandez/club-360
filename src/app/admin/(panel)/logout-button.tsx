"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-red-300 hover:bg-emerald-900 transition"
    >
      <span className="material-symbols-outlined text-[18px]">logout</span>
      Salir
    </button>
  );
}
