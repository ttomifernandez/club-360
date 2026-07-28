-- Bienestar Rural 360 · candado de los videotutoriales
-- Ejecutar en Supabase SQL Editor después de tutorials.sql.
--
-- Los videos los administra únicamente el desarrollador de la tienda. Ni un
-- usuario con rol "owner" puede editarlos o borrarlos: la regla compara el
-- email de la sesión y vive en la base, así que no se toca desde el panel.
-- Para sumar o cambiar administradores hay que editar la lista de acá abajo.

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'ttomifernandez@gmail.com'
  );
$$;

grant execute on function public.is_superadmin() to authenticated;

-- Lectura: todo el equipo con perfil activo.
drop policy if exists "Staff reads tutorials" on public.tutorials;
create policy "Staff reads tutorials" on public.tutorials for select
  using (public.current_role() is not null);

-- Alta, edición y borrado: solo el superadministrador.
drop policy if exists "Owner manages tutorials" on public.tutorials;
drop policy if exists "Superadmin manages tutorials" on public.tutorials;
create policy "Superadmin manages tutorials" on public.tutorials for all
  using (public.is_superadmin())
  with check (public.is_superadmin());
