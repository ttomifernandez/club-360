-- Bienestar Rural 360 · videotutoriales del panel
-- Ejecutar una sola vez en Supabase SQL Editor.
-- Todo el equipo los ve; solo el propietario los carga y edita.

create table if not exists public.tutorials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  video_url text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tutorials enable row level security;

drop policy if exists "Staff reads tutorials" on public.tutorials;
create policy "Staff reads tutorials" on public.tutorials for select
  using (public.current_role() is not null);

drop policy if exists "Owner manages tutorials" on public.tutorials;
create policy "Owner manages tutorials" on public.tutorials for all
  using (public.current_role() = 'owner')
  with check (public.current_role() = 'owner');

drop trigger if exists tutorials_updated_at on public.tutorials;
create trigger tutorials_updated_at before update on public.tutorials
for each row execute function public.set_updated_at();
