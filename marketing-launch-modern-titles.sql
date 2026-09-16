-- Marketing Launch modern ZIP titles. Safe to rerun.
-- Updates display titles only; does not alter questions, attempts, or progress.
begin;

with course_row as (select id from courses where slug = 'marketing-launch'),
seed(lesson_key, title, position) as (values
  ('ch1', 'مقدمة إلى التسويق', 1),
  ('ch2', 'السوق والعميل', 2),
  ('ch3', 'شخصية العميل المثالي', 3),
  ('ch4', 'رحلة العميل', 4),
  ('ch5', 'علم نفس التسويق', 5),
  ('ch6', 'أنواع التسويق', 6),
  ('ch7', 'أساسيات العلامة التجارية', 7),
  ('ch8', 'عرض القيمة', 8),
  ('ch9', 'الاستراتيجية التسويقية', 9),
  ('ch10', 'المحتوى التسويقي', 10),
  ('ch11', 'الحملة التسويقية', 11),
  ('ch12', 'القياس والتحسين', 12)
)
update lessons l
set title = seed.title,
    position = seed.position
from course_row, seed
where l.course_id = course_row.id
  and l.lesson_key = seed.lesson_key;

with course_row as (select id from courses where slug = 'marketing-launch'),
seed(quiz_key, title) as (values
  ('quiz-1', 'اختبار الفصل 1: مقدمة إلى التسويق'),
  ('quiz-2', 'اختبار الفصل 2: السوق والعميل'),
  ('quiz-3', 'اختبار الفصل 3: شخصية العميل المثالي'),
  ('quiz-4', 'اختبار الفصل 4: رحلة العميل'),
  ('quiz-5', 'اختبار الفصل 5: علم نفس التسويق'),
  ('quiz-6', 'اختبار الفصل 6: أنواع التسويق'),
  ('quiz-7', 'اختبار الفصل 7: أساسيات العلامة التجارية'),
  ('quiz-8', 'اختبار الفصل 8: عرض القيمة'),
  ('quiz-9', 'اختبار الفصل 9: الاستراتيجية التسويقية'),
  ('quiz-10', 'اختبار الفصل 10: المحتوى التسويقي'),
  ('quiz-11', 'اختبار الفصل 11: الحملة التسويقية'),
  ('quiz-12', 'اختبار الفصل 12: القياس والتحسين')
)
update quizzes q
set title = seed.title
from course_row, seed
where q.course_id = course_row.id
  and q.quiz_key = seed.quiz_key;

commit;
