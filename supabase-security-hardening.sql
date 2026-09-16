-- QuadraLevel Supabase security hardening
-- Run once in Supabase SQL Editor after confirming that the frontend does not
-- access these tables directly. The Backend uses the service_role key.

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users',
    'pending_activations',
    'project_submissions',
    'password_resets',
    'categories',
    'courses',
    'course_versions',
    'enrollments',
    'payments',
    'course_trials',
    'lessons',
    'course_progress',
    'quizzes',
    'quiz_attempts',
    'projects',
    'certificates',
    'trial_mentor_usage'
  ] LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
  END LOOP;
END
$$;

-- Keep the Data API unable to read or mutate private application tables unless
-- a future migration adds an explicit, narrowly scoped policy.
