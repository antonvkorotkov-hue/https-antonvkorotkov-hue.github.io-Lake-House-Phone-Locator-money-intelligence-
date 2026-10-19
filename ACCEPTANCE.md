# Lake House Picks — Phase 2 live intelligence acceptance

Release ID: 2026-10-19-phase2. Existing repository preserved. Remote was checked before edits: dde38898bc9b7e6edb7fdf9e4fb98bf1b55a372c, following verified application 5f57cc0fe6. No replacement application was created.

PASS describes the implemented, tested behavior. BLOCKED identifies unavailable corroboration, access, inputs or predictive validation. A safe PASS recommendation is not a claim an unavailable data feed exists. This release must not be described as fully operational across every requested external feed or as an independently validated betting-prediction system.

## Section-by-section checklist

| Area | Status | Supporting evidence / boundary |
|---|---|---|
| 1. Real-world selected matchups | PASS | Saved real reports across NFL, college, NBA, MLB; official-source field audit in PHASE2-SOURCES.md. NFL final Seattle–Denver corroborated score and period scoring; upcoming selected games separately identified. |
| NFL real matchup | PASS | WSH–SF matchup/schedule manually checked official NFL schedule; completed SEA–DEN score 14–17 and quarter/OT scores corroborated official game center. More than one actual NFL matchup exercised. |
| College Football real matchup | PASS | Missouri State–Delaware manually checked official school preview; scheduled game has no actual live/final score yet. Recent results preserved. |
| NBA real matchup | PASS | Boston–Detroit official league page manually checked matchup/schedule; pregame boxscore placeholders withheld from game-performance analysis. |
| MLB real matchup | PASS | CLE–TB exact official full team names, home/away and local date match; dynamic StatsAPI crosscheck preserves official and ESPN timestamps separately. |
| Complete independent score/clock/roster/injury/odds/stat corroboration for all sports | BLOCKED | Official accessible fields differ; upcoming clocks, confirmed lineups and independently verified sportsbook quotes are not universally available. Manual schedule checks are not falsely described as a parsed official live feed. Field matrix in PHASE2-SOURCES.md. |
| Precise MLB start consistency | BLOCKED | Official first pitch 00:08 UTC vs ESPN 00:00 UTC at audit; eight-minute conflict displayed with source/check time. Neither silently replaces the other. |
| 2. Maria concise game intelligence | PASS | Prominent score/status, evidence summary, market view, risks and injury flags; deeper comparisons, history, drives, math and source limitations expand on demand. Engine handles loading, failed, stale and mismatched reports. |
| Score / clock / period | PASS | Published status/clock/period only; pregame scores are dashes; baseball innings are not a football clock. No ticking synthetic clock. |
| Recent scoring / momentum | PASS | Exact validated scoring transitions and recent source drives where supplied; descriptive scoring windows, not inferred future momentum or fabricated starting observations. |
| Injuries / availability / starters | PASS | Published injury statuses and dates; ESPN-listed explicit starter flags; roster presence and appearances do not prove confirmed availability. Missing/independently unconfirmed status disclosed. |
| Confirmed starting lineups / all major injury impact | BLOCKED | Source-listed starters are not universal independently confirmed lineups; no unsupported estimate of an injury's points impact. |
| Home field / weather | PASS | Actual venue/neutral context, supplied numeric weather and units; no arbitrary home-field score adjustment or invented forecast. Independent weather corroboration remains unavailable. |
| Offense / defense / QB / pitcher comparisons | PASS | Scoped current-game comparisons and supplied passing/pitching rows; pregame season-like boxscore fields withheld from game-performance conclusions. Missing fields explicit. |
| Running / passing / scoring / team-total trends | PASS | Supplied descriptive stats, scoring and recent results; no fabricated team-total price or unsupported trend/extrapolation. |
| Recent performance / historical series | PASS | Team-scoped lastFiveGames and seasonseries fields retained and summarized when available; missing history remains unknown. No unsupported betting-return or sample significance claim. |
| 3. Money Flow movement priority | PASS | Opening vs first observed separated; intermediate/current retrieval observations and last-15-minute changes; source, units and time limitations shown. American-odds differences never called probability percentage points. |
| Sportsbook moneyline | PASS | Game/provider-isolated published prices and observed history; source-update time can be unknown; not guaranteed executable offers. |
| Sportsbook spread / MLB run line | PASS | Exact supplied side/line/odds and opening; MLB moneyline-style details never substitute for a run line. |
| Sportsbook game total | PASS | Published full-game over/under lines/prices, genuine source opening and observed history. |
| Sportsbook team totals | BLOCKED | No verified automated sportsbook team-total price feed. Derived market-implied team scores are not team-total betting lines. Exchange thresholds remain distinct. |
| Sportsbook first half / MLB first five | BLOCKED | No verified automated sportsbook interval-price feed; MLB first five is not mislabeled first half. Genuine exchange alternatives appear only when mapped. |
| Sportsbook player props | BLOCKED | No verified automated sportsbook prop-price feed; no guessed player lines or zero-price placeholders. |
| Exchange six-category alternatives | PASS | Exact game/date/team/category/contract mapping; real sampled trades; available categories vary. No conversion of premium into sportsbook handle. |
| Public tickets / dollar-handle percentages | PASS | Limited verified VSiN/DraftKings preview by matched game/side; differences labeled percentage points, unknown publication time explicit. Disagreement does not prove sharp action. |
| Full splits / private sportsbook wagers | BLOCKED | Full subscription/authorized feeds, exact private amounts and individual wager timestamps unavailable. No claimed large-wager causation. |
| 4. Price-history graphs | PASS | Each asks how the selected quote moved; source/open/first/latest/change/units/times and actual observation table. Missing observations never fabricated. |
| Scoring-progression graph | PASS | Real recorded play-order dots, score units, team legend, period/clock/play text and wall-clock gaps; bounded-sample disclosure. No interpolated observations. |
| Team-comparison graphs | PASS | Same-unit, zero-baseline comparisons of supplied fields; raw values and scope accessible in source detail. Pregame placeholders do not become game-performance evidence. |
| Verified market-activity graphs | PASS | Sampled premium and contract count with timestamps and sample limits; absent buckets unobserved, not zero market volume. |
| 5. Recommendation / market assessment engine | PASS | Compares evidence availability across markets and returns PASS without justified independent value. Main risks and confidence limits explicit; existence of a market does not trigger a bet. |
| Most likely outcome | PASS | When valid paired same-provider prices exist, displays the descriptive no-vig bookmaker-implied likely side; never labels it an independent model prediction or calibrated true probability. |
| Projected score / scoring range | BLOCKED | No independently validated predictive model or calibrated range. Where appropriate, same-provider spread+total arithmetic is shown as a quoted market-implied full-game score, never added to a live score or presented as our forecast. |
| Recommendation predictive confidence / profitable edge | BLOCKED | No trained/backtested/calibrated edge model is configured. Evidence quality is not a fabricated probability of winning. |
| 6. Games / Trades / Scores / More | PASS | Four navigation screens preserve selections, source/error states and scoped research. Maria appears on Games/Scores; detailed source statistics expand separately. |
| All sports / six selectors / multiple real matchups | PASS | Deterministic and actual saved-report integration checks across all sports and category controls; exact mapping, wrong-game/provider/period rejection. |
| Freshness / automatic reports / manual refresh | PASS | Source generation guards; game summaries now refresh after 60 seconds without requiring manual force; stale/error/dated fallback and independent-check failure states tested. |
| Research / storage regression | PASS | Existing safe game-scoped evidence, imports, exports, conflict/quota/corrupt-store protection preserved. User entries remain unverified. |
| Safari-engine iPhone viewport QA | PASS | Theo full integrated 375/390/430px WebKit run passed; twelve saved reports, all six market controls, four views and real-render inspection passed. Root inspected compact phone screens and completed NFL scoring timelines. Physical iPhone certification remains unavailable. |
| 7. Deployment / served assets | FAIL | Final release commit, Actions checks and fifteen runtime/report asset matches pending. No final release claim until verified. |
| Scheduled refresh | PASS | Existing ten-minute best-effort workflow preserved; enriched report and official MLB crosscheck collectors locally verified. Final deployed workflow run will be recorded with release evidence. |

