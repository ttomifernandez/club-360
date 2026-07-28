-- Bienestar Rural 360 · matriz de permisos por rol
-- Ejecutar una sola vez en Supabase SQL Editor. Idempotente.
--
--   Rol           Pedidos            Productos/Categorías   Cupones    Usuarios
--   owner         todo               todo                   todo       todo
--   operator      ver + estado       crear/editar/stock     ver        —
--   catalog       —                  crear/editar/stock     —          —
--   support       ver                ver                    ver        —
--   auditor       ver                ver                    ver        ver
--
-- Eliminar productos/categorías queda reservado al propietario; los demás
-- roles pueden ocultarlos (active = false), que es reversible.

-- ---------- PRODUCTOS: alta y edición para operator y catalog ----------
drop policy if exists "Catalog and operator create products" on public.products;
create policy "Catalog and operator create products" on public.products for insert
  with check (public.current_role() in ('catalog', 'operator'));

drop policy if exists "Catalog and operator update products" on public.products;
create policy "Catalog and operator update products" on public.products for update
  using (public.current_role() in ('catalog', 'operator'))
  with check (public.current_role() in ('catalog', 'operator'));

-- ---------- CATEGORÍAS: alta y edición para operator y catalog ----------
drop policy if exists "Catalog and operator create categories" on public.categories;
create policy "Catalog and operator create categories" on public.categories for insert
  with check (public.current_role() in ('catalog', 'operator'));

drop policy if exists "Catalog and operator update categories" on public.categories;
create policy "Catalog and operator update categories" on public.categories for update
  using (public.current_role() in ('catalog', 'operator'))
  with check (public.current_role() in ('catalog', 'operator'));

-- ---------- CUPONES: catalog queda afuera de la lectura ----------
drop policy if exists "Staff reads coupons" on public.coupons;
create policy "Staff reads coupons" on public.coupons for select
  using (public.current_role() in ('owner', 'operator', 'support', 'auditor'));

-- ---------- USUARIOS: el auditor ve la lista completa ----------
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select
  using (id = auth.uid() or public.current_role() in ('owner', 'auditor'));

-- ---------- FOTOS: el operador también sube y reemplaza ----------
do $$
begin
  drop policy if exists "Catalog uploads product media" on storage.objects;
  create policy "Catalog uploads product media"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'product-media' and public.current_role() in ('owner','catalog','operator'));

  drop policy if exists "Catalog updates product media" on storage.objects;
  create policy "Catalog updates product media"
    on storage.objects for update to authenticated
    using (bucket_id = 'product-media' and public.current_role() in ('owner','catalog','operator'))
    with check (bucket_id = 'product-media' and public.current_role() in ('owner','catalog','operator'));

  drop policy if exists "Catalog deletes product media" on storage.objects;
  create policy "Catalog deletes product media"
    on storage.objects for delete to authenticated
    using (bucket_id = 'product-media' and public.current_role() in ('owner','catalog','operator'));
exception when insufficient_privilege then
  raise notice 'Sin permisos sobre storage.objects: ajustá las policies del bucket desde Storage → Policies.';
end $$;

-- Comprobación rápida de lo aplicado.
select tablename, policyname, cmd
from pg_policies
where schemaname in ('public', 'storage')
  and tablename in ('products', 'categories', 'coupons', 'profiles', 'objects')
order by tablename, policyname;
