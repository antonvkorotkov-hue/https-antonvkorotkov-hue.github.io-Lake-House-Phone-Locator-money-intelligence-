# Lake House Virtual Sportsbook — Phase 1
This is a **free-play-only** companion to the existing Lake House Picks application. All stakes and balances are points; no deposits, payments, withdrawals, transferable prizes, loans, or cash redemption.

## What was actually implemented
- Isolated `sportsbook-prototype.html` for phone use.
- Nickname, sample American-odds market, stake validation, hypothetical returns, pending-pick list, local demo balance, and explicit local reset.
- Browser-only storage. No shared accounts, no administrator authentication, no cross-device sync, no live market claims, and no automatic settlement.
- The existing `index.html`, analytics, feeds, and release pipeline are untouched.

## Production requirements
1. Backend service with TLS, authenticated invitation-only username/password accounts (no email needed), and a **single bootstrap admin** whose role cannot be self-assigned. Store slow password hashes (Argon2id or equivalent), never plaintext passwords or PINs. Provide admin-issued recovery codes since email reset is excluded. Use secure httpOnly SameSite cookies, lockout/rate limits, and CSRF defense.
2. Durable database: users (id, username, password_hash, role, status), invitations (token_digest, expiry, claimed_by), events (source_id, sport, kickoff, status), market_quotes (event_id, market_key, outcome, odds, source_timestamp, received_at, suspended), picks (id, user_id, quote_id, stake_points, accepted_price, placed_at, status), ledger_entries (id, account_id, delta, kind, reference, created_at), settlements (pick_id, result_source, result_version, status), audit_events (actor, action, before/after, timestamp).
3. Enforce all state transitions on server in DB transactions. Idempotency keys prevent double stake deduction. Freeze accepted prices; stale/closed/suspended markets cannot accept new picks. Server, not browser, owns the clock and market cutoff.
4. House bankroll separate from the admin's personal bettor account. Each accepted stake transfers points to house liability/accounting. Settle correctly including pushes and voids; maintain double-entry invariant; disallow unlogged balance changes.
5. Game feeds: preserve sports, event ID, quote source, retrieval and source timestamps. If the available scores/odds are not fresh enough, disable submissions. Provider licenses must permit this display and usage; public ESPN quotes are informational, not authenticated sportsbook offers.
6. Privacy: do not expose personal account data or private ledger via public GitHub Pages JSON. Secrets belong only in secured backend configuration. Public repository and Pages must never hold password hashes or private data.
7. Tests: independent multi-device accounts; cannot self-promote to admin; concurrent bets; insufficient funds; market change and cutoff races; staleness; duplicate submissions; reversals; settlement reproducibility; lost connectivity; recovery codes; export and audit.

## Next implementation milestone
Choose and provision a dedicated private backend and DB; implement authenticated accounts and immutable demo ledger; only then connect real sportsbook-style picks to verified live events.