## Evidence

PHASE2-SOURCES.md documents primary URLs, actual selected games and field-specific PASS/CONFLICT/BLOCKED results. NFL/college/NBA official schedule relationship was manually checked; validate_primary.py automates only the limited checks it states. MLB production matching is automated and rejects ambiguity.

PHASE2-QA.md records Theo's independent checks. PHASE2-REVIEW.md records Rimma's review and release conditions. SOURCE-AUDIT.md retains public source access and sampling evidence. Existing Phase 1 QA evidence remains in QA-EVIDENCE.md.

Automated suites: test_visual.cjs, test_analytics.cjs, test_intelligence.cjs, test_charts.cjs, test_failure_states.cjs, test_research.cjs, test_splits_ui.cjs, test_mobile.cjs, test_collectors.py, test_source_enrichment.py, test_data_integrity.py, test_publish.py and test_splits.py. inspect_rendered.cjs exercises actual saved reports and rendered screens, not live-feed or physical-device certification.

## External dependencies and delivery boundary

ESPN can omit stats, injuries, weather, starters or sportsbook prices; its published closing/latest quote has no universal source-update timestamp. Direct authorized DraftKings/FanDuel feeds are not configured. Limited public VSiN preview and genuine Kalshi samples are clearly distinct. Full market coverage and independently calibrated forecasting remain BLOCKED rather than disguised as supported facts.

Release evidence will be recorded after the final deployment gate. The delivery message supplies the exact release and data commit, live link and final Actions result.
