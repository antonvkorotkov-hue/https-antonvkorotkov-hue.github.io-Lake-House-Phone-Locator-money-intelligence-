# Lake House Picks — delivery acceptance

Release ID: 2026-10-19-delivery-1. Existing repository: antonvkorotkov-hue/https-antonvkorotkov-hue.github.io-Lake-House-Phone-Locator-money-intelligence-. Baseline checked against remote before changes: 08fc724f22.

Supported application behavior and unavailable external coverage are separate. PASS means the stated behavior was exercised, not that every sportsbook or game supplies that field. BLOCKED means missing source access/data or a test environment boundary. No forecast or guaranteed betting edge is claimed.

## Section-by-section checklist

| Area | Status | Supporting evidence / boundary |
|---|---|---|
| Existing application/repository | PASS | Existing Git history and application extended; no replacement repository; legacy stored records preserved for raw backup. |
| NFL | PASS | Sport, all scoreboard selections, six market selectors and four screens exercised in WebKit. Source audit and core mapping tests. |
| College Football | PASS | ESPN groups=80 broad scoreboard; NCAAF series; MOST/MOSU and MTSU/MTU verified aliases; no NFL substitution. |
| NBA | PASS | Four screens; verified NY/NYK, SA/SAS and other aliases; source team identity checks. |
| MLB | PASS | ET/UTC date boundary and HHMM-bearing ticker regressions; ambiguous same-day doubleheaders withheld rather than merged. |
| Games navigation | PASS | Correct selected matchup, provider, contract and source states. Unique IDs; pregame score placeholders are dashes. |
| Trades navigation | PASS | Exact exchange contract selection persists; no wrong-category chart or sportsbook-handle substitution. |
| Scores navigation | PASS | Selected-event report, team/player fields, source timestamps, error/fallback states. |
| More navigation | PASS | Source diagnostics, acceptance links, game-scoped notes, safe backups/imports and storage errors. |
| Sportsbook Moneyline | PASS | ESPN nested provider current/open fields, provider isolation, American-odds units and opening-to-latest comparison. |
| Sportsbook Spread / MLB run line | PASS | Both supplied sides/prices and source openings; home-line history; no favorite-line sign substitution. |
| Sportsbook Game Total | PASS | Supplied Over/Under quotes, source opening, timestamped points/runs history. |
| Sportsbook Team Totals | BLOCKED | No verified authorized automated sportsbook price feed available. UI says unavailable; exchange alternatives are distinct. |
| Sportsbook First Half | BLOCKED | No verified automated sportsbook half-price feed available. No inferred half lines. |
| Sportsbook Player Props | BLOCKED | No verified automated sportsbook prop-price feed available. No invented player lines. |
| Exchange winner/spread/total alternatives | PASS | Genuine Kalshi sampled contracts, exact outcomes, quote/tape distinction; source collection is bounded, not complete. |
| Exchange team/half/player alternatives | PASS | Refreshed real snapshot: 292 contracts / 7,351 observed trades, including 14 team-total, 20 half and 30 player-prop contracts; exact-contract rendering and integrity tests. Not all instruments are offered in every sport. |
| Injuries / availability | PASS | Source list/status/date only; failed request is not a healthy-roster claim; absent list explicitly unknown. |
| Weather | PASS | Supplied source weather and units, including zero temperature; unavailable weather explicitly unknown. No invented forecast. |
| Home field / venue | PASS | Exact home/away/neutral venue and supplied team records; no arbitrary points adjustment. |
| Offense / defense / comparisons | PASS | Source numeric/nonnumeric statistics table; pair charts share a zero baseline; game/season scope not invented. |
| Quarterbacks | PASS | Football passing rows and source labels; NBA/MLB never labeled quarterbacks. |
| Player statistics / leaders | PASS | Supplied boxscore athletes/categories and leader labels; pregame leaders may be season totals and are labeled accordingly. |
| Opening odds | PASS | Source opening distinct from first observed; opening timestamp explicitly unknown when absent. |
| Current observed odds | PASS | Provider-attributed ESPN close/latest field at retrieval time; not guaranteed live/executable. |
| Historic / late movement | PASS | Actual timestamp observations, first/latest change, source-opening change, last-15-minute observations and no wager-causation inference. |
| Limited sportsbook handle/ticket percentages | PASS | Public VSiN/DraftKings matched MLB moneyline/spread preview, exact ET date/home/away/event; source update time unknown. |
| Full sportsbook split coverage / total & team splits | BLOCKED | Preview is limited/subscription-gated beyond visible rows; unlabeled O/U columns deliberately omitted; no private dollar handle or wager times. |
| Price/line graphs | PASS | Purpose/source/units/times/open/current/change, accessible observation tables; nulls and missing intervals never synthesized. |
| Transaction / history graphs | PASS | Actual sampled premium USD and contract-count buckets; gaps explicitly unsampled, not zero market activity. |
| Feed failure / stale data | PASS | Last-successful timestamps retained; manual refresh races guarded; dated scoreboard/report fallbacks and stale warnings tested. |
| Manual research integrity | PASS | Exact sport/event/market/side/provider comparisons; all user entries unverified; no cross-game mixing. |
| Import / export / storage | PASS | Strict validation, null preservation, XSS/CSV safeguards, quotas, conflict rejection; damaged raw store cannot be silently overwritten. |
| iPhone viewport / Safari engine checks | PASS | WebKit touch tests at 375/390/430px: 144 market interactions, all scoreboard games, all screens, refresh, selectors, observation tables, no errors/document overflow. |
| Actual rendered inspection | PASS | 16 real-snapshot WebKit screens plus deterministic stress fixtures inspected. Eight actual ESPN logo endpoints returned HTTP200. |
| Physical device certification | BLOCKED | No physical iPhone session was available; WebKit emulation is reported accurately, not physical-device testing. |
| Scheduled collection | PASS | Actions run 39331222167 succeeded and pushed d1784fef1d; 292 contracts / 7,351 sampled trades, zero request errors and nine explicit sampling warnings. ESPN reports and split preview also refreshed successfully. Schedules are best effort, requested every ten minutes. |
| Latest Pages release and served assets | PASS | Release 5ef3ff5cf4: verify/deploy run 39331221965 passed all suites and thirteen served-file hash comparisons; Pages run 39331427911 succeeded. The final guard/evidence follow-up uses the same required deployment gate; its final result is linked in the delivery message. |

