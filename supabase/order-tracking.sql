-- Bienestar Rural 360 · seguimiento del pedido para el cliente
-- Ejecutar en Supabase SQL Editor después de place-order-fix.sql.
--
-- Cada pedido recibe un código al azar de 32 caracteres. Con ese código el
-- cliente ve el estado de SU pedido sin registrarse. La tabla sigue cerrada:
-- lo único que se expone es lo que devuelve la función de acá abajo.

alter table public.orders
  add column if not exists public_token text;

update public.orders
  set public_token = encode(gen_random_bytes(16), 'hex')
  where public_token is null;

alter table public.orders alter column public_token set default encode(gen_random_bytes(16), 'hex');
alter table public.orders alter column public_token set not null;

create unique index if not exists orders_public_token_idx on public.orders (public_token);

-- Datos del seguimiento. No devuelve teléfono, email ni notas internas.
create or replace function public.order_tracking(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_token is null or length(p_token) <> 32 then
    return null;
  end if;
  select * into v_order from public.orders where public_token = p_token;
  if not found then return null; end if;

  return jsonb_build_object(
    'number',   v_order.order_number,
    'status',   v_order.status,
    'created',  v_order.created_at,
    'updated',  v_order.updated_at,
    'name',     split_part(v_order.customer_name, ' ', 1),
    'total',    v_order.total,
    'discount', v_order.discount,
    'shipping', v_order.shipping_method,
    'address',  v_order.shipping_address,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('name', i.product_name, 'quantity', i.quantity, 'price', i.unit_price)
             order by i.product_name)
      from public.order_items i where i.order_id = v_order.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.order_tracking(text) from public;
grant execute on function public.order_tracking(text) to anon, authenticated;

-- place_order devuelve además el código, para poder armar el link del cliente.
-- Como cambia lo que devuelve, hay que eliminarla antes de volver a crearla:
-- PostgreSQL no permite cambiarle el tipo de retorno a una función existente.
drop function if exists public.place_order(text,text,text,text,jsonb,text,text,text);

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
returns table(order_id uuid, order_number bigint, total numeric, discount numeric, tracking text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number bigint;
  v_token text;
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
  returning id, public.orders.order_number, public.orders.public_token
  into v_order_id, v_order_number, v_token;

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
  return query select v_order_id, v_order_number, v_total, v_discount, v_token;
end;
$$;

revoke all on function public.place_order(text,text,text,text,jsonb,text,text,text) from public;
grant execute on function public.place_order(text,text,text,text,jsonb,text,text,text) to anon, authenticated;
