-- Bienestar Rural 369 · datos de entrega en el pedido
-- Ejecutar una sola vez en Supabase SQL Editor después de checkout.sql.
-- Agrega método/dirección de entrega y extiende place_order para recibirlos.

alter table public.orders
  add column if not exists shipping_method text,
  add column if not exists shipping_address text;

-- La firma cambia: eliminar la versión anterior para evitar ambigüedad.
drop function if exists public.place_order(text, text, text, text, jsonb, text);

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
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
begin
  if nullif(trim(p_customer_name), '') is null or nullif(trim(p_customer_phone), '') is null then
    raise exception 'Completá nombre y WhatsApp.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 then raise exception 'Cantidad inválida.'; end if;
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and active = true
      for update;
    if not found then raise exception 'Uno de los productos ya no está disponible.'; end if;
    if v_product.stock < v_quantity then
      raise exception 'Stock insuficiente para %.', v_product.name;
    end if;
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  if nullif(trim(p_coupon_code), '') is not null then
    select * into v_coupon from public.coupons
      where upper(code) = upper(trim(p_coupon_code))
        and active = true
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now())
        and (max_uses is null or uses < max_uses)
      for update;
    if not found then raise exception 'El cupón no existe, venció o alcanzó su límite.'; end if;
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

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity)
    values(v_order_id,v_product.id,v_product.name,v_product.price,v_quantity);
    update public.products set stock = stock - v_quantity where id = v_product.id;
  end loop;

  if v_coupon.id is not null then
    update public.coupons set uses = uses + 1 where id = v_coupon.id;
  end if;
  return query select v_order_id, v_order_number, v_total, v_discount;
end;
$$;

revoke all on function public.place_order(text,text,text,text,jsonb,text,text,text) from public;
grant execute on function public.place_order(text,text,text,text,jsonb,text,text,text) to anon, authenticated;
