-- إضافة نقاط القوة لنتيجة Kero النهائية
alter table if exists chapter_assessments
  add column if not exists strengths jsonb not null default '[]'::jsonb;

alter table if exists chapter_assessments
  add column if not exists final_feedback text not null default '';
