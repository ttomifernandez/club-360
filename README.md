# Club de Beneficios 360 — E-commerce

App de e-commerce del Club de Beneficios 360 (Plataforma Agropecuaria 360): catálogo dinámico, carrito, pagos con Mercado Pago y panel de administración.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind)
- **Supabase**: Postgres (productos, categorías, pedidos), Auth (login del admin) y Storage (imágenes)
- **Mercado Pago Checkout Pro**: pago online + webhook de notificaciones
- **Vercel**: hosting y deploy automático desde `main`

## Funcionalidades

- Storefront con catálogo desde la base de datos, filtros por categoría y carrito con `localStorage`
- Checkout doble: **Mercado Pago** (online) o **WhatsApp** (pedido manual)
- Panel `/admin` protegido con login: CRUD de productos y categorías (con subida de imágenes), gestión de pedidos y estados
- Webhook `/api/mp/webhook` que actualiza el estado del pedido cuando Mercado Pago confirma el pago

## Desarrollo

```bash
cp .env.example .env.local   # completar credenciales
npm install
npm run dev                  # http://localhost:3000
```

### Variables de entorno

Ver `.env.example`. Se necesitan las claves de Supabase (URL, anon key y service role) y el access token de Mercado Pago.

### Base de datos

El schema completo (tablas, RLS, bucket de imágenes y seed inicial) está en `supabase/schema.sql`. Ejecutarlo en el SQL Editor de Supabase.

### Usuario admin

Crear un usuario en Supabase → Authentication → Users (email + contraseña). Con eso se ingresa a `/admin`.

## Deploy

Conectado a Vercel: push a `main` actualiza producción. Configurar las variables de entorno del `.env.example` en el proyecto de Vercel.
