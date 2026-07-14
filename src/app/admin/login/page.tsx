"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email o contraseña incorrectos");
      setLoading(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#022c22] to-[#065f46] px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-sm"
      >
        <div className="flex items-center gap-3 mb-8">
          <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-950 grid place-items-center text-emerald-300 font-bold">
            360
          </span>
          <div className="leading-tight">
            <p className="font-bold text-slate-900">Club 360</p>
            <p className="text-xs uppercase tracking-widest text-emerald-700 font-bold">
              Panel Admin
            </p>
          </div>
        </div>

        <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        <label className="block text-sm font-bold text-slate-700 mb-1">Contraseña</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 mb-6 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        {error && <p className="text-red-600 text-sm font-semibold mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl transition"
        >
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
