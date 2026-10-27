# Admin-only Paymob sandbox

Disabled by default. This is a provider checkout/webhook test, **not** an end-to-end student enrollment test. Nothing writes production payments, enrollments, commissions or Purchase events.

## Setup after review and deployment

1. Run `migrations/20261027_payment_sandbox.sql` in Supabase SQL editor. Uses a separate RLS-protected table; only service-role backend access.
2. Add NEW Render variables without modifying existing PAYMOB_* production values:
   - PAYMOB_SANDBOX_ENABLED=true
   - PAYMOB_TEST_API_KEY: from the merchant's TEST configuration
   - PAYMOB_TEST_HMAC_SECRET: TEST callback HMAC secret
   - PAYMOB_TEST_INTEGRATION_ID=5851430 (merchant identified this as TEST; verify in dashboard)
   - PAYMOB_TEST_IFRAME_ID=1068624 (merchant selected)
3. On that TEST integration only, set Transaction Processed Callback to `https://my-server1-hk07.onrender.com/api/webhooks/paymob-sandbox`. Preserve the LIVE integration callback. No redirect URL is required by the test page: manually return to the original tab.
4. Signed-in admin: open `/admin`, then «اختبار الدفع». Verify displayed TEST integration, create a session, open provider checkout, use only official Paymob sandbox card credentials, then return and click status check.
5. A passing test requires `paid` from the signed server callback, not the browser redirect. Unknown orders, live/pending callbacks, wrong integration, signature, amount/currency are rejected. Duplicate paid callbacks do not downgrade paid status.
6. Set PAYMOB_SANDBOX_ENABLED=false when done. Status of an existing session remains visible only to the same current admin.

The raw callback is deliberately not persisted. No API keys, HMAC secret, tokens or card data appear in the configuration response. Normal checkout ignores any sandbox flag from the browser. Config must not reuse the live card/wallet integration ID. Sandbox API calls use the fixed official Paymob Egypt API origin.

## Validation limitations

Automated tests use mocked database/provider requests and a browser DOM. Real TEST credentials, Supabase migration and Paymob TEST callback delivery still require live verification after setup. This feature does not claim to verify student enrollment, access gating, real payments, refunds or affiliate settlement.
