# Verification evidence — 2026-10-23

Status: development branch; not a production release. No HTTPS service URL or physical-iPhone certification exists.

| Check | Result | Evidence / scope |
|---|---|---|
| Backend suite | PASS | `python -m pytest -q sportsbook_service`: 41 passed; one upstream Starlette TestClient deprecation warning |
| Original Picks Python regressions | PASS | Existing odds, collectors, source enrichment, publishing, data integrity and splits suites: 22 tests |
| Original Picks JavaScript regressions | PASS | All seven existing visual, analytics, intelligence, failure-state, chart, research and splits UI suites |
| Syntax / diff formatting | PASS | Python compile, `node --check` for service scripts, `git diff --check` |
| Live ESPN retrieval | PASS | Real network retrieval populated NFL 14, college football 17, NBA 12, MLB 1 event records in an isolated private test DB; counts are this observation, not coverage guarantees |
| Authorized odds retrieval | BLOCKED | No backend provider credential or usage authorization available; no invented odds accepted |
| Official MLB results | FIXTURE PASS | Tests verify matching identity/scores, duplicate replay and rejection of a source conflict; real MLB official endpoint responded HTTP 200, but no accepted live wager was settled |
| Browser / two sessions / HTTP restart | PENDING | WebKit test added and scheduled in GitHub Actions; local result to be recorded after execution |
| Container / HTTPS deployment | BLOCKED | Docker runtime and authorized backend host/hostname not available |
| Deployed cross-network iPhones | BLOCKED | No deployed service; no physical iPhone was operated |

Backend coverage includes sole-admin unique constraint; invitation replay and role injection; password login; CSRF bound to session; cross-origin rejection; independent accounts and same-account synchronization; concurrent overspending protection; retry key conflicts; integer validation; future/stale/expired/suspended/unlicensed/closed-event rejection; return liability limits; win/loss/push/void; market-specific arithmetic; missing result data; correction replay and debt; append-only accepted terms and audit; recovery replay and session revocation; disabling; rules and grant idempotency; database reload; legacy migration replay; backup/restore integrity; secure production configuration gate; persistent rate limiting; pending/grant exclusion from leaderboard.

The settlement arithmetic tests cover six market types, but they do not establish the presence of six licensed live feeds. Only pregame moneyline/spread/game total odds have an adapter. Only MLB has automatic official-result corroboration. Other sports' official-result adapters, live/halves/team-total/prop sources and deployed acceptance remain incomplete. Do not merge on the strength of fixture tests alone.
