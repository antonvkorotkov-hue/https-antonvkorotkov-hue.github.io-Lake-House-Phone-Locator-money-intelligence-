# Phase 2 — independent Theo QA

Status applies to the current implementation and real saved public-source payloads. Tests using fixtures verify behavior; they do not certify upstream completeness. WebKit mobile emulation is not physical iPhone testing.

| Acceptance item | Status | Evidence |
| --- | --- | --- |
| Existing navigation / market / mapping behavior | PASS | `test_visual.cjs`, `test_analytics.cjs`, `test_charts.cjs`, `test_research.cjs`, `test_failure_states.cjs`, `test_splits_ui.cjs` pass after integration. Includes real MLB ticker/time-zone mapping, alias mapping, doubleheader rejection and moneyline/run-line separation. |
| Saved observation integrity | PASS | `test_data_integrity.py`: unique contracts/trades, chronological provider-specific history, valid game teams and timestamps; 292 contracts / 7,353 observed trades at baseline. Counts change when legitimate scheduled collection runs. |
| Collector, split-parser, publisher regressions | PASS | Collector fixture, seven split-parser cases, seven enrichment/official schedule cases and 15-asset publisher fixture pass. |
| Verified facts vs estimates | PASS | `test_intelligence.cjs` verifies paired-provider no-vig arithmetic, explicitly descriptive market-implied score arithmetic, no addition of live scores to full-game totals, no MLB run-line-derived score, uncalibrated probability caveat and unknown source update timestamps. |
| Recommendation sufficiency / PASS behavior | PASS | Missing, stale, future, wrong-event, empty-event, providerless and unverified quotes cannot establish current pricing. Even fresh paired quotes retain PASS without an independent calibrated edge. Confidence remains explicitly unavailable. |
| Game-report freshness and source errors | PASS | TTL regression verifies fresh summary reused, then a 61-second-old report refetched without forcing refresh or changing game. Summary errors, stale/future report times, official-source conflicts/errors and malformed timestamps remain visible. |
| Scoring, starters and performance scope | PASS | Tests reject null/duplicate/foreign scoring observations, avoid an invented zero baseline or connecting line, require explicit starter flags, reject foreign-team injuries, suppress pregame season data from game comparisons, and retain missing source values. |
| Four-sport, multi-matchup real-source review | PASS | Intelligence tested against 12 saved real ESPN reports: 4 NFL, 4 college, 3 NBA, 1 MLB. No additional MLB matchup was fabricated. Source team identities and unknown live-pricing status checked per report. |
| iPhone-width navigation, selectors and graphs | PASS | Integrated WebKit run: 375/390/430px × four sports × four screens; all six markets, all scoreboard matchups, intelligence visible in Games/Scores, contract selection and observation tables. No overflow, invalid generated values or uncaught page errors. |
| Actual rendered application | PASS | Sixteen real-snapshot WebKit sport/screen captures, 12 loaded source reports, zero uncaught errors, eight genuine ESPN logo responses HTTP 200. Additional current compact intelligence captures inspected separately. |
| Calibrated predictions / complete live sportsbook data | BLOCKED | No validated forecasting model or complete current sportsbook feed supplied. Market-derived estimates are labeled, not represented as model predictions, guaranteed outcomes, executable live prices or betting edges. |
| Final deployed assets | BLOCKED | Final Phase 2 commit and served-asset gate pending. Local results alone do not prove deployment. |

All local integrated checks listed above passed. Final deployment remains an independent release gate. Passing safe unavailable-state behavior does not make blocked external feeds or a predictive model operational.

Reproduction: `node scripts/test_intelligence.cjs`; run the existing JavaScript suites, Python collector/data/split/enrichment/publisher suites, `WEBKIT=1 node scripts/test_mobile.cjs`, and `node scripts/inspect_rendered.cjs` for the complete regression/render workflow.

Real-snapshot images: `/tmp/lakehouse-phase2-real-render`; latest compact intelligence review images: `/tmp/lakehouse-phase2-final-render`. These are local inspection evidence, not application fixture imagery.
