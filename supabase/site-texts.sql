-- Bienestar Rural 360 · textos editables de la home
-- Ejecutar una sola vez en Supabase SQL Editor.
--
-- Cada texto guarda su valor actual y el original. El botón "restaurar" del
-- panel copia el original sobre el actual, así nunca se pierde el de fábrica.

create table if not exists public.site_texts (
  key text primary key,
  label text not null,
  value text not null,
  default_value text not null,
  sort_order integer not null default 0,
  multiline boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.site_texts enable row level security;

-- La tienda los lee sin sesión; editarlos es solo del propietario.
drop policy if exists "Anyone reads site texts" on public.site_texts;
create policy "Anyone reads site texts" on public.site_texts for select using (true);

drop policy if exists "Owner manages site texts" on public.site_texts;
create policy "Owner manages site texts" on public.site_texts for all
  using (public.current_role() = 'owner')
  with check (public.current_role() = 'owner');

drop trigger if exists site_texts_updated_at on public.site_texts;
create trigger site_texts_updated_at before update on public.site_texts
for each row execute function public.set_updated_at();

-- Textos actuales de la home. Si ya existen, se conserva lo editado y solo
-- se actualiza el original de referencia.
insert into public.site_texts (key, label, value, default_value, sort_order, multiline) values
  ('nav_cta',          'Botón del menú',                  'Solicitar Info', 'Solicitar Info', 10, false),
  ('hero_badge',       'Etiqueta sobre el título',        'Bienestar Rural 360', 'Bienestar Rural 360', 20, false),
  ('hero_title',       'Título principal',                'ESENCIA RURAL', 'ESENCIA RURAL', 30, false),
  ('hero_title_alt',   'Título principal (segunda línea)','CALIDAD PREMIUM', 'CALIDAD PREMIUM', 40, false),
  ('hero_subtitle',    'Texto bajo el título',            'Mates, accesorios rurales, cuchillería artesanal y artículos de cuero premium. Dos líneas que comparten calidad, identidad de campo y terminaciones excepcionales.', 'Mates, accesorios rurales, cuchillería artesanal y artículos de cuero premium. Dos líneas que comparten calidad, identidad de campo y terminaciones excepcionales.', 50, true),
  ('hero_cta',         'Botón del inicio',                'VER BENEFICIOS', 'VER BENEFICIOS', 60, false),
  ('catalog_title',    'Título del catálogo',             'El mundo de Bienestar Rural', 'El mundo de Bienestar Rural', 70, false),
  ('catalog_subtitle', 'Texto del catálogo',              'Productos para disfrutar la vida rural y piezas de cuero premium hechas para durar. Agregá al carrito y finalizá tu pedido por WhatsApp.', 'Productos para disfrutar la vida rural y piezas de cuero premium hechas para durar. Agregá al carrito y finalizá tu pedido por WhatsApp.', 80, true),
  ('cart_note',        'Aviso del carrito',               'Confirmá tus datos y registrá el pedido. El pago y el envío se coordinan a continuación.', 'Confirmá tus datos y registrá el pedido. El pago y el envío se coordinan a continuación.', 90, true),
  ('cta_title',        'Título del bloque final',         'Viví el estilo', 'Viví el estilo', 100, false),
  ('cta_title_alt',    'Título del bloque final (resaltado)', 'Bienestar Rural', 'Bienestar Rural', 110, false),
  ('cta_text',         'Texto del bloque final',          'Accedé a lanzamientos, piezas seleccionadas y beneficios especiales en toda la colección de Bienestar Rural 360.', 'Accedé a lanzamientos, piezas seleccionadas y beneficios especiales en toda la colección de Bienestar Rural 360.', 120, true),
  ('cta_button',       'Botón del bloque final',          'QUIERO CONOCER MÁS', 'QUIERO CONOCER MÁS', 130, false),
  ('wa_info_message',  'Mensaje de WhatsApp del botón final', '¡Hola! Quiero conocer más sobre Bienestar Rural 360 y sus beneficios.', '¡Hola! Quiero conocer más sobre Bienestar Rural 360 y sus beneficios.', 140, true),
  ('footer_text',      'Pie de página',                   '© 2026 BIENESTAR RURAL 360.', '© 2026 BIENESTAR RURAL 360.', 150, false),
  ('footer_location',  'Ubicación en el pie',             'Córdoba, Argentina', 'Córdoba, Argentina', 160, false)
on conflict (key) do update set
  label = excluded.label,
  default_value = excluded.default_value,
  sort_order = excluded.sort_order,
  multiline = excluded.multiline,
  -- Solo se pisa el texto en uso si nadie lo editó todavía: así este archivo
  -- se puede volver a correr sin borrar los cambios del panel.
  value = case
    when public.site_texts.value = public.site_texts.default_value then excluded.value
    else public.site_texts.value
  end;

select key, label, left(value, 45) as valor from public.site_texts order by sort_order;
