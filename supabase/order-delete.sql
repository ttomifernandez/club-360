-- Bienestar Rural 360 · eliminar pedidos (solo propietario)
-- Ejecutar una sola vez en Supabase SQL Editor después de orders.sql.
--
-- Borra el pedido y sus ítems. Si el pedido todavía retenía stock
-- (pendiente, pagado o en preparación) las unidades vuelven al inventario.
-- Si ya fue enviado o completado el stock no se toca (la mercadería salió),
-- y si estaba cancelado tampoco (orders.sql ya lo había repuesto).

create or replace function public.delete_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  if coalesce(public.current_role()::text, '') <> 'owner' then
    raise exception 'Solo el propietario puede eliminar pedidos.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'El pedido no existe.';
  end if;

  if v_order.status in ('pending', 'paid', 'preparing') then
    for v_item in
      select product_id, quantity from public.order_items
      where order_id = p_order_id and product_id is not null
    loop
      update public.products
        set stock = stock + v_item.quantity, updated_at = now()
        where id = v_item.product_id;
    end loop;
  end if;

  delete from public.order_items where order_id = p_order_id;
  delete from public.orders where id = p_order_id;
end;
$$;

revoke all on function public.delete_order(uuid) from public, anon;
grant execute on function public.delete_order(uuid) to authenticated;
