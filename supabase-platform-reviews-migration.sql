-- QuadraLevel platform-wide reviews.
-- Additive migration: does not change course_reviews.
create table if not exists platform_reviews (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists platform_reviews_status_created_idx
  on platform_reviews(status, created_at desc);

alter table platform_reviews enable row level security;
revoke all on table platform_reviews from anon, authenticated;
