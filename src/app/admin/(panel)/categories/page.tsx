"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/slug";
import type { Category } from "@/lib/types";

export default function CategoriesAdmin() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("categories").select("*").order("position");
    setCategories(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const supabase = createClient();

    if (editing) {
      const { error } = await supabase
        .from("categories")
        .update({ name, slug: slugify(name) })
        .eq("id", editing.id);
      if (error) return setError(error.message);
      setEditing(null);
    } else {
      const position = (categories.at(-1)?.position ?? 0) + 1;
      const { error } = await supabase
        .from("categories")
        .insert({ name, slug: slugify(name), position });
      if (error) return setError(error.message);
    }
    setName("");
    load();
  };

  const remove = async (cat: Category) => {
    if (!confirm(`¿Eliminar la categoría "${cat.name}"? Los productos quedarán sin categoría.`))
      return;
    const supabase = createClient();
    const { error } = await supabase.from("categories").delete().eq("id", cat.id);
    if (error) return setError(error.message);
    load();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const other = index + dir;
    if (other < 0 || other >= categories.length) return;
    const a = categories[index];
    const b = categories[other];
    const supabase = createClient();
    await Promise.all([
      supabase.from("categories").update({ position: b.position }).eq("id", a.id),
      supabase.from("categories").update({ position: a.position }).eq("id", b.id),
    ]);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Categorías</h1>

      <form onSubmit={save} className="flex gap-2 mb-6 flex-wrap">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder={editing ? `Editando: ${editing.name}` : "Nueva categoría…"}
          className="flex-1 min-w-[220px] border border-slate-300 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 py-2.5 rounded-xl transition"
        >
          {editing ? "Guardar" : "Agregar"}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setName("");
            }}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition"
          >
            Cancelar
          </button>
        )}
      </form>

      {error && <p className="text-red-600 font-semibold mb-4 text-sm">{error}</p>}

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm">
        {loading ? (
          <p className="p-6 text-slate-400">Cargando…</p>
        ) : categories.length === 0 ? (
          <p className="p-6 text-slate-400">Todavía no hay categorías.</p>
        ) : (
          categories.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex flex-col">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-slate-400 hover:text-emerald-700 disabled:opacity-20"
                  aria-label="Subir"
                >
                  <span className="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === categories.length - 1}
                  className="text-slate-400 hover:text-emerald-700 disabled:opacity-20"
                  aria-label="Bajar"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    keyboard_arrow_down
                  </span>
                </button>
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-400">/{c.slug}</p>
              </div>
              <button
                onClick={() => {
                  setEditing(c);
                  setName(c.name);
                }}
                className="text-slate-500 hover:text-emerald-700 p-1"
                aria-label={`Editar ${c.name}`}
              >
                <span className="material-symbols-outlined text-[20px]">edit</span>
              </button>
              <button
                onClick={() => remove(c)}
                className="text-slate-500 hover:text-red-600 p-1"
                aria-label={`Eliminar ${c.name}`}
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
