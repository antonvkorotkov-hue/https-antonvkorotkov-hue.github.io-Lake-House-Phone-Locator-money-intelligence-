# Phase 2 — independent source validation and enrichment

Audit time: October 19, 2026, approximately 22:19 UTC. This is field-level validation of selected actual matchups, not a claim every field for every game has been independently verified.

## Independent official sources

| Sport / ESPN event | Independent primary source | Field | Result and evidence |
|---|---|---|---|
| NFL `401873008`, Washington at San Francisco | https://www.nfl.com/schedules/2026/by-week/week-6 | Matchup, home/away, schedule | PASS: league schedule agrees on October 19 at 8:15 p.m. Eastern |
| NFL `401873008` | https://amp.nfl.com/news/nfl-week-6-injury-report-2026-season | Selected injury | PASS: Mike Evans questionable appears in official report and ESPN; this confirms one player, not the whole injury list |
| NFL `401873008` | Same official injury report | Injury list completeness/currentness | BLOCKED: official weekly report and ESPN player updates have different publication times; Christian Kirk is questionable in the weekly report, injured reserve in newer ESPN data. Preserve dates, do not merge statuses as simultaneous |
| NFL `401872995`, Seattle at Denver | https://www.nfl.com/games/seahawks-at-broncos-2026-reg-6 | Final scores, period result | PASS: Seattle 14, Denver 17; official game center includes overtime and agrees with ESPN final/OT |
| NFL `401872995` | Same game center | Quarter/OT scoring | PASS: Seattle 3/0/0/11/0, Denver 0/14/0/0/3; ESPN linescores agree exactly |
| NFL `401872995` | Same game center | Venue | PASS: Denver home venue agrees; no numerical home-field advantage inferred |
| NFL `401872995` | Same game center | Detailed passing/rushing/player statistics | BLOCKED: accessible game-center text did not expose the detailed stats table needed for independent numeric validation |
| College `401871069`, Missouri State at Delaware | https://missouristatebears.com/news/2026/10/16/football-bears-square-off-with-delaware-tuesday-on-espnu | Matchup, venue, schedule | PASS: school athletics preview agrees on Delaware hosting October 20, 6 p.m. Central, equivalent to ESPN 23:00 UTC |
| College `401871069` | Same school preview | Final scores/live clock | BLOCKED: upcoming game; live/final metrics do not yet exist |
| NBA `401909088`, Boston at Detroit | https://www.nba.com/game/bos-vs-det-0022600001 | Matchup, venue, schedule | PASS: official game page agrees on Detroit hosting October 20, 3 p.m. Eastern, equivalent to ESPN 19:00 UTC |
| NBA `401909088` | Same league page | Final/live stats, confirmed starting lineup | BLOCKED: upcoming game; no verified live box score or confirmed starting lineup at audit time |
| MLB `401908028`, Cleveland at Tampa Bay | https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-10-19&hydrate=team,venue | Matchup, home/away, game date | PASS: exact team pair and October 19 official date; official game ID 849815 |
| MLB `401908028` | Same official JSON endpoint | Precise starting time | CONFLICT: official first pitch 00:08 UTC, ESPN schedule 00:00 UTC; eight-minute difference. Keep provider attribution; do not present the two as identical |
| MLB `401908028` | https://baseballsavant.mlb.com/preview?game_date=2026-10-19&game_pk=849815 | Starting lineup | BLOCKED: official preview indicated lineup not yet published; ESPN roster presence alone does not mean a confirmed starting lineup |
| All selected games | Official sources above | Sportsbook odds | BLOCKED for independent official-league comparison: league/team pages do not supply an independently verified bookmaker quote feed. ESPN-published provider odds remain attributed to ESPN/DraftKings |
| All selected games | Official sources above | Ticket/handle percentages | BLOCKED for independent official comparison: no league/team raw betting ledger. Separate limited VSiN public preview is documented in SOURCE-AUDIT.md |
| All selected games | Official sources above | Weather | BLOCKED for independent meteorological validation in this audit. ESPN venue weather remains an attributed snapshot with source collection time |

A source disagreement is not proof one source is fabricated. Start-time conventions and update times differ. The application should show provider context and avoid claiming universal cross-source consistency.

## Implemented enrichment

`collect_scores.py` now retains structured `rosters`, `plays`, and `notes` when ESPN publishes them, in addition to existing box scores, injuries, leaders, previous-five-game form, season series, scoring plays, and drives. These are source fields, not model-generated evaluations.

Each stored report includes `coverage.event_id` and `coverage.field_status`. Missing fields say “not published in this summary”; they are not converted into zeros, empty healthy-roster claims, or fabricated history. Lists retain at most 100 plays, 80 scoring plays, and 30 previous drives. Existing collection timestamps and fallback behavior remain unchanged. Rosters retain source starter flags where provided; no inference turns a roster entry into a confirmed starter.

Actual endpoint checks established:

- NFL completed event `401872995` summary contains six scoring plays and drive history; no top-level `plays` field was returned. Drive-contained plays remain available.
- MLB upcoming event `401908028` summary returned two team roster groups, but no scoring plays yet.
- NBA upcoming event `401909088` play-by-play endpoint returned an empty JSON object. No fake play timeline is generated.
- Upcoming summary `lastFiveGames` and `seasonseries` supply historical context where present; missing data stays absent. No unsupported historical win-rate or betting-return calculation is added.

## Reproduce

- `python scripts/validate_primary.py`: bounded read-only official-source requests; validates matchup mentions/current ESPN schedule identity and compares official MLB JSON. NFL/college/NBA schedule times were manually checked on the cited pages; the script explicitly does not claim full HTML schedule parsing.
- `python scripts/test_source_enrichment.py`: three automated tests verify truncation, preserved source identity, input immutability, field filtering, and missing-data semantics.
- `python scripts/collect_scores.py`: refreshes the existing static artifact using bounded report enrichment; this is the scheduled collector, not a separate application.

At audit time, primary validation returned NFL/college/NBA matchup checks PASS and MLB exact first-pitch CONFLICT. These results do not convert the BLOCKED fields above into PASS.

## Production independent MLB crosscheck

The scheduled collector now requests the official MLB StatsAPI for at most two local event dates. It matches exact home/away full team names and the official schedule date, requiring exactly one candidate. Doubleheaders with ambiguous identical pairs are BLOCKED rather than guessed. `scoreboards.json.independent['mlb:<ESPN event>']` preserves separate ESPN/official starting times, their difference in minutes, official game ID, source URL and check timestamp. It never overrides ESPN fields.

On official-source failure, the prior successful check timestamp is preserved, `stale:true` and error/attempt time are added. Other league collection continues. Seven automated enrichment/crosscheck tests pass, including exact mapping, wrong team rejection, ambiguous doubleheader rejection and failure freshness. Detailed official crosschecks for NFL, college and NBA remain manually scoped to the fields in the table above; no automatic cross-league verification is implied.

To keep mobile snapshots bounded, roster groups retain at most 40 players each, source starter/active flags and statistics, with athlete identity/jersey/position. Large unrelated athlete hot-zone payloads are omitted.
