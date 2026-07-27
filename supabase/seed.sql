-- Ejecutar después de schema.sql para cargar el catálogo inicial.
insert into public.categories (id, name, slug, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'Mates & Yerberas', 'mates', 10),
  ('00000000-0000-4000-8000-000000000002', 'Cuchillos', 'cuchillos', 20),
  ('00000000-0000-4000-8000-000000000003', 'Bolsos de Cuero', 'bolsos', 30)
on conflict (id) do nothing;

insert into public.products
  (id, category_id, name, slug, description, image_url, price, list_price, stock, active, metadata)
values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Mate Imperial de Alpaca','mate-imperial','Mate calabaza forrado con virola y base de alpaca cincelada a mano. Incluye bombilla pico de loro.','images/mate-imperial.jpg',96000,120000,8,true,'{"tag":"Destacado","discount":"-20% Socios"}'),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Set Yerbera + Azucarera','set-yerbera','Juego matero en cuero vacuno repujado con costura artesanal.','images/set-yerbera.jpg',71250,95000,12,true,'{"tag":"Set Matero","discount":"-25% Socios"}'),
  ('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','Cuchillo Mango de Ciervo','cuchillo-ciervo','Hoja de acero forjado y mango de asta de ciervo natural.','images/cuchillo-ciervo.jpg',119000,140000,3,true,'{"tag":"Edición Limitada","discount":"-15% Socios"}'),
  ('10000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000003','Bolso de Cuero Full Grain','bolso-cuero','Cuero vacuno full grain curtido al vegetal y herrajes de bronce.','images/bolso-cuero.jpg',144000,180000,5,true,'{"tag":"Cuero Premium","discount":"-20% Socios"}'),
  ('10000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000003','Mochila de Cuero Artesanal','mochila-cuero','Mochila de cuero macizo con interior forrado y compartimento para notebook.','images/mochila-cuero.jpg',172200,210000,4,true,'{"tag":"Cuero Premium","discount":"-18% Socios"}'),
  ('10000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','Combo Matero Completo','combo-matero','Mate, bombilla, termo y matera de cuero en un solo set de regalo.','images/combo-matero.jpg',175000,250000,7,true,'{"tag":"Combo","discount":"-30% Socios"}')
on conflict (id) do nothing;
