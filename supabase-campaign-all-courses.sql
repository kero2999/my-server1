-- QuadraLevel: apply the existing 20 EGP / 10-day campaign to the other published courses.
-- Run after supabase-campaign-launch-migration.sql in Supabase SQL Editor.
-- This adds or updates only campaign_settings rows. It does not alter existing trials,
-- payments, enrollments, reviews, course content, or the Marketing Launch row.

begin;

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
  'marketing-growth-10-day',
  c.id,
  true,
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
where c.slug = 'marketing-growth' and c.status = 'published'
on conflict (campaign_key) do update set
  course_id = excluded.course_id,
  enabled = excluded.enabled,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  duration_days = excluded.duration_days,
  normal_price_cents = excluded.normal_price_cents,
  normal_trial_minutes = excluded.normal_trial_minutes,
  updated_at = now();

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
  'marketing-mastery-10-day',
  c.id,
  true,
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
where c.slug = 'marketing-mastery' and c.status = 'published'
on conflict (campaign_key) do update set
  course_id = excluded.course_id,
  enabled = excluded.enabled,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  duration_days = excluded.duration_days,
  normal_price_cents = excluded.normal_price_cents,
  normal_trial_minutes = excluded.normal_trial_minutes,
  updated_at = now();

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
  'marketing-leadership-10-day',
  c.id,
  true,
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
where c.slug = 'marketing-leadership' and c.status = 'published'
on conflict (campaign_key) do update set
  course_id = excluded.course_id,
  enabled = excluded.enabled,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  duration_days = excluded.duration_days,
  normal_price_cents = excluded.normal_price_cents,
  normal_trial_minutes = excluded.normal_trial_minutes,
  updated_at = now();

commit;

-- Verification:
-- select c.slug, s.campaign_key, s.enabled, s.price_cents, s.duration_days
-- from campaign_settings s join courses c on c.id = s.course_id
-- where s.campaign_key in ('marketing-launch-10-day','marketing-growth-10-day','marketing-mastery-10-day','marketing-leadership-10-day')
-- order by c.slug;
