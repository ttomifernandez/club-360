# Bienestar Rural 369

Catálogo de productos rurales, mates y cuchillería artesanal junto con una línea de artículos de cuero premium.

## Características

- Sitio estático (HTML + CSS + JS vanilla, sin dependencias)
- **Carrito de compras funcional**: agregar, cantidades, eliminar, total estimado y persistencia en `localStorage`
- Finalización de pedido por **WhatsApp** (mensaje armado con el detalle del pedido)
- Filtros por categoría, animaciones on-scroll, navbar glass, marquee
- Imágenes generadas con [Pollinations.ai](https://pollinations.ai) y servidas localmente
- 100% responsive
- Panel administrativo inicial en `/admin`
- Gestión demostrable de productos, categorías, precios, stock y publicación
- Esquema inicial de Supabase en `supabase/schema.sql`

## Estado del panel

El panel funciona actualmente en modo demostración y guarda sus cambios en
`localStorage`, por lo que permite probar el flujo completo desde el mismo
navegador. No debe usarse todavía como panel de producción.

El siguiente paso es crear el proyecto de Supabase, ejecutar el esquema incluido
y conectar autenticación, políticas RLS y persistencia compartida.

## Desarrollo

Es un sitio estático. Para verlo localmente:

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Deploy

Desplegado en Vercel como sitio estático. Push a `main` actualiza producción.
