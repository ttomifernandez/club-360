-- Bienestar Rural 369 · cambio de estado de pedidos con manejo de stock
-- Ejecutar una sola vez en Supabase SQL Editor después de checkout.sql.
-- Cancelar un pedido devuelve las cantidades al stock; reactivar un pedido
-- cancelado vuelve a descontarlas (validando disponibilidad).

create or replace function public.set_order_status(
  p_order_id uuid,
  p_status public.order_status
)
returns public.order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  if public.current_role() not in ('owner', 'operator') then
    raise exception 'No tenés permisos para actualizar pedidos.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'El pedido no existe.';
  end if;
  if v_order.status = p_status then
    return v_order.status;
  end if;

  if p_status = 'cancelled' then
    -- Devolver al stock las cantidades del pedido.
    for v_item in
      select product_id, quantity from public.order_items
      where order_id = p_order_id and product_id is not null
    loop
      update public.products
        set stock = stock + v_item.quantity, updated_at = now()
        where id = v_item.product_id;
    end loop;
  elsif v_order.status = 'cancelled' then
    -- Reactivar un pedido cancelado: validar y volver a descontar stock.
    for v_item in
      select oi.product_id, oi.quantity, oi.product_name
      from public.order_items oi
      where oi.order_id = p_order_id and oi.product_id is not null
    loop
      perform 1 from public.products
        where id = v_item.product_id and stock >= v_item.quantity
        for update;
      if not found then
        raise exception 'No hay stock suficiente de % para reactivar el pedido.', v_item.product_name;
      end if;
      update public.products
        set stock = stock - v_item.quantity, updated_at = now()
        where id = v_item.product_id;
    end loop;
  end if;

  update public.orders set status = p_status, updated_at = now() where id = p_order_id;
  return p_status;
end;
$$;

revoke all on function public.set_order_status(uuid, public.order_status) from public;
grant execute on function public.set_order_status(uuid, public.order_status) to authenticated;
