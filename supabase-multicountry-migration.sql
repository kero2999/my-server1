-- QuadraLevel Country Layer: EG / AE / SA
-- Additive migration. Run once in Supabase SQL Editor after the existing marketplace/reviews/campaign migrations.
-- This migration does not delete or rewrite users, payments, enrollments, trials, progress, attempts, projects, or certificates.

create table if not exists country_configs (
  country_code text primary key check (country_code ~ '^[A-Z]{2}$'),
  country_name text not null,
  dialect text not null,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  currency_symbol text not null,
  phone_code text not null,
  locale text not null default 'ar',
  content_version text not null default 'v1',
  ui_messages jsonb not null default '{}'::jsonb,
  mentor_context jsonb not null default '{}'::jsonb,
  lesson_contexts jsonb not null default '{}'::jsonb,
  quiz_contexts jsonb not null default '{}'::jsonb,
  project_context text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into country_configs (country_code, country_name, dialect, currency_code, currency_symbol, phone_code, locale, content_version)
values
  ('EG', 'مصر', 'العربية المصرية', 'EGP', 'جنيه', '+20', 'ar-EG', 'eg-v1'),
  ('AE', 'الإمارات', 'العربية الإماراتية', 'AED', 'درهم', '+971', 'ar-AE', 'ae-v1'),
  ('SA', 'السعودية', 'العربية السعودية', 'SAR', 'ريال', '+966', 'ar-SA', 'sa-v1')
on conflict (country_code) do nothing;

alter table if exists users
  add column if not exists country_code text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_country_code_fk') then
    alter table users
      add constraint users_country_code_fk
      foreign key (country_code) references country_configs(country_code) on delete set null;
  end if;
end $$;

create table if not exists course_country_pricing (
  id bigint generated always as identity primary key,
  course_id bigint not null references courses(id) on delete cascade,
  country_code text not null references country_configs(country_code) on delete restrict,
  price_cents integer not null check (price_cents >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, country_code)
);

create table if not exists lesson_country_variants (
  id bigint generated always as identity primary key,
  lesson_id bigint not null references lessons(id) on delete cascade,
  course_id bigint not null references courses(id) on delete cascade,
  country_code text not null references country_configs(country_code) on delete restrict,
  lesson_key text not null,
  title text,
  summary text,
  content_html text,
  market_examples jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, country_code),
  unique (course_id, country_code, lesson_key)
);

create table if not exists quiz_country_variants (
  id bigint generated always as identity primary key,
  quiz_id bigint not null references quizzes(id) on delete cascade,
  course_id bigint not null references courses(id) on delete cascade,
  country_code text not null references country_configs(country_code) on delete restrict,
  quiz_key text not null,
  title text,
  questions jsonb not null default '[]'::jsonb,
  scenario_context text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, country_code),
  unique (course_id, country_code, quiz_key)
);

create table if not exists project_country_variants (
  id bigint generated always as identity primary key,
  project_id bigint not null references projects(id) on delete cascade,
  course_id bigint not null references courses(id) on delete cascade,
  country_code text not null references country_configs(country_code) on delete restrict,
  project_key text not null,
  title text,
  instructions text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, country_code),
  unique (course_id, country_code, project_key)
);

create index if not exists users_country_code_idx on users(country_code);
create index if not exists course_country_pricing_country_idx on course_country_pricing(country_code, course_id);
create index if not exists lesson_country_variants_lookup_idx on lesson_country_variants(course_id, country_code, lesson_key);
create index if not exists quiz_country_variants_lookup_idx on quiz_country_variants(course_id, country_code, quiz_key);
create index if not exists project_country_variants_lookup_idx on project_country_variants(course_id, country_code, project_key);

alter table if exists country_configs enable row level security;
alter table if exists course_country_pricing enable row level security;
alter table if exists lesson_country_variants enable row level security;
alter table if exists quiz_country_variants enable row level security;
alter table if exists project_country_variants enable row level security;

-- The Express Backend uses Supabase service_role and remains the only application data path.
-- No public/anon policies are added intentionally.
