# Lake House Virtual Sportsbook — Backend Foundation

**Status: development branch only — not deployed, security-audited, or production-ready.**

This app accepts **virtual points only**. No payment methods, cashout, real stakes, transferable prizes, or value conversion.

## Run locally
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r sportsbook_service/requirements.txt
export LH_LEAGUE_DB="$(pwd)/sportsbook_service/local.sqlite3"
export LH_DEV_INSECURE_COOKIE=1  # ONLY on localhost; never on the internet
python sportsbook_service/app.py  # bootstrap sole administrator; prompt for password
uvicorn sportsbook_service.app:app --host 127.0.0.1 --port 8000
pytest -q sportsbook_service/test_app.py
```

Private SQLite database is excluded from sharing/deployment; do not commit it. Use a unique 12+ character password, keep database backups, and do not expose localhost directly.

## Implemented endpoints
- POST /api/login — username/password, HttpOnly session cookie and CSRF cookie
- GET /api/me — role and virtual point balance
- POST /api/invites — administrator only, 24-hour single-use invitation
- POST /api/join — redeem invitation with username and password; no email
- GET /api/quotes — **DEMONSTRATION VALUES ONLY**, not real sportsbook data
- POST /api/picks — transactional debit, pending pick, idempotent request key
- GET /api/picks — member's own history

Mutation requests after login/join must send the value of the `lh_csrf` cookie as `X-CSRF-Token`. The frontend will be built after authenticated backend acceptance tests.

## Before internet deployment
- Add production login and registration request rate limiting and account protections, secure origin and cookie configuration, log redaction, monitoring, durable secret management, backups, migrations, and penetration review.
- Add proper logout/session revocation, recovery codes (no email), admin session audit, security event logging, account disable and invitation revocation.
- Use a production-grade multi-user database/transaction deployment and enforce HTTPS; SQLite is only a development starting point.
- Implement immutable ledger balancing and true double-entry house accounting; current version reserves virtual stake only. **There is no settlement or house profit report yet.**
- Connect licensed/live data via a secured backend, verify game identity and freshness, reject suspended/stale markets, and maintain per-quote timestamps. Do not treat demonstration odds as live.
- Build member and admin interface and verify multiple devices.
- Note GitHub Pages is PUBLIC static hosting. It is not a place for private account data or secrets; keep the service on a separate private backend.
- Review all third-party feed licenses and ensure project remains free-play, with no real-money settlement.

Existing Lake House Picks app on `main` remains untouched.
