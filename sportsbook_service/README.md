# Lake House private virtual sportsbook

Development service for the existing Lake House Picks repository. No payments or monetary prizes. **Not deployed or ready to merge.**

Implemented: invitation-only username accounts; sole owner; Argon2 passwords; session-bound CSRF; persistent sessions and rate limits; private recovery; account disabling; auditable grants; integer double-entry virtual accounting; immutable accepted wagers; idempotency; quote freshness/cutoff enforcement; settlement and correction arithmetic; owner reports; mobile navigation; real ESPN event ingestion; optional existing pregame odds integration; MLB official result corroboration; backup/restore; automated backend and WebKit tests.

Deployment, live feed limitations, owner/friend instructions, accounting rules, backups and required release checks: [LAUNCH.md](LAUNCH.md). Evidence: [TEST_RESULTS.md](TEST_RESULTS.md).

Existing public Picks code and production deployment are preserved. This service must run on its own private, durable HTTPS backend, not GitHub Pages. Public code contains no member records or credentials.
