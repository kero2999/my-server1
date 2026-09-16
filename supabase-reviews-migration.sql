-- QuadraLevel course reviews with optional short review videos.
-- Run once in Supabase SQL Editor. This migration is additive and does not delete existing data.

create table if not exists course_reviews (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  course_id bigint not null references courses(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 2000),
  status text not null default 'published' check (status in ('pending', 'published', 'hidden')),
  verified_purchase boolean not null default false,
  video_bucket text,
  video_path text,
  video_mime_type text,
  video_size_bytes integer check (video_size_bytes is null or (video_size_bytes > 0 and video_size_bytes <= 52428800)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists course_reviews_course_status_idx
  on course_reviews(course_id, status, created_at desc);

create index if not exists course_reviews_user_course_idx
  on course_reviews(user_id, course_id);

-- Private bucket: the backend issues short-lived signed URLs for displayed videos.
insert into storage.buckets (id, name, public)
values ('review-media', 'review-media', false)
on conflict (id) do nothing;

-- Keep direct client access disabled; the backend service role is the only writer/reader.
alter table course_reviews enable row level security;
revoke all on table course_reviews from anon, authenticated;
