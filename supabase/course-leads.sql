-- Bienestar Rural 360 · leads de la plataforma de cursos (sitio externo)
-- Ejecutar una sola vez en Supabase SQL Editor, después de schema.sql y site-texts.sql.
--
-- El botón "ACCEDER A CAPACITACIONES" vive en otro sitio, estático y sin
-- backend propio (plataformaagropecuaria360.com). Antes de redirigir a la
-- plataforma de cursos pide nombre y teléfono; ese formulario inserta acá
-- con la misma anon key pública que usa la tienda (RLS es la barrera real,
-- no la key). El owner ve los inscriptos desde el panel → Cursos.

create table public.course_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  source text not null default 'plataforma-cursos',
  created_at timestamptz not null default now()
);

alter table public.course_leads enable row level security;

create policy "Anyone registers a course lead" on public.course_leads for insert
  to anon, authenticated
  with check (
    length(trim(name)) between 2 and 120
    and length(regexp_replace(phone, '\D', '', 'g')) between 8 and 15
  );

create policy "Staff reads course leads" on public.course_leads for select
  using (public.current_role() in ('owner','operator','support','auditor'));

-- URL de la plataforma de cursos a la que se redirige después del
-- formulario. Editable desde el panel → Configuración → Textos de la home.
insert into public.site_texts (key, label, value, default_value, sort_order, multiline) values
  ('course_platform_url', 'URL de la plataforma de cursos (redirección después del formulario de nombre/teléfono)', 'https://asesorrural.com.ar', 'https://asesorrural.com.ar', 6, false)
on conflict (key) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  multiline = excluded.multiline,
  default_value = excluded.default_value,
  value = case
    when public.site_texts.value = public.site_texts.default_value then excluded.value
    else public.site_texts.value
  end;

select key, label, value from public.site_texts where key = 'course_platform_url';
select count(*) as leads_existentes from public.course_leads;
