-- Bienestar Rural 360 · vendedores con link de referido y comisión
-- Ejecutar una sola vez en Supabase SQL Editor, después de place-order-fix.sql,
-- order-tracking.sql y site-texts.sql.
--
-- Cada vendedor tiene un código corto; su link para repartir es la tienda
-- con "?v=<código>" (ej. https://tudominio.com/?v=juan). La tienda guarda
-- ese código en el navegador del visitante y lo manda al confirmar el
-- pedido (ver place_order más abajo), así el pedido queda asociado al
-- vendedor. La comisión es un único % para todos, editable como cualquier
-- texto del panel (clave seller_commission_percent).

create table public.sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.sellers enable row level security;

create policy "Owner manages sellers" on public.sellers for all
  using (public.current_role() = 'owner')
  with check (public.current_role() = 'owner');

create policy "Staff reads sellers" on public.sellers for select
  using (public.current_role() in ('owner','operator','auditor'));

-- No hace falta una policy pública: place_order valida el código puertas
-- adentro (corre con security definer), la tienda nunca consulta esta tabla
-- directo.

alter table public.orders
  add column if not exists seller_id uuid references public.sellers(id) on delete set null;

create index if not exists orders_seller_id_idx on public.orders (seller_id);

insert into public.site_texts (key, label, value, default_value, sort_order, multiline) values
  ('seller_commission_percent', 'Comisión de vendedores (% sobre el total de cada venta que entró por su link)', '10', '10', 7, false)
on conflict (key) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  multiline = excluded.multiline,
  default_value = excluded.default_value,
  value = case
    when public.site_texts.value = public.site_texts.default_value then excluded.value
    else public.site_texts.value
  end;

-- place_order pasa a aceptar el código del vendedor y a guardar el
-- seller_id del pedido. Cambia la cantidad de parámetros: hay que eliminar
-- la versión anterior antes de recrearla (Postgres identifica la función
-- por nombre + tipos de argumentos).
drop function if exists public.place_order(text,text,text,text,jsonb,text,text,text);

create or replace function public.place_order(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_coupon_code text,
  p_items jsonb,
  p_notes text default null,
  p_shipping_method text default null,
  p_shipping_address text default null,
  p_seller_code text default null
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
  v_seller_id uuid;
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

  if nullif(trim(p_seller_code), '') is not null then
    select id into v_seller_id from public.sellers
      where lower(code) = lower(trim(p_seller_code)) and active = true;
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

  insert into public.orders(customer_name,customer_email,customer_phone,subtotal,discount,total,notes,shipping_method,shipping_address,seller_id)
  values(trim(p_customer_name),nullif(trim(p_customer_email),''),trim(p_customer_phone),v_subtotal,v_discount,v_total,p_notes,nullif(trim(p_shipping_method),''),nullif(trim(p_shipping_address),''),v_seller_id)
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

revoke all on function public.place_order(text,text,text,text,jsonb,text,text,text,text) from public;
grant execute on function public.place_order(text,text,text,text,jsonb,text,text,text,text) to anon, authenticated;

select key, label, value from public.site_texts where key = 'seller_commission_percent';
select count(*) as vendedores_existentes from public.sellers;
