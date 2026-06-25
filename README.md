# Club de Beneficios — Plataforma Agropecuaria 360

Catálogo web ultrapremium del Club de Beneficios 360: mates y yerberas, bolsos de cuero y cuchillería artesanal con precios especiales para socios.

## Características

- Sitio estático (HTML + CSS + JS vanilla, sin dependencias)
- **Carrito de compras funcional**: agregar, cantidades, eliminar, total estimado y persistencia en `localStorage`
- Finalización de pedido por **WhatsApp** (mensaje armado con el detalle del pedido)
- Filtros por categoría, animaciones on-scroll, navbar glass, marquee
- Imágenes generadas con [Pollinations.ai](https://pollinations.ai) y servidas localmente
- 100% responsive

## Desarrollo

Es un sitio estático. Para verlo localmente:

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Deploy

Desplegado en Vercel como sitio estático. Push a `main` actualiza producción.
