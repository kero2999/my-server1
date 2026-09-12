-- QuadraLevel: 10-Day Launch Trial for Marketing Launch
-- Additive migration. Run this script once in Supabase SQL Editor.
-- It does not delete, rewrite, or deactivate existing users, courses, payments, enrollments, trials, or reviews.

begin;

alter table if exists payments
  add column if not exists payment_type text not null default 'course_purchase';

alter table if exists payments
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if to_regclass('public.payments') is not null
     and not exists (
       select 1 from pg_constraint where conname = 'payments_payment_type_check'
     ) then
    alter table payments
      add constraint payments_payment_type_check
      check (payment_type in ('course_purchase', 'campaign_trial'));
  end if;
end $$;

create index if not exists payments_payment_type_idx
  on payments(payment_type, status);

create unique index if not exists payments_campaign_open_unique_idx
  on payments(user_id, course_id, (metadata->>'campaignKey'))
  where payment_type = 'campaign_trial' and status in ('pending', 'paid');

create table if not exists campaign_settings (
  id bigint generated always as identity primary key,
  campaign_key text not null unique,
  course_id bigint not null references courses(id) on delete restrict,
  enabled boolean not null default false,
  price_cents integer not null default 2000 check (price_cents > 0),
  currency text not null default 'EGP',
  duration_days integer not null default 10 check (duration_days between 1 and 365),
  normal_price_cents integer not null default 39900 check (normal_price_cents >= 0),
  normal_trial_minutes integer not null default 10 check (normal_trial_minutes between 0 and 1440),
  goal_subscribers integer not null default 1000 check (goal_subscribers >= 0),
  goal_reviews integer not null default 200 check (goal_reviews >= 0),
  review_enabled boolean not null default true,
  review_min_days integer not null default 1 check (review_min_days between 0 and 365),
  review_min_progress numeric(5,2) not null default 10 check (review_min_progress between 0 and 100),
  review_min_completed_lessons integer not null default 1 check (review_min_completed_lessons >= 0),
  reviews_require_moderation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, campaign_key)
);

create table if not exists campaign_trials (
  id bigint generated always as identity primary key,
  campaign_key text not null references campaign_settings(campaign_key) on delete restrict,
  user_id bigint not null references users(id) on delete cascade,
  course_id bigint not null references courses(id) on delete restrict,
  payment_id bigint not null references payments(id) on delete restrict,
  duration_days integer not null check (duration_days between 1 and 365),
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  started_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, campaign_key),
  unique (payment_id)
);

create index if not exists campaign_trials_course_status_idx
  on campaign_trials(course_id, status, expires_at);

create index if not exists campaign_trials_user_idx
  on campaign_trials(user_id, course_id);

create table if not exists campaign_review_requests (
  id bigint generated always as identity primary key,
  campaign_key text not null references campaign_settings(campaign_key) on delete restrict,
  user_id bigint not null references users(id) on delete cascade,
  course_id bigint not null references courses(id) on delete restrict,
  campaign_trial_id bigint references campaign_trials(id) on delete set null,
  status text not null default 'eligible' check (status in ('eligible', 'requested', 'submitted', 'dismissed')),
  eligible_at timestamptz,
  requested_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, campaign_key)
);

create index if not exists campaign_review_requests_course_status_idx
  on campaign_review_requests(course_id, status, updated_at desc);

alter table if exists course_reviews
  add column if not exists campaign_key text;

alter table if exists course_reviews
  add column if not exists review_request_id bigint;

do $$
begin
  if to_regclass('public.course_reviews') is not null
     and to_regclass('public.campaign_review_requests') is not null
     and not exists (
       select 1 from pg_constraint where conname = 'course_reviews_request_fk'
     ) then
    alter table course_reviews
      add constraint course_reviews_request_fk
      foreign key (review_request_id) references campaign_review_requests(id) on delete set null;
  end if;
end $$;

create index if not exists course_reviews_campaign_status_idx
  on course_reviews(campaign_key, status, created_at desc);

alter table if exists campaign_settings enable row level security;
alter table if exists campaign_trials enable row level security;
alter table if exists campaign_review_requests enable row level security;

revoke all on table campaign_settings from anon, authenticated;
revoke all on table campaign_trials from anon, authenticated;
revoke all on table campaign_review_requests from anon, authenticated;

-- Create the disabled configuration only for the published Marketing Launch course.
-- If the course row is not present yet, the backend stays in normal mode until an admin creates the row.
insert into campaign_settings (
  campaign_key,
  course_id,
  enabled,
  price_cents,
  currency,
  duration_days,
  normal_price_cents,
  normal_trial_minutes,
  goal_subscribers,
  goal_reviews,
  review_enabled,
  review_min_days,
  review_min_progress,
  review_min_completed_lessons,
  reviews_require_moderation
)
select
  'marketing-launch-10-day',
  c.id,
  false,
  2000,
  coalesce(c.currency, 'EGP'),
  10,
  39900,
  10,
  1000,
  200,
  true,
  1,
  10,
  1,
  true
from courses c
where c.slug = 'marketing-launch'
  and c.status = 'published'
on conflict (campaign_key) do nothing;

commit;
