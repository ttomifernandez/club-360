-- Bienestar Rural 360 · rol "Vendedor" (2/2: permisos y vínculo con la cuenta)
-- Ejecutar en el SQL Editor DESPUÉS de que seller-role-1-enum.sql haya
-- terminado (Postgres necesita que el valor nuevo del enum ya esté
-- confirmado antes de poder usarlo acá).
--
-- El vendedor maneja la tienda igual que un operador (pedidos, productos,
-- categorías, clientes) pero SIN poder borrar nada, sin ver Usuarios, sin
-- ver Configuración (por lo tanto sin ver el teléfono de la tienda ni la
-- comisión) y sin ver la pestaña Vendedores (por lo tanto sin ver el link
-- ni las ventas de otros vendedores). Esa parte visual la aplica admin.html;
-- acá se aplica la barrera real en la base.

-- Cada vendedor de public.sellers queda linkeado a su cuenta de acceso.
alter table public.sellers
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists sellers_user_id_idx on public.sellers (user_id) where user_id is not null;

-- ---------- PEDIDOS: mismo alcance que operator ----------
drop policy if exists "Staff reads orders" on public.orders;
create policy "Staff reads orders" on public.orders for select
  using (public.current_role() in ('owner','operator','support','auditor','seller'));

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
  if not (
    coalesce(public.current_role()::text, '') in ('owner', 'operator', 'seller')
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

-- delete_order queda owner-only a propósito: el vendedor no borra nada.

drop policy if exists "Staff reads order items" on public.order_items;
create policy "Staff reads order items" on public.order_items for select
  using (public.current_role() in ('owner','operator','support','auditor','seller'));

-- ---------- PRODUCTOS / CATEGORÍAS: alta y edición, sin precios ----------
-- (guard_product_prices ya bloquea precio/list_price para todo el que no
-- sea owner, así que el vendedor queda cubierto sin tocar esa función.)
drop policy if exists "Catalog edits products except prices through RPC" on public.products;
create policy "Catalog edits products except prices through RPC" on public.products for select
  using (public.current_role() in ('catalog','operator','support','auditor','seller'));

drop policy if exists "Catalog and operator create products" on public.products;
create policy "Catalog and operator create products" on public.products for insert
  with check (public.current_role() in ('catalog', 'operator', 'seller'));

drop policy if exists "Catalog and operator update products" on public.products;
create policy "Catalog and operator update products" on public.products for update
  using (public.current_role() in ('catalog', 'operator', 'seller'))
  with check (public.current_role() in ('catalog', 'operator', 'seller'));

drop policy if exists "Catalog and operator create categories" on public.categories;
create policy "Catalog and operator create categories" on public.categories for insert
  with check (public.current_role() in ('catalog', 'operator', 'seller'));

drop policy if exists "Catalog and operator update categories" on public.categories;
create policy "Catalog and operator update categories" on public.categories for update
  using (public.current_role() in ('catalog', 'operator', 'seller'))
  with check (public.current_role() in ('catalog', 'operator', 'seller'));

do $$
begin
  drop policy if exists "Catalog uploads product media" on storage.objects;
  create policy "Catalog uploads product media"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'product-media' and public.current_role() in ('owner','catalog','operator','seller'));

  drop policy if exists "Catalog updates product media" on storage.objects;
  create policy "Catalog updates product media"
    on storage.objects for update to authenticated
    using (bucket_id = 'product-media' and public.current_role() in ('owner','catalog','operator','seller'))
    with check (bucket_id = 'product-media' and public.current_role() in ('owner','catalog','operator','seller'));
exception when insufficient_privilege then
  raise notice 'Sin permisos sobre storage.objects: ajustá las policies del bucket desde Storage → Policies.';
end $$;
-- Borrar fotos queda para owner/catalog/operator como ya estaba: el
-- vendedor no borra nada, ni siquiera imágenes.

-- ---------- CLIENTES: mismo alcance que operator ----------
drop policy if exists "Staff reads customers" on public.customers;
create policy "Staff reads customers" on public.customers for select
  using (public.current_role() in ('owner', 'operator', 'support', 'auditor', 'seller'));

drop policy if exists "Owner and operator update customers" on public.customers;
create policy "Owner and operator update customers" on public.customers for update
  using (public.current_role() in ('owner', 'operator', 'seller'))
  with check (public.current_role() in ('owner', 'operator', 'seller'));

-- ---------- CUPONES: solo lectura, como operator ----------
drop policy if exists "Staff reads coupons" on public.coupons;
create policy "Staff reads coupons" on public.coupons for select
  using (public.current_role() in ('owner', 'operator', 'support', 'auditor', 'seller'));

-- ---------- CURSOS (interesados): solo lectura, como operator ----------
drop policy if exists "Staff reads course leads" on public.course_leads;
create policy "Staff reads course leads" on public.course_leads for select
  using (public.current_role() in ('owner','operator','support','auditor','seller'));

-- Nota importante: a propósito NO se agrega 'seller' a las policies de
-- public.sellers (Vendedores) ni a nada de Configuración/Usuarios. El
-- vendedor no debe ver comisión, el teléfono de la tienda, ni el link de
-- otros vendedores — eso queda reservado a owner/operator/auditor.

select tablename, policyname, cmd
from pg_policies
where schemaname in ('public','storage')
  and tablename in ('products','categories','orders','order_items','customers','coupons','course_leads','objects')
order by tablename, policyname;
