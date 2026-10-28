alter table public.users
  add column if not exists session_replay_consent boolean not null default false,
  add column if not exists session_replay_adult_confirmed boolean not null default false,
  add column if not exists session_replay_consent_at timestamptz,
  add column if not exists session_replay_notice_version text;
-- Unknown/old accounts are not assumed to have consented.
