# Lake House Picks

Existing GitHub Pages application: ESPN public scores, reports and provider quotes; Kalshi sampled exchange data; a limited strictly matched VSiN/DraftKings public split preview; game-scoped manual evidence.

## Verification and evidence

See [acceptance checklist](ACCEPTANCE.md), [independent QA](QA-EVIDENCE.md), and [source audit](SOURCE-AUDIT.md). The application links to `verification.html`, the phone-readable acceptance report.

Install `jsdom@26` and `playwright@1.61.1`, then `npx playwright install --with-deps webkit`. The complete release command set is in `.github/workflows/pages.yml`. It runs the JS behavior/analytics/charts/failure/research/splits suites, Python collector/publisher/integrity/split parser suites and WebKit mobile checks.

`WEBKIT=1 node scripts/test_mobile.cjs` tests 375, 390 and 430px with touch emulation, all four sports/screens, six market tabs, scoreboard selections, exchange-contract selectors, refresh/fallback, observation tables, storage safety and layout. These deterministic fixtures test behavior; they are not live data. `node scripts/inspect_rendered.cjs` renders the real committed snapshots and checks real team-logo assets. No physical iPhone certification is claimed.

## Source collection

- `collect_scores.py`: broad ESPN scoreboard coverage (college groups=80), real provider quote observations and supplied openings, plus up to four priority summary reports per sport per cycle. Report fallback is bounded and timestamped; not every game is cached.
- `collect_public.py`: discovers all configured game/team/half/player exchange series before round-robin trade collection. Normal limits are 15 events/24 market candidates per core series and 3 events/4 candidates per extra series, two nested markets per event, up to 100 returned recent trades per request. The eight-minute budget can omit observations and is disclosed. `LHP_MARKETS_PER_SERIES` and `LHP_COLLECTION_SECONDS` can reduce sampling for a bounded manual check.
- Kalshi snapshots retain at most 400 markets, three days/500 trades per market and a global 25,000-trade budget. Historical commits preserve earlier snapshots. This is not a complete tape.
- `collect_splits.py`: reads only publicly visible VSiN DK preview rows; requires exact sport, full date, home and away matching. Source update time is unknown. Unlabeled over/under columns are not interpreted.
- `source_audit.py` and `audit_sportsbooks.py` reproduce read-only upstream checks without credentials or subscription bypass.

Scheduled GitHub collection is requested every ten minutes; schedules may be delayed. The visible page refreshes direct scores about every minute and static snapshots up to every two minutes. Refresh forces a new request. Failed sources preserve successful timestamps and expose warnings, not fresh timestamps or zero-filled data.

## Publishing

The existing branch-based Pages publisher remains the publishing owner. The verified workflow tests the application, requests a normal Pages build, and checks the served HTML, JS, CSS and JSON hashes for all thirteen release assets. It does not create competing custom Pages deployments. A failed collector/deploy must be diagnosed rather than reported as completed.

## Data boundaries and saved work

Public ESPN provider quotes are indirect observations, not a direct authenticated sportsbook feed or guaranteed executable offers. Source opening time is absent when not supplied; first observed is never relabeled opening. Limited public splits are percentages, not absolute dollars or private bet timestamps. Exchange premiums/contracts never become sportsbook handle/tickets. No guaranteed pick, estimated missing observation or invented injury/weather fact is supplied.

More stores validated user-entered **unverified** records on the device, scoped to sport and exact selected event. Import/export preserves nulls and rejects invalid/conflicting records. Damaged storage is retained until explicit confirmed reset; raw backup is available. Original legacy storage remains available for raw export and is never executed or silently assigned to another game.
