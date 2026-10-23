# Native Sites sportsbook verification

## Architecture and access
Existing Site: Lake House Picks. Preserved audience: public entry page, with server-enforced invitation-only sportsbook accounts. External-visitor invitations are enabled by Sites, but friend accounts use no email and need no platform invitation. D1 is bound natively as DB. Existing sports-feed secrets are retained privately. No external hosting account was created.

GitHub `feature/private-virtual-sportsbook` is the source of truth; `sportsbook_sites/` contains the adapted Worker/Vinext application. The Sites source repository is its deployment mirror. The former FastAPI implementation remains in the repository for reference and rollback. The old Picks Worker is preserved in lib/legacy-picks.js and remains the handler for original screens and data routes.

## Results observed on 2026-10-23
- Native Sites build succeeded; D1 schema and all 23 index/trigger migration statements applied in the actual local Worker database.
- Eleven SQLite accounting/permission/migration invariants passed against the exact migrations. API-level tests passed username login, sole owner, invitations, account isolation, CSRF, retries, balance protection, recovery, disabling, ledger totals and grading.
- Published Site version 49, deployment appgdep_6adbc92c6af481919cb95075dbcaefc5, succeeded.
- Hosted D1 route, owner initialization and username/password login passed. Two independently invited member accounts registered and signed in. Both were denied Admin access.
- A real hosted feed observation returned 44 events and 426 prices; 422 were fresh/available at that instant. This is a measured sample, not a promise of continuing coverage.
- A one-point virtual wager against an actual provider quote was accepted. Retry returned the original wager without another debit. No sample game, fake quote or forced result was inserted into the hosted database.
- The second member's history and owner's personal history remained empty. The wagering member's accepted pick synchronized to a new cookie jar/session. House ledger sum was zero and outstanding return was 1.91 virtual points for the acceptance wager.
- The first earlier wagering attempt was rejected when its quote was no longer acceptable; a later fresh quote passed. No stale price was forced through.
- Public browser access to the sportsbook login/invitation page was verified without a ChatGPT sign-in gate. Preview and hosted UI rendered with no application JavaScript errors observed in Chrome. This is not a physical-iPhone or hosted Safari certification.

## Limits and next evidence
The initial 600,000-iteration PBKDF2 configuration was rejected by the hosted Worker and created no account. It was replaced with scrypt (N=32768,r=8,p=3) and hosted account tests passed. Hash concurrency is bounded for the 128 MB isolate.

A further deployment removes the service-only initialization secret and checks the same database records after redeployment. The final native deployment and persistence outcome are recorded in PR #1 and the conversation, because those IDs are returned only after publication.

Automated acceptance accounts are disabled after persistence checks; their real accepted one-point wager and audit history are retained, not silently removed. The owner participant starts at 1,000 points and remains separate from house accounting.

Market availability depends on the existing provider subscription, individual source timestamps, exact event matching, and runtime status. Rest snapshots do not provide private wager information. Decimal provider prices are converted to displayed integer American odds before review/acceptance, and returns use those frozen accepted terms. Unsupported shapes and missing final prop/period statistics remain unavailable or pending. ESPN scoreboard/summary agreement is same-provider corroboration, not independent league verification. Final settlement/correction arithmetic is tested; a completed real-game settlement was not forced or claimed during acceptance.

Feed/result checks run when authenticated Games refreshes; no unattended schedule is claimed. Sites exposes 128 MB per Worker isolate; no project-specific D1 quota or independent backup/export/restore interface is exposed by the available controls. Existing provider subscription terms continue to govern data use. No physical iPhones were operated.