## Evidence and reproduction

Independent QA: QA-EVIDENCE.md. Source audit with endpoints, actual response evidence and limits: SOURCE-AUDIT.md. Runtime/source fixtures are tests, not live production observations.

Automated suites: test_visual.cjs, test_analytics.cjs, test_charts.cjs, test_failure_states.cjs, test_research.cjs, test_splits_ui.cjs, test_mobile.cjs, test_collectors.py, test_data_integrity.py, test_publish.py and test_splits.py. Actual snapshot render inspection: scripts/inspect_rendered.cjs.

## External-data limits

ESPN public responses can omit injuries, weather, players, stats or prices. Public DK/FanDuel candidate pages returned Site Unavailable, and the VSiN FanDuel candidate returned an error page. Authorized direct feeds are not configured. The VSiN DK preview exposes a limited matched MLB row; publication/update time is absent. Kalshi products are exchange contracts, not DraftKings/FanDuel bets, ticket percentages or total betting handle. Sampling/retention and bounded report caching are documented in SOURCE-AUDIT.md.

## Release evidence

Implementation commit: 5ef3ff5cf41da02475314f5b4f50b7b4ccf9c855. Refreshed data commit: d1784fef1d61475730dbd03ea45c44fb9c9a9201. The following guard/evidence commit is the final release follow-up; its exact SHA and required check results are visible in GitHub history and Actions.

Verify/deploy: https://github.com/antonvkorotkov-hue/https-antonvkorotkov-hue.github.io-Lake-House-Phone-Locator-money-intelligence-/actions/runs/39331221965

Collection: https://github.com/antonvkorotkov-hue/https-antonvkorotkov-hue.github.io-Lake-House-Phone-Locator-money-intelligence-/actions/runs/39331222167

Marcus release review: supported local acceptance rows passed; external limitations remain BLOCKED above. Theo independently exercised component and mobile checks. Rimma independently reviewed integrity, source boundaries and completion claims. Release approval is conditional on the follow-up commit passing CI and served hashes; the delivery message records that final gate result. MLB fallback regression prevents moneyline details from being mislabeled as a run line.
