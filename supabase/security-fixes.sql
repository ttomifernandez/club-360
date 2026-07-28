-- Bienestar Rural 360 · correcciones de la auditoría de seguridad
-- Ejecutar una sola vez en Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- 1) Los pedidos solo cambian por las funciones, nunca por edición directa.
--    Antes, un operator podía reescribir el total o el estado de un pedido
--    con un pedido HTTP a mano, salteándose toda la lógica de stock.
-- ---------------------------------------------------------------------------
drop policy if exists "Owner and operator update orders" on public.orders;

-- ---------------------------------------------------------------------------
-- 2) El stock ya no se deduce del estado: se registra si fue devuelto.
--    Así no puede descontarse ni devolverse dos veces por el mismo pedido.
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists stock_returned boolean not null default false;

update public.orders set stock_returned = true
  where status = 'cancelled' and stock_returned = false;

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
  -- Lo llaman el panel (owner/operator) y el servidor con la clave de
  -- servicio, que es quien procesa los avisos de Mercado Pago.
  if not (
    coalesce(public.current_role()::text, '') in ('owner', 'operator')
    or coalesce(auth.role(), '') = 'service_role'
  ) then
    raise exception 'No tenés permisos para actualizar pedidos.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'El pedido no existe.'; end if;
  if v_order.status = p_status then return v_order.status; end if;

  if p_status = 'cancelled' and not v_order.stock_returned then
    for v_item in
      select product_id, quantity from public.order_items
      where order_id = p_order_id and product_id is not null
    loop
      update public.products
        set stock = stock + v_item.quantity, updated_at = now()
        where id = v_item.product_id;
    end loop;
    update public.orders set stock_returned = true where id = p_order_id;

  elsif p_status <> 'cancelled' and v_order.stock_returned then
    for v_item in
      select oi.product_id, oi.quantity, oi.product_name
      from public.order_items oi
      where oi.order_id = p_order_id and oi.product_id is not null
    loop
      perform 1 from public.products
        where id = v_item.product_id and stock >= v_item.quantity for update;
      if not found then
        raise exception 'No hay stock suficiente de % para reactivar el pedido.', v_item.product_name;
      end if;
      update public.products
        set stock = stock - v_item.quantity, updated_at = now()
        where id = v_item.product_id;
    end loop;
    update public.orders set stock_returned = false where id = p_order_id;
  end if;

  update public.orders set status = p_status, updated_at = now() where id = p_order_id;
  return p_status;
end;
$$;

revoke all on function public.set_order_status(uuid, public.order_status) from public, anon;
grant execute on function public.set_order_status(uuid, public.order_status) to authenticated, service_role;

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
  if not found then raise exception 'El pedido no existe.'; end if;

  if not v_order.stock_returned and v_order.status in ('pending', 'paid', 'preparing') then
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

-- ---------------------------------------------------------------------------
-- 3) El catálogo completo solo lo ve quien tiene perfil activo.
--    Antes alcanzaba con estar registrado, aunque no tuviera acceso al panel.
-- ---------------------------------------------------------------------------
drop policy if exists "Public reads active products" on public.products;
create policy "Public reads active products" on public.products for select
  using (active = true or public.current_role() is not null);

drop policy if exists "Public reads active categories" on public.categories;
create policy "Public reads active categories" on public.categories for select
  using (active = true or public.current_role() is not null);

-- ---------------------------------------------------------------------------
-- 4) Los precios los toca solo el propietario, como decía la intención
--    original. Catálogo y operador siguen editando todo lo demás.
-- ---------------------------------------------------------------------------
create or replace function public.guard_product_prices() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(public.current_role()::text, '') in ('owner', '') then
    return new;  -- owner, o el servidor con clave de servicio
  end if;
  if new.price is distinct from old.price or new.list_price is distinct from old.list_price then
    raise exception 'Solo el propietario puede cambiar precios.';
  end if;
  return new;
end;
$$;

drop trigger if exists products_guard_prices on public.products;
create trigger products_guard_prices before update on public.products
for each row execute function public.guard_product_prices();

-- ---------------------------------------------------------------------------
-- 5) Los cambios de usuarios quedan registrados, y el auditor puede leer
--    la auditoría (para eso existe el rol).
-- ---------------------------------------------------------------------------
drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit after insert or update or delete on public.profiles
for each row execute function public.write_audit_log();

drop policy if exists "Owner reads audit log" on public.audit_log;
create policy "Owner reads audit log" on public.audit_log for select
  using (public.current_role() in ('owner', 'auditor'));

-- ---------------------------------------------------------------------------
-- 6) place_order: suma las cantidades repetidas del mismo producto antes de
--    validar el stock, y no revela si un cupón existe o solo venció.
-- ---------------------------------------------------------------------------
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

  -- Un renglón por producto, con las cantidades ya sumadas.
  create temporary table if not exists _order_lines (
    product_id uuid primary key,
    quantity integer not null
  ) on commit drop;
  delete from _order_lines;

  insert into _order_lines (product_id, quantity)
  select (item->>'product_id')::uuid, sum((item->>'quantity')::integer)
  from jsonb_array_elements(p_items) as item
  group by (item->>'product_id')::uuid;

  if exists (select 1 from _order_lines where quantity is null or quantity < 1) then
    raise exception 'Cantidad inválida.';
  end if;

  for v_line in select * from _order_lines loop
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
    -- Mensaje único: no distingue inexistente de vencido, para que no se
    -- puedan adivinar códigos probando de a uno.
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

  for v_line in select * from _order_lines loop
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

-- ---------------------------------------------------------------------------
-- 7) Comprobación
-- ---------------------------------------------------------------------------
select
  not exists(select 1 from pg_policies where tablename='orders' and cmd='UPDATE')       as pedidos_sin_edicion_directa,
  exists(select 1 from information_schema.columns
         where table_name='orders' and column_name='stock_returned')                    as control_de_stock,
  exists(select 1 from pg_trigger where tgname='products_guard_prices')                 as precios_protegidos,
  exists(select 1 from pg_trigger where tgname='profiles_audit')                        as usuarios_auditados;
