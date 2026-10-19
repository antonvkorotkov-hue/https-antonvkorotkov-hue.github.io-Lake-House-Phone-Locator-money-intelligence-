# Phase 2 — independent Rimma review

Status: CONDITIONALLY APPROVED FOR SOURCE-BOUNDED INTELLIGENCE; final deployment gate pending. This is not approval of predictive accuracy, a profitable betting edge, or complete independent source coverage.

## Independent checks performed

- Read `intelligence.js`, its scoring/quote/history logic, `PHASE2-SOURCES.md`, and `scripts/validate_primary.py`.
- Independently ran `node scripts/test_intelligence.cjs`: PASS for four sports, same-provider odds arithmetic, stale/future/wrong-event guards, conservative PASS, lineup/scoring integrity and escaping.
- Independently ran `python scripts/test_source_enrichment.py`: three tests PASS.
- Earlier release source/data review remains applicable only to unchanged modules; final integrated regression and served-file verification remain required.

## Acceptance boundaries

| Area | Status | Evidence / boundary |
|---|---|---|
| Published facts versus estimates | PASS | No-vig same-provider market view and spread/total score arithmetic are explicitly descriptive estimates, not model predictions. Existing live scores are not added. |
| Recommendation sufficiency | PASS | Missing independent calibrated value model produces PASS. Outcome confidence and calibrated score range are unavailable, not invented. This does not deliver an independently validated predictive model. |
| Scoring and momentum | PASS | Exact source scoring observations; period/score checks, team filtering, stale report warning and no extrapolated momentum forecast. Missing sequences remain unavailable. |
| History and recent drives | PASS | Source-listed completed history and last supplied drives are descriptive; no strength-adjusted trend or unsupported forecast. |
| Injuries and starters | PASS | Published injury status does not establish active roster. ESPN-listed starter flags remain attributed to ESPN, not universal independent confirmation. Missing lists do not imply health. |
| Independent four-sport matchup evidence | PASS, LIMITED | Official source matchup/schedule evidence is documented per field in PHASE2-SOURCES.md. NFL/college/NBA schedule relationship was manually checked; automated script checks team mentions plus hardcoded expected time, not full official schedule parsing. |
| Independent all-field corroboration | BLOCKED | Official league/team pages do not provide every odds, roster, injury, weather, detailed statistic or live-clock field. Upcoming games have no live/final measurements. Do not call all fields independently verified. |
| Source disagreements | PASS | MLB official first pitch differs from ESPN by eight minutes; documented conflict must remain visible, without silently claiming agreement. Injury updates with different timestamps must not be merged as simultaneous statuses. |
| Money flow | CONDITIONAL | Preserve existing opening/observation, exchange/sportsbook, percentages/dollars and private-wager distinctions in integrated views. No sharp-bet inference from line movement alone. |
| Six markets / four views | PASS | Theo reports integrated WebKit PASS across four sports, six market selectors, four screens and three phone widths, with real-source multi-matchup checks. |
| Mobile rendered inspection | PASS | Theo reports actual 16-screen and 12-report review; root additionally completed 12-matchup/all-six-selector Games/Trades inspection and three completed NFL expanded timelines without errors; 28 logo requests returned HTTP 200. WebKit emulation does not certify a physical iPhone. |
| Deployed release | PENDING | Final commit, successful CI, Pages output and expanded served module/data hash verification required. |

## Findings resolved during review

Initial module omitted explicit summary failure handling, showed pregame placeholder scores, lacked complete freshness/confidence/risks language, and omitted source history/drives. Revised code adds those paths and conservative scoring checks. The recommendation remains a justified abstention when no independent value model exists; a market favorite alone is not an actionable edge.

## Final claim rule

A release may accurately claim an operational evidence and research interface after final gates pass. It must not claim complete sportsbook feed access, independently validated forecasting, full four-sport field corroboration, or physical-device testing. Missing external data must remain separately BLOCKED; supported implementation defects must be repaired before signoff.

Final code review: compact intelligence preserves market-estimate versus forecast distinctions, confidence remains unavailable, and expanded evidence retains missing inputs. The production independent MLB panel shows the exact eight-minute official/ESPN schedule conflict with timestamps and stale checks; it does not silently reconcile differing starts. Final deployment approval remains pending served-file/CI evidence.

## Deployment evidence reported by release owner

Initial Phase 2 CI `39335033620` passed component suites, WebKit and all 15 served-asset hashes at 22:29:49 UTC. Scheduled collector `39335033631` succeeded, producing data commit `40b6542ab9c0eaddcc73b232c139f3d53f02d99d`: four sports, 12 reports, one limited split entry and 292 exchange markets with no collector errors. Root additionally ran unmocked public WebKit navigation across four sports, six selectors and four screens without request failures or page errors. These are release-owner execution results; Rimma independently reviewed module semantics and reran intelligence/enrichment unit checks.

A final source-clock placeholder guard, cache version Phase 2.1 and corresponding regression/docs followup remain subject to final CI and served-output checks. The initial passing deployment is not substituted for that final code gate. Removing index/document-only collection triggers avoids redundant source refreshes; scheduled, manual and collector-code refresh paths must remain intact. External coverage and predictive model BLOCKED boundaries remain unchanged.

## Published predictor addition

Reviewed the source-provided ESPN Matchup Predictor addition and independently reran `test_intelligence.cjs`: PASS, including nine real saved pregame predictors across NFL (one), college (four), NBA (three) and MLB (one). Exact selected/header/home/away identity, pregame state, fresh report retrieval and paired percentage bounds are required. Source percentages remain verbatim without normalization; explicit positive tie/draw probability causes abstention. Source update time is unknown, and fresh retrieval does not claim a freshly computed model forecast. Agreement with bookmaker favorites is explicitly not independent evidence or a demonstrated edge.

Published ESPN pregame estimates are available conditionally and must not be described as wholly unavailable. The BLOCKED boundary applies to an independently calibrated in-house forecasting/value model, calibrated score range, complete current prices and justified betting edge. Final rendered/CI/served-asset verification must include this module addition.

## QA evidence correction before final release

Theo found that an all-matchup sweep nested inside the viewport/sport loop reset the viewport to 390px, overstating subsequent 375/430px coverage. Earlier reported all-width results are superseded and do not satisfy the final mobile gate. Final publication is held until the corrected harness explicitly asserts each sport's actual 375/390/430px viewport across all four screens and then runs the separate all-matchup sweep. This is a test-coverage defect, not evidence that product rendering failed. Missing team-ID filtering was also tightened; undefined identities must never authorize unscoped source rows. Corrected integrated tests and deployed hashes must include the predictor and identity guard.

Corrected final mobile evidence: Theo run `84217` passed the repaired 375/390/430px × four-sport × four-screen matrix, all six market controls, followed by one separately scoped all-matchup sweep. Rimma inspected the corrected loop nesting: viewport assignment precedes each sport loop; the 390px matchup sweep is outside both width and sport matrix loops. This replaces the earlier overstated coverage claim. Rimma independently reran the final intelligence suite again: 12 real reports, nine published predictors, strict identity/percentage guards and pregame/baseball clock checks PASS. Supported local behavior is approved; final Phase 2.1 CI/served hashes remain the publication gate. External-source, own-model and physical-device limitations remain BLOCKED.
