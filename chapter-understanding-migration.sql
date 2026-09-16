-- نظام التقدم المشروط بالفهم: Quiz + Template + أسئلة Kero
create table if not exists chapter_assessments (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  course_id bigint not null references courses(id) on delete cascade,
  chapter_number integer not null check (chapter_number > 0),
  attempt_number integer not null default 1 check (attempt_number > 0),
  template_text text not null default '',
  template_score numeric(5,2) check (template_score between 0 and 100),
  template_feedback text not null default '',
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  understanding_score numeric(5,2) check (understanding_score between 0 and 100),
  understanding_feedback text not null default '',
  chapter_score numeric(5,2) check (chapter_score between 0 and 100),
  quiz_score numeric(5,2) check (quiz_score between 0 and 100),
  passed boolean not null default false,
  weaknesses jsonb not null default '[]'::jsonb,
  status text not null default 'questions_pending' check (status in ('questions_pending','evaluated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chapter_assessments_user_course_chapter_idx
  on chapter_assessments(user_id, course_id, chapter_number, created_at desc);

create index if not exists chapter_assessments_course_idx
  on chapter_assessments(course_id, chapter_number, created_at desc);

alter table chapter_assessments enable row level security;

comment on table chapter_assessments is 'Kero chapter understanding assessments: template, generated questions, answers, and composite score';

-- يستخدم السيرفر service_role للوصول إلى هذا الجدول.
-- بعد التشغيل، أعد تشغيل خدمة الباك اند ثم اختبر الفصل الأول بحساب طالب أو Admin.
