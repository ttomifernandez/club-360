-- Club 360 — Schema inicial
-- Ejecutar en el SQL Editor de Supabase (o via MCP).

-- ===== CATEGORÍAS =====
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ===== PRODUCTOS =====
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  price_old numeric(12,2) check (price_old >= 0),
  tag text,                          -- ej: "Destacado", "Edición Limitada"
  discount_label text,               -- ej: "-20% Socios"
  image_url text,
  active boolean not null default true,
  stock int,                         -- null = sin control de stock
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_active_idx on public.products(active);

-- ===== PEDIDOS =====
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending', -- pending | paid | rejected | cancelled
  total numeric(12,2) not null,
  items jsonb not null,              -- [{product_id, name, price, qty}]
  customer_name text,
  customer_email text,
  customer_phone text,
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_status_idx on public.orders(status);

-- ===== updated_at automático =====
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- ===== RLS =====
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

-- Lectura pública del catálogo (solo productos activos para anónimos)
drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories
  for select using (true);

drop policy if exists "public read active products" on public.products;
create policy "public read active products" on public.products
  for select using (active = true or auth.role() = 'authenticated');

-- Escritura solo para usuarios autenticados (el admin)
drop policy if exists "auth write categories" on public.categories;
create policy "auth write categories" on public.categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth write products" on public.products;
create policy "auth write products" on public.products
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Pedidos: solo el admin los lee/edita; se insertan desde el server (service role)
drop policy if exists "auth read orders" on public.orders;
create policy "auth read orders" on public.orders
  for select using (auth.role() = 'authenticated');

drop policy if exists "auth update orders" on public.orders;
create policy "auth update orders" on public.orders
  for update using (auth.role() = 'authenticated');

-- ===== STORAGE: bucket de imágenes de productos =====
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "public read product images" on storage.objects;
create policy "public read product images" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "auth manage product images" on storage.objects;
create policy "auth manage product images" on storage.objects
  for all using (bucket_id = 'product-images' and auth.role() = 'authenticated')
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

-- ===== SEED: categorías y productos actuales del sitio =====
insert into public.categories (name, slug, position) values
  ('Mates & Yerberas', 'mates', 1),
  ('Bolsos de Cuero', 'bolsos', 2),
  ('Cuchillos', 'cuchillos', 3)
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, description, price, price_old, tag, discount_label, image_url, position)
select c.id, p.name, p.slug, p.description, p.price, p.price_old, p.tag, p.discount_label, p.image_url, p.position
from (values
  ('mates', 'Mate Imperial de Alpaca', 'mate-imperial', 'Mate calabaza forrado con virola y base de alpaca cincelada a mano. Incluye bombilla pico de loro. Pieza de colección.', 96000, 120000, 'Destacado', '-20% Socios', '/images/mate-imperial.jpg', 1),
  ('mates', 'Set Yerbera + Azucarera', 'set-yerbera', 'Juego matero en cuero vacuno repujado con costura artesanal. Yerbera y azucarera a juego, con bandeja de madera dura.', 71250, 95000, 'Set Matero', '-25% Socios', '/images/set-yerbera.jpg', 2),
  ('cuchillos', 'Cuchillo Mango de Ciervo', 'cuchillo-ciervo', 'Hoja de acero forjado y mango de asta de ciervo natural. Incluye vaina de cuero repujado. Cada pieza es única.', 119000, 140000, 'Edición Limitada', '-15% Socios', '/images/cuchillo-ciervo.jpg', 3),
  ('bolsos', 'Bolso de Cuero Full Grain', 'bolso-cuero', 'Cuero vacuno full grain curtido al vegetal, costura a mano y herrajes de bronce. Resistente y atemporal.', 144000, 180000, 'Cuero Premium', '-20% Socios', '/images/bolso-cuero.jpg', 4),
  ('bolsos', 'Mochila de Cuero Artesanal', 'mochila-cuero', 'Mochila de cuero macizo con interior forrado y compartimento para notebook. Diseño robusto y elegante hecho a mano.', 172200, 210000, 'Cuero Premium', '-18% Socios', '/images/mochila-cuero.jpg', 5),
  ('mates', 'Combo Matero Completo', 'combo-matero', 'Mate, bombilla, termo y matera de cuero en un solo set de regalo. El combo ideal para regalar con el mayor descuento de socio.', 175000, 250000, 'Combo', '-30% Socios', '/images/combo-matero.jpg', 6)
) as p(cat_slug, name, slug, description, price, price_old, tag, discount_label, image_url, position)
join public.categories c on c.slug = p.cat_slug
on conflict (slug) do nothing;
