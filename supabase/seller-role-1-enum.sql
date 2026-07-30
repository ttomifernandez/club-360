-- Bienestar Rural 360 · rol "Vendedor" (1/2: agregar el valor al enum)
-- Ejecutar SOLO y a solas en el SQL Editor, antes que seller-role-2.sql.
-- Postgres no permite usar un valor de enum nuevo en el mismo bloque en que
-- se lo crea, así que este paso va separado.

alter type public.app_role add value if not exists 'seller';
