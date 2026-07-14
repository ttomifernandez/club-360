"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmt } from "@/lib/format";
import type { Order } from "@/lib/types";

const STATUS_LABEL: Record<Order["status"], { text: string; cls: string }> = {
  pending: { text: "Pendiente", cls: "bg-amber-100 text-amber-800" },
  paid: { text: "Pagado", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { text: "Rechazado", cls: "bg-red-100 text-red-700" },
  cancelled: { text: "Cancelado", cls: "bg-slate-200 text-slate-600" },
};

export default function OrdersAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setOrders((data as Order[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (order: Order, status: Order["status"]) => {
    const supabase = createClient();
    await supabase.from("orders").update({ status }).eq("id", order.id);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Pedidos</h1>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm">
        {loading ? (
          <p className="p-6 text-slate-400">Cargando…</p>
        ) : orders.length === 0 ? (
          <p className="p-6 text-slate-400">
            Todavía no hay pedidos. Acá van a aparecer los pagos por Mercado Pago.
          </p>
        ) : (
          orders.map((o) => {
            const st = STATUS_LABEL[o.status] ?? STATUS_LABEL.pending;
            const isOpen = expanded === o.id;
            return (
              <div key={o.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                  className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-slate-50 transition"
                >
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${st.cls}`}
                  >
                    {st.text}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900">
                      {fmt(Number(o.total))}{" "}
                      <span className="font-normal text-slate-500">
                        · {o.items.reduce((t, it) => t + it.qty, 0)} ítem(s)
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(o.created_at).toLocaleString("es-AR")} · #{o.id.slice(0, 8)}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400">
                    {isOpen ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 bg-slate-50">
                    <ul className="text-sm text-slate-700 mb-3">
                      {o.items.map((it, i) => (
                        <li key={i} className="py-1">
                          {it.qty}x {it.name} — {fmt(it.price)} c/u
                        </li>
                      ))}
                    </ul>
                    {o.mp_payment_id && (
                      <p className="text-xs text-slate-500 mb-3">
                        Pago MP: {o.mp_payment_id}
                      </p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {(Object.keys(STATUS_LABEL) as Order["status"][])
                        .filter((s) => s !== o.status)
                        .map((s) => (
                          <button
                            key={s}
                            onClick={() => setStatus(o, s)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-600 hover:border-emerald-600 hover:text-emerald-700 transition"
                          >
                            Marcar {STATUS_LABEL[s].text.toLowerCase()}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
