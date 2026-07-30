-- Bienestar Rural 360 · número de WhatsApp editable desde el panel
-- Ejecutar una sola vez en Supabase SQL Editor, después de site-texts.sql.
--
-- Hasta ahora el número estaba escrito a mano en el código (index.html,
-- seguimiento.html, 404.html, llms.txt). Este texto es el que usan la tienda
-- y la página de seguimiento del pedido; se edita desde el panel → Textos,
-- igual que cualquier otro texto de la home. 404.html y llms.txt quedan
-- estáticos (páginas de muy poco tráfico): si el número cambia, actualizarlos
-- a mano.

insert into public.site_texts (key, label, value, default_value, sort_order, multiline) values
  ('whatsapp_number', 'Número de WhatsApp de la tienda (código de país + área + número, sin +, sin espacios ni guiones. Ej: 5493515227465)', '5493515227465', '5493515227465', 5, false)
on conflict (key) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  multiline = excluded.multiline,
  default_value = excluded.default_value,
  -- Solo se pisa el valor en uso si nadie lo cambió todavía, para poder
  -- volver a correr este archivo sin perder un número ya editado.
  value = case
    when public.site_texts.value = public.site_texts.default_value then excluded.value
    else public.site_texts.value
  end;

select key, label, value from public.site_texts where key = 'whatsapp_number';
