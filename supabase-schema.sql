-- ============================================================
-- شغّل الكود ده مرة واحدة بس داخل Supabase:
-- من لوحة مشروعك → SQL Editor → New query → الصق الكود ده → Run
-- ============================================================

create table if not exists users (
  id bigint generated always as identity primary key,
  full_name text not null,
  email text not null unique,
  password_hash text not null,
  whop_status text not null default 'pending', -- 'pending' | 'active' | 'inactive'
  whop_membership_id text,
  created_at timestamptz not null default now()
);

-- تُسجَّل هنا أحداث Whop اللي توصل *قبل* ما الطالب يعمل حساب،
-- عشان لما يسجّل بنفس الإيميل نفعّله فورًا.
create table if not exists pending_activations (
  email text primary key,
  whop_membership_id text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

-- تسليمات مشروع التخرج — تُحفظ هنا نسخة احتياطية تقدر تراجعها في أي وقت
create table if not exists project_submissions (
  id bigint generated always as identity primary key,
  user_id bigint references users(id),
  email text not null,
  content text not null,
  submitted_at timestamptz not null default now()
);

-- توكنات إعادة تعيين كلمة السر — كل توكن صالح لمرة واحدة وله وقت انتهاء
create table if not exists password_resets (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

-- الجداول دي كلها بيتقروا ويتكتبوا بس من السيرفر بتاعنا (service_role key)
-- فمفيش داعي نفعّل Row Level Security عليها — السيرفر هو الوحيد اللي بيوصلها.
