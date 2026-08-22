-- Quadra Level Marketplace migration
-- Run after the existing supabase-schema.sql.
-- This migration is additive and does not delete existing users or data.

alter table if exists users
  add column if not exists role text not null default 'user';

alter table if exists users
  drop constraint if exists users_role_check;

alter table if exists users
  add constraint users_role_check check (role in ('user', 'admin'));

create table if not exists categories (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists courses (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  description text not null default '',
  thumbnail_url text,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'EGP',
  category_id bigint references categories(id) on delete set null,
  instructor text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  trial_minutes integer not null default 10 check (trial_minutes between 0 and 1440),
  content_bucket text,
  content_prefix text,
  entry_file text not null default 'index.html',
  current_version_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists course_versions (
  id bigint generated always as identity primary key,
  course_id bigint not null references courses(id) on delete cascade,
  version_label text not null,
  storage_bucket text not null,
  storage_prefix text not null,
  original_zip_path text,
  manifest jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (course_id, version_label)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'courses_current_version_fk'
  ) then
    alter table courses
      add constraint courses_current_version_fk
      foreign key (current_version_id) references course_versions(id) on delete set null;
  end if;
end $$;

create table if not exists enrollments (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  course_id bigint not null references courses(id) on delete cascade,
  status text not null default 'active' check (status in ('pending', 'active', 'revoked')),
  source text not null default 'paymob',
  payment_id bigint,
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists payments (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  course_id bigint not null references courses(id) on delete restrict,
  merchant_order_id text not null unique,
  provider text not null default 'paymob',
  provider_order_id text,
  provider_transaction_id text unique,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'EGP',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  raw_callback jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'enrollments_payment_fk'
  ) then
    alter table enrollments
      add constraint enrollments_payment_fk
      foreign key (payment_id) references payments(id) on delete set null;
  end if;
end $$;

create table if not exists course_trials (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  course_id bigint not null references courses(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  starts_count integer not null default 1,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists lessons (
  id bigint generated always as identity primary key,
  course_id bigint not null references courses(id) on delete cascade,
  lesson_key text not null,
  title text not null default '',
  position integer not null default 0,
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  unique (course_id, lesson_key)
);

create table if not exists course_progress (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  course_id bigint not null references courses(id) on delete cascade,
  lesson_id bigint references lessons(id) on delete cascade,
  lesson_key text not null,
  progress numeric(5,2) not null default 0 check (progress between 0 and 100),
  completed boolean not null default false,
  last_position jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, course_id, lesson_key)
);

create table if not exists quizzes (
  id bigint generated always as identity primary key,
  course_id bigint not null references courses(id) on delete cascade,
  quiz_key text not null,
  title text not null default '',
  passing_score numeric(5,2) not null default 70 check (passing_score between 0 and 100),
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (course_id, quiz_key)
);

create table if not exists quiz_attempts (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  course_id bigint not null references courses(id) on delete cascade,
  quiz_id bigint not null references quizzes(id) on delete cascade,
  score numeric(5,2) not null default 0 check (score between 0 and 100),
  passed boolean not null default false,
  answers jsonb not null default '[]'::jsonb,
  attempted_at timestamptz not null default now()
);

create table if not exists projects (
  id bigint generated always as identity primary key,
  course_id bigint not null references courses(id) on delete cascade,
  project_key text not null,
  title text not null default '',
  instructions text not null default '',
  passing_score numeric(5,2) default 70 check (passing_score is null or passing_score between 0 and 100),
  created_at timestamptz not null default now(),
  unique (course_id, project_key)
);

alter table if exists project_submissions
  add column if not exists course_id bigint references courses(id) on delete cascade;

alter table if exists project_submissions
  add column if not exists project_id bigint references projects(id) on delete set null;

alter table if exists project_submissions
  add column if not exists status text not null default 'submitted';

alter table if exists project_submissions
  add column if not exists score numeric(5,2);

alter table if exists project_submissions
  add column if not exists feedback text;

create table if not exists certificates (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  course_id bigint not null references courses(id) on delete cascade,
  certificate_number text not null unique,
  verification_code text not null unique,
  issued_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists trial_mentor_usage (
  id bigint generated always as identity primary key,
  session_id text not null unique,
  message_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_status_idx on courses(status);
create index if not exists courses_category_idx on courses(category_id);
create index if not exists enrollments_user_idx on enrollments(user_id);
create index if not exists enrollments_course_idx on enrollments(course_id);
create index if not exists payments_user_idx on payments(user_id);
create index if not exists payments_course_idx on payments(course_id);
create index if not exists payments_status_idx on payments(status);
create index if not exists course_trials_user_idx on course_trials(user_id);
create index if not exists course_progress_user_course_idx on course_progress(user_id, course_id);
create index if not exists quiz_attempts_user_course_idx on quiz_attempts(user_id, course_id);
create index if not exists project_submissions_user_course_idx on project_submissions(user_id, course_id);

-- Optional: insert categories and courses from the Admin Dashboard instead of hard-coding them here.
