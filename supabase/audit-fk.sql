-- Bienestar Rural 360 · permitir eliminar usuarios que ya operaron
-- Ejecutar una sola vez en Supabase SQL Editor.
--
-- audit_log.actor_id apuntaba a auth.users sin regla de borrado, así que
-- eliminar a alguien que había editado algo fallaba con un error de clave
-- foránea. Con "on delete set null" el registro de auditoría se conserva
-- (queda sin autor) y el usuario se puede dar de baja.

alter table public.audit_log drop constraint if exists audit_log_actor_id_fkey;
alter table public.audit_log
  add constraint audit_log_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;
