-- Separate from payments/enrollments: sandbox activity cannot inflate revenue.
create table if not exists public.payment_sandbox_sessions (
  id uuid primary key,
  user_id text not null,
  merchant_order_id text not null unique,
  provider_order_id text unique,
  provider_transaction_id text,
  integration_id bigint not null,
  amount_cents integer not null check (amount_cents = 100),
  currency text not null default 'EGP' check (currency = 'EGP'),
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_sandbox_sessions enable row level security;
revoke all on public.payment_sandbox_sessions from anon, authenticated;
-- Backend service_role only; no browser-facing RLS policies.
