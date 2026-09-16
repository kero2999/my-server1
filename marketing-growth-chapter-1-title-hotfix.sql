-- Marketing Growth chapter 1 title hotfix
-- The live learning API currently resolves chapter 1 from lesson_key = 'ch1'.
-- A second lesson row using lesson_key = 'index' was inserted by the modern update,
-- leaving the legacy ch1 title visible. This migration keeps one canonical row.

begin;

with course_row as (
  select id
  from courses
  where slug = 'marketing-growth'
)
insert into lessons (course_id, lesson_key, title, position, is_preview)
select id, 'ch1', 'البحث التسويقي', 1, true
from course_row
on conflict (course_id, lesson_key) do update
set
  title = excluded.title,
  position = excluded.position,
  is_preview = excluded.is_preview;

with course_row as (
  select id
  from courses
  where slug = 'marketing-growth'
)
delete from lessons
using course_row
where lessons.course_id = course_row.id
  and lessons.lesson_key in ('index', 'index.html');

commit;

-- Expected result: exactly one chapter-one lesson named "البحث التسويقي".
select
  l.lesson_key,
  l.title,
  l.position,
  l.is_preview
from lessons l
join courses c on c.id = l.course_id
where c.slug = 'marketing-growth'
order by l.position, l.lesson_key;
