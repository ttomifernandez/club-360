-- Bienestar Rural 360 · permiso individual para gestionar inscriptos de cursos
-- Ejecutar una sola vez en Supabase SQL Editor, después de course-leads.sql.
--
-- Por defecto solo el owner puede exportar y eliminar inscriptos. El owner
-- puede además delegárselo a un colaborador puntual (sin darle el rol
-- Operador completo) tildando su casillero en el panel → Usuarios.

alter table public.profiles
  add column if not exists can_manage_leads boolean not null default false;

create or replace function public.can_manage_course_leads() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true and (role = 'owner' or can_manage_leads = true)
  )
$$;

-- Hasta ahora no había forma de borrar un inscripto (solo insert + select).
create policy "Owner or delegated staff delete course leads" on public.course_leads for delete
  using (public.can_manage_course_leads());

select id, full_name, role, can_manage_leads from public.profiles order by created_at;
