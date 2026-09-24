-- QuadraLevel audit events: run once in Supabase SQL Editor.
create table if not exists public.audit_events (
  id bigserial primary key,
  event_type text not null,
  action text not null,
  user_id bigint references public.users(id) on delete set null,
  course_id bigint references public.courses(id) on delete set null,
  status text not null default 'success',
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text,
  user_agent text,
  path text,
  method text,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_created_at_idx on public.audit_events (created_at desc);
create index if not exists audit_events_event_type_idx on public.audit_events (event_type, created_at desc);
create index if not exists audit_events_user_id_idx on public.audit_events (user_id, created_at desc);
create index if not exists audit_events_course_id_idx on public.audit_events (course_id, created_at desc);
create index if not exists audit_events_status_idx on public.audit_events (status, created_at desc);
alter table public.audit_events enable row level security;
