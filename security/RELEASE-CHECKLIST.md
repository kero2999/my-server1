# Security release checklist

Do not merge this branch into main until the following are implemented and tested:
- Verify email ownership before granting new-account access or claiming pending memberships.
- Validate OAuth identity on the server; review state, nonce, issuer, audience and expiry.
- Invalidate existing sessions after password reset; consume reset tokens atomically.
- Enforce per-IP and per-account login throttling across deployed instances.
- Verify Paymob order identifiers, amount, currency, signatures and idempotent fulfillment.
- Test unauthorized course, quiz, certificate and admin access.
- Test existing accounts, new signup, password recovery and Paymob sandbox end-to-end.
- Apply and verify database migrations; maintain a rollback plan.

Render is configured to deploy automatically when main changes. This branch is not production-ready.
