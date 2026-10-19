# Public source audit — 2026-10-19

## Verified accessible sources

Public HTTPS requests were executed from the build environment. `python scripts/source_audit.py` reproduces scoreboard coverage without modifying snapshots.

| Source | Endpoint | Verified response |
|---|---|---|
| ESPN NFL | `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=1000` | 14 events; 1 upcoming event with DraftKings current/open moneyline, spread and total |
| ESPN college football | `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=1000` | 25 events; all 25 had current/open quotes; explicit college-football league, not NFL |
| ESPN NBA | `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?limit=1000` | 3 events; 3 with current/open quotes |
| ESPN MLB | `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?limit=1000` | 1 event; 1 with current/open quotes |
| ESPN event summary | `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401873008` | gameInfo, injuries, leaders, boxscore, pickcenter, odds, predictor, standings, lastFiveGames |
| Kalshi discovery | `https://api.elections.kalshi.com/trade-api/v2/series` | Public series catalogue includes game, spread, total, team total, first half and player props |
| Kalshi open events | `/trade-api/v2/events?series_ticker=KXNFLRECYDS&status=open&with_nested_markets=true&limit=1` | Receiving-yards contracts for `KXNFLRECYDS-26OCT19WASSF`; structured player/team UUIDs and strike |
| Kalshi first half | Same events endpoint, `series_ticker=KXNCAAF1HSPREAD` | `KXNCAAF1HSPREAD-26OCT20MOSUDEL`, half-spread contract at 17.5 points |
| Kalshi player props | Same events endpoint, `series_ticker=KXNBAPTS` | `KXNBAPTS-26OCT20BOSDET`, Cade Cunningham 15+ points contract |

Coverage counts are observations at 21:35 UTC, not guarantees of future coverage. Sources may return a schedule/week rather than today's games only.

## Genuine opening prices

ESPN nested `moneyline.home.open.odds`, `pointSpread.home.open.line`, and `total.over.open.line` were verified. For WSH at SF, home ML was -250 open/-395 current, spread -5.5/-7.5 and total 50.5/52.5 at audit time. ESPN supplies no opening timestamp here. Opening values must be labeled provider opening, timestamp unavailable, rather than assigned a fabricated historical time. `close` is ESPN's field name and contains the currently published quote before kickoff; it is not proof the market has settled.

Scheduled snapshots record real collection times and raw provider openings. Only actual observed samples may form historical lines. Source price changes do not prove large bets or a particular wager caused them.

## Collection behavior

- ESPN has a 12-second request timeout and three attempts. Successful sport/report timestamps remain unchanged on failure. Errors and run attempt time are recorded separately.
- Four relevant event reports per sport are fetched, prioritizing live then upcoming events. Reports retain analytics fields and expire after 48 hours. Some league/event reports naturally omit injuries, weather, boxscore or comparisons.
- Quote snapshots retain three days and at most 288 observations per event/provider.
- Kalshi discovers all configured series before round-robin sampling so deeper winner samples cannot starve team/half/props coverage. Sampling is explicitly incomplete, and omitted additional event pages are reported.
- Kalshi retains three days/500 trades per refreshed market, at most 400 market records and a 25,000-trade global snapshot budget. Unrefreshed old markets expire after 14 days. Successful timestamps are not advanced for failed requests. Earlier committed artifacts remain available through Git history.

## External limitations

ESPN-published DraftKings quotes are a legitimate indirect alternative, not a direct authenticated DraftKings feed. The audited scoreboard and summary responses expose full-game moneyline/spread/total but did not expose full sportsbook team totals, first-half prices, player-prop prices, handle or ticket percentages. No authorization was available for a direct licensed sportsbook feed. No FanDuel source was verified. Missing values must stay unavailable, never inferred from exchange trading.

Kalshi contracts are exchange instruments, including team/half/player alternatives when offered. Premium, contract counts, bid/ask and trade activity are not sportsbook betting handle/tickets. Trade samples do not establish complete market turnover or individual bettor positions. Empty samples can mean no returned recent trades and cannot be presented as verified zero demand.

Kalshi opaque `custom_strike` UUIDs are not ESPN team IDs. Game-series event ticker date/pair and verified event title must identify a matchup; player suffixes must never be mistaken for team abbreviations. Availability of a series does not guarantee every game or league offers every instrument.

Scheduled GitHub Actions are best effort and may run late. The UI must expose collection time/staleness, rather than promise exact ten-minute updates or real-time sportsbook service.

## Additional sportsbook/splits audit — 21:41–21:42 UTC

Five actual public HTTPS requests were audited by `scripts/audit_sportsbooks.py` without authentication, private keys or bypasses:

| Candidate | Actual result |
|---|---|
| `https://data.vsin.com/draftkings/betting-splits/` | HTTP 200, redirects to `/betting-splits/?source=dk`; public preview contains one MLB game with full year date and explicit team names, spread and moneyline handle/bet percentages |
| `https://data.vsin.com/fanduel/betting-splits/` | HTTP 200 redirected to `/error/`; no verified FanDuel split data |
| `https://vsin.com/betting-splits/` | HTTP 200 explanatory page; identifies DraftKings as source but no additional verified public table |
| `https://sportsbook.draftkings.com/leagues/football/nfl` | HTTP 200, 195-byte “Site Unavailable” HTML; no direct prices or split data returned |
| `https://sportsbook.fanduel.com/navigation/nfl` | HTTP 200, 195-byte “Site Unavailable” HTML; no direct prices or split data returned |

The earlier unavailability assessment is narrowed: **limited DraftKings splits are publicly accessible through VSiN**. `collect_splits.py` now collects only the rendered public preview and matched Cleveland Guardians at Tampa Bay Rays, October 19, 2026, to ESPN event `401908028` using exact local game date, league and both home/away team names. Five parser/mapping tests pass. Additional premium rows were not accessed.

At 21:42 UTC the public preview showed Cleveland spread handle 58% versus bets 25%, Tampa Bay spread 42% versus 75%; Cleveland moneyline 28% versus 23%, Tampa Bay 72% versus 77%. These are source-reported percentages, not independently audited raw wagers. `ticket_pct` is the displayed bet percentage. A collection observation timestamp is recorded; **the underlying source update timestamp is unavailable** and is null. VSiN's statement that the page updates every five minutes is not evidence that a specific row was published within five minutes.

The total line was 7, but the public markup did not explicitly label which percentage row was over versus under. Total split percentages are therefore omitted pending an unambiguous source label, rather than assigning team rows to a total side by assumption. There are no verified public team-total splits from this source. Limited preview coverage must not be represented as all sports or all DraftKings wagers. Empty, changed or restricted pages preserve prior successful observation times and emit an error.

## Refreshed release snapshot

Observed 2026-10-19 at 21:51 UTC: 202 contract records, 8,391 observed transactions, zero failed-request errors and nine bounded-coverage warnings. Explicit new categories include eight team-total contracts, twelve half contracts and sixteen player-prop contracts. This release check deliberately requested at most two candidates per series; the scheduled collector can sample more within its time budget. First-half winner series returned no open candidates; no winner contracts were invented. MLB first-five-innings coverage is not supplied by the configured half-series set.
