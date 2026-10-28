# Privacy and registration release

## Required before backend deployment

Run `migrations/20261028_registration_age.sql` in the existing Supabase project. It adds nullable columns only; existing users are not assigned fabricated age declarations.

Deploy frontend assets first, then the backend after the migration. New registrations require the explicit Boolean `ageConfirmed: true`; the backend records minimum_age_confirmed=16 and a server timestamp. This is self-attestation, not age verification. Login and existing accounts remain unchanged. Old cached registration clients must refresh to see the new confirmation; scripts and SW have new versions.

The frontend removes the embedded Clarity recorder. The authenticated content gateway strips known Clarity/Hotjar/rrweb recorder script tags from served uploaded HTML too. Existing historical recordings and third-party dashboard retention are not deleted. Meta event measurement and essential API/security/learning logs remain enabled; these are not session replay. Website headers restrict font loads to first-party assets and data; local font licenses are included.

Refund action opens the user's email client with a draft to the existing support email. Sending is manual. It follows the existing case-by-case policy, with no invented deadlines, eligibility guarantees, subscription billing cancellation or automatic refund API. The link does not revoke access, move money or approve the request.

This release reduces collection and clarifies requests. It is not a guarantee of legal compliance across Egypt or other jurisdictions; the owner should obtain review of the 16+ policy, minor users, advertising consent and refund terms as applicable.

Validation: 10 focused mocked/DOM checks for registration assertions and persistence, course asset sanitization, local icon files and refund request UI. No production registration, policy email or real refund was submitted. After setup verify a new registration, fonts/icons on lessons, absence of Clarity network requests and the manual refund email flow in a real browser.
