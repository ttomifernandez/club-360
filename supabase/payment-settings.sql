-- Bienestar Rural 360 · opciones de cobro
-- Ejecutar una sola vez en Supabase SQL Editor después de payments.sql.
-- Igual que las credenciales: RLS activo y sin policies, solo el servidor lee.

create table if not exists public.payment_settings (
  provider text primary key,
  max_installments integer not null default 6 check (max_installments between 1 and 24),
  accept_cash boolean not null default false,      -- Rapipago, Pago Fácil
  accept_credit boolean not null default true,
  accept_debit boolean not null default true,
  binary_mode boolean not null default true,       -- aprobado o rechazado, sin "pendiente"
  updated_at timestamptz not null default now()
);

alter table public.payment_settings enable row level security;
revoke all on public.payment_settings from anon, authenticated;

insert into public.payment_settings (provider) values ('mercadopago')
  on conflict (provider) do nothing;
