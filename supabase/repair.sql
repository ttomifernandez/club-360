-- Bienestar Rural 369 · reparación de schema.sql
-- schema.sql falló a mitad de ejecución: la función y las policies de public
-- quedaron creadas, pero faltó todo lo posterior. Este script es idempotente:
-- se puede correr varias veces sin romper nada.

-- 1) Bucket de fotos de productos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) Policies de storage (protegidas: si ya existen o el editor no tiene
--    permisos sobre storage.objects, avisan por notice y no abortan el script)
do $$ begin
  create policy "Public reads product media"
  on storage.objects for select
  using (bucket_id = 'product-media');
exception when others then raise notice 'Public reads product media: %', sqlerrm; end $$;

do $$ begin
  create policy "Catalog uploads product media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-media' and public.current_role() in ('owner','catalog'));
exception when others then raise notice 'Catalog uploads product media: %', sqlerrm; end $$;

do $$ begin
  create policy "Catalog updates product media"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-media' and public.current_role() in ('owner','catalog'))
  with check (bucket_id = 'product-media' and public.current_role() in ('owner','catalog'));
exception when others then raise notice 'Catalog updates product media: %', sqlerrm; end $$;

do $$ begin
  create policy "Catalog deletes product media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-media' and public.current_role() in ('owner','catalog'));
exception when others then raise notice 'Catalog deletes product media: %', sqlerrm; end $$;

-- 3) Trigger de updated_at
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at before update on public.categories
for each row execute function public.set_updated_at();
drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
for each row execute function public.set_updated_at();
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();

-- 4) Auditoría
create or replace function public.write_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log(actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(new.id::text, old.id::text),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists products_audit on public.products;
create trigger products_audit after insert or update or delete on public.products
for each row execute function public.write_audit_log();
drop trigger if exists categories_audit on public.categories;
create trigger categories_audit after insert or update or delete on public.categories
for each row execute function public.write_audit_log();
drop trigger if exists coupons_audit on public.coupons;
create trigger coupons_audit after insert or update or delete on public.coupons
for each row execute function public.write_audit_log();
drop trigger if exists orders_audit on public.orders;
create trigger orders_audit after insert or update or delete on public.orders
for each row execute function public.write_audit_log();

-- 5) Perfil de administrador. OJO: esto NO debe promover a todos los usuarios.
--    La versión original hacía owner a todo auth.users en cada corrida, lo que
--    convertía a cualquiera que se registrara en administrador de la tienda.
--    Ahora solo alcanza al email del propietario.
insert into public.profiles (id, full_name, role, active)
select id, coalesce(raw_user_meta_data->>'full_name', email, 'Owner'), 'owner', true
from auth.users
where lower(email) = 'ttomifernandez@gmail.com'
on conflict (id) do update set role = 'owner', active = true;

-- 6) Verificación final
select
  (select count(*) from storage.buckets where id = 'product-media') as bucket,
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects') as storage_policies,
  (select count(*)
     from pg_trigger t
    where t.tgrelid in ('public.products'::regclass, 'public.categories'::regclass,
                        'public.orders'::regclass, 'public.coupons'::regclass)
      and not t.tgisinternal) as triggers,
  (select string_agg(u.email || ' → ' || p.role, ', ')
     from public.profiles p join auth.users u on u.id = p.id) as perfiles;
