"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/slug";
import { fmt } from "@/lib/format";
import type { Category, Product } from "@/lib/types";

type FormState = {
  name: string;
  category_id: string;
  description: string;
  price: string;
  price_old: string;
  tag: string;
  discount_label: string;
  stock: string;
  active: boolean;
  image_url: string;
};

const EMPTY: FormState = {
  name: "",
  category_id: "",
  description: "",
  price: "",
  price_old: "",
  tag: "",
  discount_label: "",
  stock: "",
  active: true,
  image_url: "",
};

export default function ProductsAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase
        .from("products")
        .select("*, categories(id, name, slug)")
        .order("position"),
      supabase.from("categories").select("*").order("position"),
    ]);
    setProducts(prods ?? []);
    setCategories(cats ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      category_id: p.category_id ?? "",
      description: p.description,
      price: String(p.price),
      price_old: p.price_old != null ? String(p.price_old) : "",
      tag: p.tag ?? "",
      discount_label: p.discount_label ?? "",
      stock: p.stock != null ? String(p.stock) : "",
      active: p.active,
      image_url: p.image_url ?? "",
    });
    setError(null);
    setShowForm(true);
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error subiendo la imagen");
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      slug: editing?.slug ?? slugify(form.name),
      category_id: form.category_id || null,
      description: form.description.trim(),
      price: Number(form.price),
      price_old: form.price_old ? Number(form.price_old) : null,
      tag: form.tag.trim() || null,
      discount_label: form.discount_label.trim() || null,
      stock: form.stock ? Number(form.stock) : null,
      active: form.active,
      image_url: form.image_url || null,
    };

    const supabase = createClient();
    let dbError;
    if (editing) {
      ({ error: dbError } = await supabase
        .from("products")
        .update(payload)
        .eq("id", editing.id));
    } else {
      const position = (products.at(-1)?.position ?? 0) + 1;
      ({ error: dbError } = await supabase
        .from("products")
        .insert({ ...payload, position }));
    }

    setSaving(false);
    if (dbError) {
      setError(
        dbError.code === "23505"
          ? "Ya existe un producto con ese nombre (slug duplicado)."
          : dbError.message
      );
      return;
    }
    setShowForm(false);
    load();
  };

  const remove = async (p: Product) => {
    if (!confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return setError(error.message);
    load();
  };

  const toggleActive = async (p: Product) => {
    const supabase = createClient();
    await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    load();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const other = index + dir;
    if (other < 0 || other >= products.length) return;
    const a = products[index];
    const b = products[other];
    const supabase = createClient();
    await Promise.all([
      supabase.from("products").update({ position: b.position }).eq("id", a.id),
      supabase.from("products").update({ position: a.position }).eq("id", b.id),
    ]);
    load();
  };

  const input =
    "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const label = "block text-sm font-bold text-slate-700 mb-1";

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-900">Productos</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-2.5 rounded-xl transition"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Nuevo producto
        </button>
      </div>

      {error && !showForm && (
        <p className="text-red-600 font-semibold mb-4 text-sm">{error}</p>
      )}

      {/* LISTA */}
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm">
        {loading ? (
          <p className="p-6 text-slate-400">Cargando…</p>
        ) : products.length === 0 ? (
          <p className="p-6 text-slate-400">
            Todavía no hay productos. Creá el primero con “Nuevo producto”.
          </p>
        ) : (
          products.map((p, i) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-3">
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
                  disabled={i === products.length - 1}
                  className="text-slate-400 hover:text-emerald-700 disabled:opacity-20"
                  aria-label="Bajar"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    keyboard_arrow_down
                  </span>
                </button>
              </div>
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="w-14 h-14 rounded-xl object-cover bg-slate-100 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-100 shrink-0 grid place-items-center text-slate-300">
                  <span className="material-symbols-outlined">image</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{p.name}</p>
                <p className="text-xs text-slate-500">
                  {p.categories?.name ?? "Sin categoría"} · {fmt(Number(p.price))}
                  {p.stock != null && ` · stock: ${p.stock}`}
                </p>
              </div>
              <button
                onClick={() => toggleActive(p)}
                className={`text-xs font-bold px-3 py-1 rounded-full transition ${
                  p.active
                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                    : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                }`}
              >
                {p.active ? "Publicado" : "Oculto"}
              </button>
              <button
                onClick={() => openEdit(p)}
                className="text-slate-500 hover:text-emerald-700 p-1"
                aria-label={`Editar ${p.name}`}
              >
                <span className="material-symbols-outlined text-[20px]">edit</span>
              </button>
              <button
                onClick={() => remove(p)}
                className="text-slate-500 hover:text-red-600 p-1"
                aria-label={`Eliminar ${p.name}`}
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            </div>
          ))
        )}
      </div>

      {/* MODAL FORM */}
      {showForm && (
        <div
          className="fixed inset-0 bg-slate-950/60 z-50 flex items-start justify-center overflow-y-auto p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            onSubmit={save}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 my-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editing ? `Editar: ${editing.name}` : "Nuevo producto"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Cerrar"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={label}>Nombre *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={input}
                />
              </div>

              <div>
                <label className={label}>Categoría</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className={input}
                >
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={label}>Etiqueta (ej: Destacado)</label>
                <input
                  value={form.tag}
                  onChange={(e) => setForm({ ...form, tag: e.target.value })}
                  className={input}
                />
              </div>

              <div>
                <label className={label}>Precio socio (ARS) *</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className={input}
                />
              </div>

              <div>
                <label className={label}>Precio de lista (tachado)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price_old}
                  onChange={(e) => setForm({ ...form, price_old: e.target.value })}
                  className={input}
                />
              </div>

              <div>
                <label className={label}>Cartel de descuento (ej: -20% Socios)</label>
                <input
                  value={form.discount_label}
                  onChange={(e) => setForm({ ...form, discount_label: e.target.value })}
                  className={input}
                />
              </div>

              <div>
                <label className={label}>Stock (vacío = sin control)</label>
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className={input}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={label}>Descripción</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={input}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={label}>Imagen</label>
                <div className="flex items-center gap-4">
                  {form.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.image_url}
                      alt="Vista previa"
                      className="w-20 h-20 rounded-xl object-cover bg-slate-100"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-slate-100 grid place-items-center text-slate-300">
                      <span className="material-symbols-outlined">image</span>
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(f);
                      }}
                      className="text-sm text-slate-600"
                    />
                    {uploading && (
                      <p className="text-xs text-emerald-700 font-semibold mt-1">Subiendo…</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  id="active"
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 accent-emerald-700"
                />
                <label htmlFor="active" className="text-sm font-bold text-slate-700">
                  Publicado en la tienda
                </label>
              </div>
            </div>

            {error && <p className="text-red-600 font-semibold mt-4 text-sm">{error}</p>}

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-5 py-2.5 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold px-6 py-2.5 rounded-xl transition"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
