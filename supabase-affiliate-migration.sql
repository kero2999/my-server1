-- QuadraLevel Affiliate MVP
-- Run once in Supabase SQL Editor after reviewing.
begin;

create table if not exists affiliates (
  id bigint generated always as identity primary key,
  name text not null,
  affiliate_code text not null unique,
  platform text not null default 'Other',
  profile_url text,
  trial_commission_rate numeric(5,2) not null default 100 check (trial_commission_rate >= 0 and trial_commission_rate <= 100),
  purchase_commission_rate numeric(5,2) not null default 25 check (purchase_commission_rate >= 0 and purchase_commission_rate <= 100),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table if not exists affiliate_attributions (
  user_id bigint primary key references users(id) on delete cascade,
  affiliate_id bigint not null references affiliates(id) on delete restrict,
  clicked_at timestamptz not null default now()
);

create table if not exists affiliate_events (
  id bigint generated always as identity primary key,
  affiliate_id bigint not null references affiliates(id) on delete restrict,
  user_id bigint references users(id) on delete set null,
  event_type text not null check (event_type in ('affiliate_visit', 'affiliate_registration', 'affiliate_trial', 'affiliate_purchase')),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  transaction_id text,
  dedupe_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists affiliate_commissions (
  id bigint generated always as identity primary key,
  affiliate_id bigint not null references affiliates(id) on delete restrict,
  user_id bigint not null references users(id) on delete cascade,
  course_id bigint not null references courses(id) on delete restrict,
  payment_id bigint not null references payments(id) on delete restrict,
  transaction_id text not null unique,
  event_type text not null check (event_type in ('affiliate_trial', 'affiliate_purchase')),
  amount_cents integer not null check (amount_cents >= 0),
  commission_rate numeric(5,2) not null check (commission_rate >= 0 and commission_rate <= 100),
  commission_amount_cents integer not null check (commission_amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists affiliate_events_affiliate_type_idx on affiliate_events(affiliate_id, event_type);
create index if not exists affiliate_events_user_idx on affiliate_events(user_id);
create index if not exists affiliate_commissions_affiliate_idx on affiliate_commissions(affiliate_id, status);
create unique index if not exists affiliate_commissions_payment_uidx on affiliate_commissions(payment_id);
create index if not exists affiliate_attributions_affiliate_idx on affiliate_attributions(affiliate_id);

commit;
