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
| Browser / two sessions / HTTP restart | PASS locally | Real local HTTP server; WebKit at 390×844; owner login, invitation, friend Admin denial, wager acceptance, synchronized second member session, durable account/session/wager after actual server restart, navigation, unavailable market, logout; zero page errors and no horizontal overflow. Temporary browser libraries supplied locally; CI result recorded separately. |
| Container / HTTPS deployment | BLOCKED | Docker runtime and authorized backend host/hostname not available |
| Deployed cross-network iPhones | BLOCKED | No deployed service; no physical iPhone was operated |

Backend coverage includes sole-admin unique constraint; invitation replay and role injection; password login; CSRF bound to session; cross-origin rejection; independent accounts and same-account synchronization; concurrent overspending protection; retry key conflicts; integer validation; future/stale/expired/suspended/unlicensed/closed-event rejection; return liability limits; win/loss/push/void; market-specific arithmetic; missing result data; correction replay and debt; append-only accepted terms and audit; recovery replay and session revocation; disabling; rules and grant idempotency; database reload; legacy migration replay; backup/restore integrity; secure production configuration gate; persistent rate limiting; pending/grant exclusion from leaderboard.

The settlement arithmetic tests cover six market types, but they do not establish the presence of six licensed live feeds. Only pregame moneyline/spread/game total odds have an adapter. Only MLB has automatic official-result corroboration. Other sports' official-result adapters, live/halves/team-total/prop sources and deployed acceptance remain incomplete. Do not merge on the strength of fixture tests alone.

The existing public odds snapshot reports `not_configured` with zero quotes. Existing Actions references both LHP_ODDS_API_KEY and THE_ODDS_API_KEY secrets; secret values cannot be read back through the GitHub connection. A credential already held by the owner should be configured directly on the eventual backend, never pasted into public code or logs.

Independent GitHub Actions confirmation: [run 40000519912](https://github.com/antonvkorotkov-hue/https-antonvkorotkov-hue.github.io-Lake-House-Phone-Locator-money-intelligence-/actions/runs/40000519912) completed successfully for implementation commit `ebbba1dbd2c7a77c9f0b4f17525a2dfef034ee2a`, including all backend tests, WebKit HTTP/multisession/restart checks and test artifact upload. This verifies CI behavior, not hosted production behavior.
