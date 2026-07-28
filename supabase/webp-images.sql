-- Bienestar Rural 360 · las imágenes locales del catálogo ahora son WebP
-- (pesan la mitad). Actualiza los productos que apuntaban a los .jpg viejos.
-- Ejecutar una sola vez en Supabase SQL Editor.

update public.products
set image_url = replace(image_url, '.jpg', '.webp')
where image_url like 'images/%.jpg';
