# Prelaunch repairs

Deploy this backend before the companion frontend PR. No migration, new environment variable, or course ZIP upload is required.

- Paid webhook retries reconcile enrollment and affiliate conversion before acknowledging success. An existing revoked enrollment for the same payment stays revoked. Duplicate commission upserts preserve settled state/rate.
- Authenticated content-token requests may include a chapter number. Locked student chapters return CHAPTER_LOCKED before loading the iframe. Course-content gateway checks assessment files as well as lessons, retains student gating, and honors the server-derived admin role for preview.
- Authored assessment HTML gets the correct level label and the current chapter's actual review criteria. Public template metadata includes the same task review criteria used by server review; no answer keys are added.

Validation: `node --test tests/prelaunch-regressions.test.cjs` (57 tests). Tests use mocked persistence and signed-callback verification boundaries; no live Paymob transaction or Supabase mutation was performed. Recheck real student gating, a sandbox payment, course ZIP pages, and post-payment access after deployment. This change does not alter mentor models/prompts.
