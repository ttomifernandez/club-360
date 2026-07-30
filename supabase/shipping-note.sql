-- Bienestar Rural 360 · aviso de costo de envío en el checkout
-- Ejecutar una sola vez en Supabase SQL Editor, después de site-texts.sql.
--
-- Texto que aparece en el checkout cuando el cliente elige "Envío a
-- domicilio", avisando que el costo del envío no está en el total y se
-- coordina por WhatsApp. Editable desde el panel → Textos.

insert into public.site_texts (key, label, value, default_value, sort_order, multiline) values
  ('shipping_note', 'Aviso de envío (aparece en el checkout al elegir "Envío a domicilio")', 'El costo de envío no está incluido en el precio y se coordina por WhatsApp una vez confirmado tu pedido, según tu ubicación.', 'El costo de envío no está incluido en el precio y se coordina por WhatsApp una vez confirmado tu pedido, según tu ubicación.', 95, true)
on conflict (key) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  multiline = excluded.multiline,
  default_value = excluded.default_value,
  value = case
    when public.site_texts.value = public.site_texts.default_value then excluded.value
    else public.site_texts.value
  end;

select key, label, value from public.site_texts where key = 'shipping_note';
