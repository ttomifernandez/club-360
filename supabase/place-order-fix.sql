-- Bienestar Rural 360 · corrección urgente de place_order
-- Ejecutar en Supabase SQL Editor. Reemplaza la versión de security-fixes.sql.
--
-- La versión anterior usaba una tabla temporal y la limpiaba con un DELETE sin
-- WHERE, que Supabase bloquea por seguridad; eso dejaba el checkout sin poder
-- registrar pedidos. Ahora las cantidades se agrupan directamente en la
-- consulta, sin tabla intermedia.

create or replace function public.place_order(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_coupon_code text,
  p_items jsonb,
  p_notes text default null,
  p_shipping_method text default null,
  p_shipping_address text default null
)
returns table(order_id uuid, order_number bigint, total numeric, discount numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number bigint;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_coupon public.coupons%rowtype;
  v_line record;
  v_product public.products%rowtype;
begin
  if nullif(trim(p_customer_name), '') is null or nullif(trim(p_customer_phone), '') is null then
    raise exception 'Completá nombre y WhatsApp.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío.';
  end if;

  -- Un renglón por producto, con las cantidades repetidas ya sumadas.
  for v_line in
    select (item->>'product_id')::uuid as product_id,
           sum((item->>'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) as item
    group by (item->>'product_id')::uuid
  loop
    if v_line.quantity is null or v_line.quantity < 1 then
      raise exception 'Cantidad inválida.';
    end if;
    select * into v_product from public.products
      where id = v_line.product_id and active = true for update;
    if not found then raise exception 'Uno de los productos ya no está disponible.'; end if;
    if v_product.stock < v_line.quantity then
      raise exception 'Stock insuficiente para %.', v_product.name;
    end if;
    v_subtotal := v_subtotal + (v_product.price * v_line.quantity);
  end loop;

  if nullif(trim(p_coupon_code), '') is not null then
    select * into v_coupon from public.coupons
      where upper(code) = upper(trim(p_coupon_code))
        and active = true
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now())
        and (max_uses is null or uses < max_uses)
      for update;
    if not found then raise exception 'El cupón no es válido.'; end if;
    if v_coupon.discount_type = 'percentage' then
      v_discount := round(v_subtotal * least(v_coupon.value, 100) / 100, 2);
    else
      v_discount := least(v_coupon.value, v_subtotal);
    end if;
  end if;
  v_total := greatest(v_subtotal - v_discount, 0);

  insert into public.orders(customer_name,customer_email,customer_phone,subtotal,discount,total,notes,shipping_method,shipping_address)
  values(trim(p_customer_name),nullif(trim(p_customer_email),''),trim(p_customer_phone),v_subtotal,v_discount,v_total,p_notes,nullif(trim(p_shipping_method),''),nullif(trim(p_shipping_address),''))
  returning id, public.orders.order_number into v_order_id, v_order_number;

  for v_line in
    select (item->>'product_id')::uuid as product_id,
           sum((item->>'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) as item
    group by (item->>'product_id')::uuid
  loop
    select * into v_product from public.products where id = v_line.product_id;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity)
    values(v_order_id,v_product.id,v_product.name,v_product.price,v_line.quantity);
    update public.products set stock = stock - v_line.quantity where id = v_product.id;
  end loop;

  if v_coupon.id is not null then
    update public.coupons set uses = uses + 1 where id = v_coupon.id;
  end if;
  return query select v_order_id, v_order_number, v_total, v_discount;
end;
$$;

revoke all on function public.place_order(text,text,text,text,jsonb,text,text,text) from public;
grant execute on function public.place_order(text,text,text,text,jsonb,text,text,text) to anon, authenticated;
