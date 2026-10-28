# Optional replay preference, recorder still disabled

One registration box contains an unchecked mandatory terms/16+ declaration and a separate unchecked optional replay/18+ declaration. Declining replay never prevents registration. The server validates explicit booleans and the replay notice version, saves the preference, self-attested adult status and server timestamp. This does not verify age or implement guardian authorization.

Run migrations/20261028_optional_replay_consent.sql before deploying the backend. Existing accounts default to false. POST /api/auth/session-replay-consent requires authenticated user ownership, supports withdrawal without age/version prerequisites, and changes preferences only. It returns replayEnabled=false. There is no Clarity loader or replay integration in this release. Existing mandatory legal versions are unchanged; the separate optional notice is versioned.

Deploy backend and frontend after migration. Test optional decline/accept and account settings withdrawal, as well as missing/stale consent and anonymous access. No session recorder is re-enabled. Actual activation, data masking/network checks, retention rules, cross-border/licensing review and a guardian path for 16/17-year-old accounts remain separate unfinished work; do not market this preference UI as proof of legal compliance.
