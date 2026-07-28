-- Bienestar Rural 360 · galería y video por producto
-- Ejecutar una sola vez en Supabase SQL Editor.
--
-- gallery: hasta 5 fotos en orden; la primera es la portada y se refleja en
-- image_url para no romper nada de lo que ya la usaba.
-- video_url: link de YouTube (se guarda tal cual, la tienda extrae el id).

alter table public.products
  add column if not exists gallery jsonb not null default '[]'::jsonb,
  add column if not exists video_url text;

-- Como máximo 5 imágenes por producto.
alter table public.products drop constraint if exists products_gallery_max;
alter table public.products
  add constraint products_gallery_max
  check (jsonb_typeof(gallery) = 'array' and jsonb_array_length(gallery) <= 5);

-- Los productos que ya existen arrancan con su foto actual como portada.
update public.products
  set gallery = jsonb_build_array(image_url)
  where jsonb_array_length(gallery) = 0 and coalesce(image_url, '') <> '';
