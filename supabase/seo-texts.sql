-- Bienestar Rural 360 · textos de la sección "Nosotros + Preguntas frecuentes"
-- Ejecutar una sola vez en Supabase SQL Editor (después de site-texts.sql).
--
-- on conflict do nothing: si ya existen (o el dueño ya los editó), no se pisan.
-- Una pregunta con texto vacío oculta ese ítem en la tienda.

insert into public.site_texts (key, label, value, default_value, sort_order, multiline) values
  ('about_title', 'Nosotros · Título', 'Mates, cuchillos y cuero artesanal desde Córdoba', 'Mates, cuchillos y cuero artesanal desde Córdoba', 170, false),
  ('about_text',  'Nosotros · Texto', 'Bienestar Rural 360 es una tienda argentina especializada en mates artesanales, cuchillería criolla y marroquinería de cuero premium. Cada pieza está hecha a mano con materiales seleccionados y terminaciones de primera. Elegís en el catálogo, pagás online con Mercado Pago o coordinás tu pedido por WhatsApp, y lo recibís en cualquier punto del país.', 'Bienestar Rural 360 es una tienda argentina especializada en mates artesanales, cuchillería criolla y marroquinería de cuero premium. Cada pieza está hecha a mano con materiales seleccionados y terminaciones de primera. Elegís en el catálogo, pagás online con Mercado Pago o coordinás tu pedido por WhatsApp, y lo recibís en cualquier punto del país.', 180, true),
  ('faq_title',   'FAQ · Título', 'Preguntas frecuentes', 'Preguntas frecuentes', 190, false),
  ('faq1_q', 'FAQ 1 · Pregunta',  '¿Hacen envíos a todo el país?', '¿Hacen envíos a todo el país?', 200, false),
  ('faq1_a', 'FAQ 1 · Respuesta', 'Sí, enviamos a toda la Argentina. El costo y el plazo se coordinan al confirmar el pedido. También podés retirar en Córdoba o coordinar la entrega por WhatsApp.', 'Sí, enviamos a toda la Argentina. El costo y el plazo se coordinan al confirmar el pedido. También podés retirar en Córdoba o coordinar la entrega por WhatsApp.', 210, true),
  ('faq2_q', 'FAQ 2 · Pregunta',  '¿Qué medios de pago aceptan?', '¿Qué medios de pago aceptan?', 220, false),
  ('faq2_a', 'FAQ 2 · Respuesta', 'Podés pagar online con Mercado Pago (tarjetas de crédito, débito o dinero en cuenta) o coordinar el pago por WhatsApp al confirmar tu pedido.', 'Podés pagar online con Mercado Pago (tarjetas de crédito, débito o dinero en cuenta) o coordinar el pago por WhatsApp al confirmar tu pedido.', 230, true),
  ('faq3_q', 'FAQ 3 · Pregunta',  '¿Los productos son realmente artesanales?', '¿Los productos son realmente artesanales?', 240, false),
  ('faq3_a', 'FAQ 3 · Respuesta', 'Sí. Los mates, cuchillos y artículos de cuero se hacen a mano con materiales seleccionados. Por eso cada pieza puede tener pequeñas variaciones que la hacen única.', 'Sí. Los mates, cuchillos y artículos de cuero se hacen a mano con materiales seleccionados. Por eso cada pieza puede tener pequeñas variaciones que la hacen única.', 250, true),
  ('faq4_q', 'FAQ 4 · Pregunta',  '¿Cómo cuido los artículos de cuero?', '¿Cómo cuido los artículos de cuero?', 260, false),
  ('faq4_a', 'FAQ 4 · Respuesta', 'Guardalos secos y lejos del sol directo. Cada tanto, hidratá el cuero con crema o grasa específica para que conserve la flexibilidad y el color.', 'Guardalos secos y lejos del sol directo. Cada tanto, hidratá el cuero con crema o grasa específica para que conserve la flexibilidad y el color.', 270, true),
  ('faq5_q', 'FAQ 5 · Pregunta',  '¿Cómo se cura un mate de calabaza?', '¿Cómo se cura un mate de calabaza?', 280, false),
  ('faq5_a', 'FAQ 5 · Respuesta', 'Llenalo con yerba usada y agua caliente, dejalo reposar 24 horas y repetí el proceso una vez más. Después raspá suavemente el interior y ya está listo. Los mates de acero, vidrio o cerámica no necesitan curado.', 'Llenalo con yerba usada y agua caliente, dejalo reposar 24 horas y repetí el proceso una vez más. Después raspá suavemente el interior y ya está listo. Los mates de acero, vidrio o cerámica no necesitan curado.', 290, true)
on conflict (key) do nothing;
