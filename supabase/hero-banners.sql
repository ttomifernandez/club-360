-- Bienestar Rural 360 · banners del inicio
-- Ejecutar una sola vez en Supabase SQL Editor.
--
-- Tres espacios editables desde el panel. Cada uno puede tener imagen propia
-- o usar el fondo del campo, y se prende o apaga sin tocar código.

create table if not exists public.hero_banners (
  id uuid primary key default gen_random_uuid(),
  slot integer not null unique check (slot between 1 and 3),
  kicker text not null default '',
  title text not null default '',
  title_alt text not null default '',
  text text not null default '',
  cta_label text not null default '',
  cta_link text not null default '#catalogo',
  image_url text,
  active boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.hero_banners enable row level security;

drop policy if exists "Anyone reads active banners" on public.hero_banners;
create policy "Anyone reads active banners" on public.hero_banners for select
  using (active = true or public.current_role() is not null);

drop policy if exists "Owner manages banners" on public.hero_banners;
create policy "Owner manages banners" on public.hero_banners for all
  using (public.current_role() = 'owner')
  with check (public.current_role() = 'owner');

drop trigger if exists hero_banners_updated_at on public.hero_banners;
create trigger hero_banners_updated_at before update on public.hero_banners
for each row execute function public.set_updated_at();

-- El primero reproduce el inicio actual, así nada cambia hasta que lo edites.
insert into public.hero_banners (slot, kicker, title, title_alt, text, cta_label, cta_link, active) values
  (1, 'Bienestar Rural 360', 'ESENCIA RURAL', 'CALIDAD PREMIUM',
      'Mates, accesorios rurales, cuchillería artesanal y artículos de cuero premium.',
      'VER BENEFICIOS', '#catalogo', true),
  (2, '', '', '', '', 'VER CATÁLOGO', '#catalogo', false),
  (3, '', '', '', '', 'VER CATÁLOGO', '#catalogo', false)
on conflict (slot) do nothing;

select slot, active, left(title, 30) as titulo from public.hero_banners order by slot;
