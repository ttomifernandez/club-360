-- Bienestar Rural 360 · reparación de acentos corruptos
-- Textos pegados con el portapapeles roto quedaron como "Edici√≥n" en vez de
-- "Edición". Este script recorre todas las columnas de texto de las tablas
-- públicas y repara las secuencias dañadas. Se puede correr más de una vez.
-- Al final muestra qué tablas y columnas tenían filas afectadas.

create or replace function pg_temp.arregla(v text) returns text
language plpgsql immutable as $f$
declare p record;
begin
  for p in select * from (values
    -- doble corrupción (por si un texto pasó dos veces por el portapapeles roto)
    ('‚àö','√'),('‚â•','≥'),
    -- minúsculas
    ('√°','á'),('√©','é'),('√≠','í'),('√≥','ó'),('√∫','ú'),('√±','ñ'),('√º','ü'),
    -- mayúsculas
    ('√Å','Á'),('√â','É'),('√ç','Í'),('√ì','Ó'),('√ö','Ú'),('√ë','Ñ'),('√ú','Ü'),
    -- signos
    ('¬ø','¿'),('¬°','¡'),('¬∞','°'),('¬∫','º'),('¬™','ª'),
    -- guiones, comillas y puntos suspensivos tipográficos
    ('‚Äì','–'),('‚Äî','—'),('‚Äô','’'),('‚Äò','‘'),('‚Äú','“'),('‚Äù','”'),('‚Ä¶','…'),('‚Ä¢','•')
  ) as m(malo, bueno) loop
    v := replace(v, p.malo, p.bueno);
  end loop;
  return v;
end $f$;

drop table if exists reporte_acentos;
create temp table reporte_acentos (tabla text, columna text, filas integer);

do $$
declare
  col record;
  n integer;
begin
  for col in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.is_updatable = 'YES'
      and c.data_type in ('text', 'character varying')
      and c.table_name not in ('audit_log', 'payment_oauth_state', 'payment_credentials')
  loop
    execute format(
      'update public.%I set %I = pg_temp.arregla(%I) where %I ~ ''√|¬|‚Ä''',
      col.table_name, col.column_name, col.column_name, col.column_name);
    get diagnostics n = row_count;
    if n > 0 then
      insert into reporte_acentos values (col.table_name, col.column_name, n);
    end if;
  end loop;
end $$;

select * from reporte_acentos order by tabla, columna;
