-- Bienestar Rural 360 · credenciales de cobro (Mercado Pago)
-- Ejecutar una sola vez en Supabase SQL Editor.
--
-- Las dos tablas quedan con RLS activo y SIN policies a propósito: nadie las
-- puede leer desde el navegador, ni siquiera el propietario. Solo el servidor
-- (service role, que evita RLS) las toca desde /api/mp-connect y /api/mp-callback.

create table if not exists public.payment_credentials (
  provider text primary key,
  mp_user_id text,
  nickname text,
  email text,
  access_token text not null,
  refresh_token text,
  public_key text,
  live_mode boolean,
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  connected_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Nonces de la autorización en curso: evitan que una autorización ajena
-- se enganche a esta tienda. Se borran al usarse o a los 15 minutos.
create table if not exists public.payment_oauth_state (
  state text primary key,
  code_verifier text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.payment_credentials enable row level security;
alter table public.payment_oauth_state enable row level security;

revoke all on public.payment_credentials from anon, authenticated;
revoke all on public.payment_oauth_state from anon, authenticated;
