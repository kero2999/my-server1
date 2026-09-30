-- QuadraLevel: FREE 1-HOUR TRIAL -> HONEST REVIEW -> 20 EGP / 10-DAY LAUNCH OFFER
-- Additive migration. Run once in Supabase SQL Editor after deploying the backend PR.
-- Existing users, trials, payments and enrollments are not rewritten.

begin;

alter table if exists campaign_settings
  add column if not exists launch_funnel_version text not null default 'legacy_paid_trial',
  add column if not exists free_trial_minutes integer not null default 60 check (free_trial_minutes between 1 and 1440),
  add column if not exists launch_slot_limit integer not null default 200 check (launch_slot_limit between 1 and 1000000);

alter table if exists campaign_review_requests
  add column if not exists launch_offer_eligible boolean not null default false,
  add column if not exists eligible_at timestamptz;

create table if not exists launch_offer_redemptions (
  id bigint generated always as identity primary key,
  campaign_key text not null references campaign_settings(campaign_key) on delete restrict,
  user_id bigint not null references users(id) on delete cascade,
  course_id bigint not null references courses(id) on delete restrict,
  payment_id bigint not null references payments(id) on delete restrict,
  slot_number integer not null,
  created_at timestamptz not null default now(),
  unique (campaign_key, user_id),
  unique (payment_id),
  unique (campaign_key, slot_number)
);

create index if not exists launch_offer_redemptions_course_idx
  on launch_offer_redemptions(course_id, campaign_key, created_at);

alter table launch_offer_redemptions enable row level security;
revoke all on table launch_offer_redemptions from anon, authenticated;

-- The lock on campaign_settings makes the count-and-insert atomic for the last slot.
create or replace function reserve_launch_offer_slot(
  p_campaign_key text,
  p_user_id bigint,
  p_course_id bigint,
  p_payment_id bigint
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
  v_slot integer;
  v_existing integer;
begin
  select launch_slot_limit into v_limit
  from campaign_settings
  where campaign_key = p_campaign_key
  for update;
  if v_limit is null then raise exception 'LAUNCH_CAMPAIGN_NOT_FOUND'; end if;

  select slot_number into v_existing
  from launch_offer_redemptions
  where campaign_key = p_campaign_key and user_id = p_user_id;
  if v_existing is not null then return v_existing; end if;

  if not exists (
    select 1 from payments
    where id = p_payment_id and user_id = p_user_id and course_id = p_course_id
      and payment_type = 'campaign_trial' and status = 'paid'
      and amount_cents = 2000 and upper(currency) = 'EGP'
  ) then
    raise exception 'LAUNCH_PAYMENT_NOT_VERIFIED';
  end if;

  select count(*)::integer into v_used
  from launch_offer_redemptions
  where campaign_key = p_campaign_key;
  if v_used >= v_limit then raise exception 'LAUNCH_SLOTS_EXHAUSTED'; end if;

  v_slot := v_used + 1;
  insert into launch_offer_redemptions(campaign_key, user_id, course_id, payment_id, slot_number)
  values (p_campaign_key, p_user_id, p_course_id, p_payment_id, v_slot);
  return v_slot;
exception
  when unique_violation then
    select slot_number into v_slot
    from launch_offer_redemptions
    where campaign_key = p_campaign_key and user_id = p_user_id;
    if v_slot is not null then return v_slot; end if;
    raise;
end;
$$;

revoke all on function reserve_launch_offer_slot(text, bigint, bigint, bigint) from public, anon, authenticated;

do $$
begin
  update campaign_settings
  set launch_funnel_version = 'free_hour_review_v1',
      free_trial_minutes = 60,
      launch_slot_limit = 200,
      price_cents = 2000,
      currency = 'EGP',
      duration_days = 10,
      updated_at = now()
  where campaign_key like '%10-day';
end $$;

commit;

-- Verification queries:
-- select campaign_key, launch_funnel_version, free_trial_minutes, launch_slot_limit, price_cents, duration_days from campaign_settings;
-- select count(*) as used_slots from launch_offer_redemptions;
