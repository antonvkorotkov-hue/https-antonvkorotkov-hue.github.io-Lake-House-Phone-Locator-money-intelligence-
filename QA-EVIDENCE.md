# Lake House Picks — independent Theo QA evidence

This report distinguishes verified interface behavior from upstream coverage. Browser tests use Playwright WebKit with touch/mobile emulation; no physical iPhone was tested. Deterministic source fixtures test behavior and do not certify upstream availability.

## Acceptance checklist

| Area | Status | Evidence / boundary |
| --- | --- | --- |
| NFL, College Football, NBA, MLB | PASS | Four sport selectors, every committed scoreboard matchup and correct selected teams checked by `test_mobile.cjs`. |
| Games, Trades, Scores, More | PASS | Every sport/screen tested at 375, 390, 430px; visibility and no document horizontal overflow asserted. |
| All six market selectors | PASS | Each selector exists and its pressed state updates; missing feeds show an explicit unavailable message. |
| Moneyline, spread/run line, game total | PASS | Nested ESPN quote schemas, missing quotes, selected provider isolation and game-date exchange mapping checked. Regression fixtures cover real MLB time-bearing tickers across UTC/ET date boundaries, doubleheader rejection, NBA/college aliases and cross-date rejection. Exact source availability remains variable. |
| Limited public sportsbook split preview | PASS | `test_splits.py` and `test_splits_ui.cjs` verify exact sport/date/game mapping, published moneyline/spread handle/ticket percentages and percentage-point differences, unknown publication-time warning and refresh-failure visibility. Current accessible preview coverage is narrow. |
| Sportsbook team totals, first half, player props, remaining split coverage | BLOCKED | No verified configured complete sportsbook feed for these markets/splits. Public preview O/U percentages are omitted because sides are ambiguous; no private dollar amounts or individual wager times. Separately labeled exchange alternatives may exist. |
| Price and activity graphs | PASS | `test_charts.cjs` verifies source/time/unit labels, first/latest/source-opening deltas, chronological gaps, null rejection, single-observation fallback, and separate sampled-premium/contracts graphs. |
| Weather, venue, home/away | PASS | `test_analytics.cjs` verifies source values, zero-degree weather, team identity and explicit missing data. No invented home-field score adjustment. |
| Offense/defense, QB/player statistics, injuries | PASS | Analytics module verifies numeric and nonnumeric source values, player rows, injury labels, foreign-team rejection and wrong-event rejection. Summary fields are shown with scope caveats: pregame player leaders/statistics can describe the season. No season-strength model is inferred. |
| Scheduled feed fallback | PASS | Browser direct-feed failure uses dated committed scoreboard snapshot and preserves selection. Collector unit tests cover failed collections. |
| Exchange data integrity | PASS | `test_data_integrity.py` checks unique contracts/trades, timezone timestamps, valid premiums/contracts and valid YES/NO sides. Bounded samples are not a complete trading tape. |
| Quote history integrity | PASS | Provider keys, observation ordering and timestamps checked. First observed quote must not be called sportsbook opening odds. |
| Runtime errors, invalid values | PASS | Browser page errors collected across navigation; no NaN, undefined or Invalid Date text. |
| Manual research and backups | PASS | `test_research.cjs` verifies game/sport scoping, field validation, null preservation, escaped text, CSV formula protection, export/import deduplication/conflicts, damaged-storage lock/raw export/confirmed reset, and quota errors. |
| Legacy saved data safety | PASS | Browser starts with malicious legacy stored strings; they never execute. Legacy inline runtime and legacy controls are removed; raw backup remains available through the new manual module. |
| Render inspection | PASS | Actual full-page WebKit screenshots generated for all 16 sport/screen combinations at 390px and inspected. Fixture summaries are clearly QA data, not production observations. |
| Latest Pages assets / final release | BLOCKED | Root release owner must record final deployed commit and served-asset verification after integration. Local QA alone does not prove deployment. |

## Reproduction

```sh
node scripts/test_visual.cjs
node scripts/test_analytics.cjs
node scripts/test_charts.cjs
node scripts/test_research.cjs
node scripts/test_failure_states.cjs
node scripts/test_splits_ui.cjs
WEBKIT=1 node scripts/test_mobile.cjs
python scripts/test_collectors.py
python scripts/test_splits.py
python scripts/test_data_integrity.py
python scripts/test_publish.py
```

`test_mobile.cjs` writes 16 full-page images to `QA_SCREENSHOT_DIR`, default `/tmp/lake-house-qa`. Screenshots are local execution evidence, not fixture images included in the application.

## Issues found during this release

- Earlier quote rendering could substitute another provider's history. Regression coverage is in `test_failure_states.cjs`; it must pass after the fix.
- Earlier refresh trade responses lacked the generation guard used by scoreboard requests; the guard is repaired and a delayed old-response regression now passes.
- Earlier pregame cards displayed source placeholder 0–0. Pregame scores now show dashes and were visually verified.
- Earlier SVG axes scaled to very small mobile text. Mobile chart labels were enlarged; exact values remain available in the observation facts and expandable tables.
- Earlier summary failures could be conflated with empty injury lists. Analytics error-state tests prevent that inference.

The checklist reflects component/local checks. All JavaScript/Python component suites passed after integration; WebKit integration also passed with legacy-storage security checks and unique control-ID checks. The final enhanced WebKit run passed exact exchange contract choices, expanding observation tables, legacy-payload safety, and unique control IDs (48 sport/screen/viewport combinations; 144 market-selector interactions). Release owner records served-asset hashes independently. A PASS for unavailable-state behavior does not make an external feed operational.
