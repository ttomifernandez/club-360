-- Bienestar Rural 360 · ficha de clientes
-- Ejecutar una sola vez en Supabase SQL Editor.
--
-- Cada pedido alimenta la ficha del cliente automáticamente. El teléfono se
-- normaliza (solo dígitos, últimos 10) para que "+54 9 351 5929043",
-- "0351 15 592 9043" y "3515929043" sean el mismo cliente.

create or replace function public.normalize_phone(p text) returns text
language sql immutable
as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10), '');
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  phone_key text not null unique,
  phone text not null,
  name text not null,
  email text,
  address text,
  notes text,
  first_order_at timestamptz not null default now(),
  last_order_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_last_order_idx on public.customers (last_order_at desc);

alter table public.customers enable row level security;

drop policy if exists "Staff reads customers" on public.customers;
create policy "Staff reads customers" on public.customers for select
  using (public.current_role() in ('owner', 'operator', 'support', 'auditor'));

drop policy if exists "Owner and operator update customers" on public.customers;
create policy "Owner and operator update customers" on public.customers for update
  using (public.current_role() in ('owner', 'operator'))
  with check (public.current_role() in ('owner', 'operator'));

drop policy if exists "Owner deletes customers" on public.customers;
create policy "Owner deletes customers" on public.customers for delete
  using (public.current_role() = 'owner');

-- Al registrarse un pedido, se crea o actualiza la ficha del cliente.
create or replace function public.sync_customer() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_key text := public.normalize_phone(new.customer_phone);
begin
  if v_key is null then return new; end if;
  insert into public.customers (phone_key, phone, name, email, address, first_order_at, last_order_at)
  values (v_key, new.customer_phone, new.customer_name, nullif(new.customer_email, ''), new.shipping_address, new.created_at, new.created_at)
  on conflict (phone_key) do update set
    name = excluded.name,
    phone = excluded.phone,
    -- Nunca perdemos un email ya conocido si el pedido nuevo no lo trae.
    email = coalesce(excluded.email, public.customers.email),
    address = coalesce(excluded.address, public.customers.address),
    first_order_at = least(public.customers.first_order_at, excluded.first_order_at),
    last_order_at = greatest(public.customers.last_order_at, excluded.last_order_at),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_sync_customer on public.orders;
create trigger orders_sync_customer after insert on public.orders
for each row execute function public.sync_customer();

-- Carga inicial con los pedidos que ya existen.
insert into public.customers (phone_key, phone, name, email, address, first_order_at, last_order_at)
select
  public.normalize_phone(o.customer_phone),
  (array_agg(o.customer_phone order by o.created_at desc))[1],
  (array_agg(o.customer_name order by o.created_at desc))[1],
  (array_agg(o.customer_email order by o.created_at desc) filter (where nullif(o.customer_email, '') is not null))[1],
  (array_agg(o.shipping_address order by o.created_at desc) filter (where o.shipping_address is not null))[1],
  min(o.created_at),
  max(o.created_at)
from public.orders o
where public.normalize_phone(o.customer_phone) is not null
group by public.normalize_phone(o.customer_phone)
on conflict (phone_key) do nothing;
