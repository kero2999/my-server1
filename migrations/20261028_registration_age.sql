alter table public.users add column if not exists minimum_age_confirmed smallint;
alter table public.users add column if not exists age_confirmed_at timestamptz;
-- Existing accounts remain unknown; do not backfill an assertion they never made.
comment on column public.users.minimum_age_confirmed is 'Minimum age self-attested at registration, not verified age or date of birth';

alter table public.users add column if not exists terms_accepted_at timestamptz;
alter table public.users add column if not exists terms_version text;
alter table public.users add column if not exists privacy_version text;
alter table public.users add column if not exists refund_policy_version text;
-- Existing users remain NULL: do not invent historical acceptance.
