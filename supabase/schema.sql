-- Bienestar Rural 369 · esquema inicial
-- Ejecutar en un proyecto Supabase nuevo antes de conectar el panel.

create extension if not exists pgcrypto;

create type public.app_role as enum ('owner', 'operator', 'catalog', 'support', 'auditor');
create type public.order_status as enum ('pending', 'paid', 'preparing', 'shipped', 'completed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'support',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id),
  name text not null,
  slug text not null unique,
  description text not null default '',
  image_url text,
  price numeric(12,2) not null check (price >= 0),
  list_price numeric(12,2) check (list_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percentage','fixed')),
  value numeric(12,2) not null check (value > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer,
  uses integer not null default 0,
  active boolean not null default true
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  status public.order_status not null default 'pending',
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_provider text,
  payment_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null,
  quantity integer not null check (quantity > 0)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.audit_log enable row level security;

create function public.current_role() returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and active = true $$;

create policy "Public reads active categories" on public.categories for select using (active = true or auth.uid() is not null);
create policy "Public reads active products" on public.products for select using (active = true or auth.uid() is not null);
create policy "Users read own profile" on public.profiles for select using (id = auth.uid() or public.current_role() = 'owner');
create policy "Owner manages profiles" on public.profiles for all using (public.current_role() = 'owner') with check (public.current_role() = 'owner');
create policy "Owner manages categories" on public.categories for all using (public.current_role() = 'owner') with check (public.current_role() = 'owner');
create policy "Owner manages products" on public.products for all using (public.current_role() = 'owner') with check (public.current_role() = 'owner');
create policy "Catalog edits products except prices through RPC" on public.products for select using (public.current_role() in ('catalog','operator','support','auditor'));
create policy "Owner manages coupons" on public.coupons for all using (public.current_role() = 'owner') with check (public.current_role() = 'owner');
create policy "Staff reads orders" on public.orders for select using (public.current_role() in ('owner','operator','support','auditor'));
create policy "Owner and operator update orders" on public.orders for update using (public.current_role() in ('owner','operator'));
create policy "Staff reads order items" on public.order_items for select using (public.current_role() in ('owner','operator','support','auditor'));
create policy "Owner reads audit log" on public.audit_log for select using (public.current_role() = 'owner');

-- Fotos de productos: lectura pública, escritura limitada a owner y catalog.
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

create policy "Public reads product media"
on storage.objects for select
using (bucket_id = 'product-media');

create policy "Catalog uploads product media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-media'
  and public.current_role() in ('owner','catalog')
);

create policy "Catalog updates product media"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-media'
  and public.current_role() in ('owner','catalog')
)
with check (
  bucket_id = 'product-media'
  and public.current_role() in ('owner','catalog')
);

create policy "Catalog deletes product media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-media'
  and public.current_role() in ('owner','catalog')
);

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger categories_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();

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

create trigger products_audit after insert or update or delete on public.products
for each row execute function public.write_audit_log();
create trigger categories_audit after insert or update or delete on public.categories
for each row execute function public.write_audit_log();
create trigger coupons_audit after insert or update or delete on public.coupons
for each row execute function public.write_audit_log();
create trigger orders_audit after insert or update or delete on public.orders
for each row execute function public.write_audit_log();

-- Las altas de pedidos públicos y los webhooks de pago deben pasar por
-- funciones de servidor, nunca mediante permisos anónimos directos.
