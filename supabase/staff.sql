-- Bienestar Rural 369 · staff y usuarios del panel
-- Ejecutar una sola vez en Supabase SQL Editor. Idempotente.

-- 1) El staff puede LEER cupones (la gestión sigue siendo solo del owner).
--    Sin esto, el login del panel se rompía para roles no-owner.
drop policy if exists "Staff reads coupons" on public.coupons;
create policy "Staff reads coupons" on public.coupons for select
  using (public.current_role() in ('owner', 'operator', 'catalog', 'support', 'auditor'));

-- 2) Alta automática de perfil al crear un usuario en Supabase Auth
--    (invitación o registro). Nace sin acceso (active = false) y con el rol
--    más bajo; el owner lo habilita desde la sección Usuarios del panel.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.email, 'Usuario'),
    'support',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
