# Provider quote confirmation

Odds-API.io documents each market `updatedAt` as the time its price last changed, including an example of an unchanged weekly-old total in a current response:
https://odds-api.io/blog/draftkings-api

Full market snapshots represent the active market set; suspended/withdrawn prices disappear. Replace, never merge:
https://docs.odds-api.io/guides/fetching-odds
https://docs.odds-api.io/guides/websockets

The original two-minute/15-second last-price-change cutoff incorrectly made stable prices unavailable. `source_at` remains the provider's original price-change timestamp. `received_at` records when a successful, full active-market snapshot confirmed that exact selection. Failed requests never refresh it. Quotes expire 120 seconds (prematch) or 15 seconds (live) after confirmation, and still require an ESPN event observation within 60 seconds, explicit provider-use/live authorization, unambiguous teams/kickoff, and an open event/market. Missing/suspended selections invalidate earlier quotes. Database acceptance checks the same confirmation limits atomically with balance deduction. Existing pick snapshots, balances, accounts and posting records are not rewritten.

Observed live check on 2026-10-24: actual college league `usa-college`; 25 ESPN games, 24 matched provider events. The old last-change cutoff rejected 356 prematch markets and 76 live markets in that sample. These counts describe that observation, not ongoing availability.


## ESPN snapshot fallback
ESPN summary `pickcenter` has separate `live`, `close`, and `open` branches. The fallback uses only `live` for an in-progress event; pregame uses explicit `close` fields. It verifies exact game ID, teams, kickoff, live period, clock and score against the independently retrieved ESPN scoreboard. These remain two endpoints from one provider, not independent providers. OFF, suspended, malformed and missing prices are never filled in.

ESPN does not provide a per-price last-change timestamp in this response. The fallback stores the actual HTTP Date as the **snapshot publication timestamp**, never as a price-change timestamp. It requires explicit max-age no greater than 15 seconds for live data (120 seconds pregame), rejects old/future Date and excess Age, and expires live offers no later than source Date + 15 seconds. No event update timestamp or fabricated timestamp authorizes an ESPN offer. The UI identifies ESPN and describes snapshot checks. Accepted records preserve source and terms.

Primary provider refreshes have a shared 45-second minimum budget across sports and event selectors. The research route uses its ESPN adapter rather than making additional unbudgeted primary requests. ESPN fallback and scoreboard polling continue during primary cooldown; the primary retry/reset deadline remains enforced.


## Virtual pick values and cash-out
Open picks are valued only from fresh two-sided prices for the exact accepted market, side, line, period and subject, with both sides from the same named source snapshot. Different spread/total lines are never substituted or interpolated. Normalized implied probability removes the two-sided margin: current estimated return = floor(frozen potential return × normalized implied probability), in hundredths of a virtual point. The fictional cash-out offer is floor(estimated return × 95%). Neither estimate is a real sportsbook offer or redeemable money. Missing exact-line prices leave value unknown and disable cash-out.

Confirmation recomputes the value server-side; the request cannot specify an amount. An unchanged price can survive a snapshot refresh, but the transaction pins and revalidates the latest quote versions and expiry. A unique append-only cash-out record, balanced ledger postings, pick closure and audit event happen atomically. Settlement and cash-out race checks prohibit both paying out; a cashed-out pick never receives later game settlement or corrections. Existing accounts and frozen accepted terms remain unchanged.

## Recorded line movement
Fresh authorized snapshots now persist the featured closest-balanced pair for each game, market, source, period, subject and live/pregame phase in sb_line_movements. This is not a provider-designated main line or sportsbook opening price. Alternate prices can change which pair is featured. No backfill is inferred from mutable quote rows. Repeated unchanged snapshots extend last_seen; price/line changes, reversions and observation gaps create new records. History never authorizes a wager. The public history endpoint returns at most the latest 1,200 records per game/market; charts keep feeds and phases separate and show gaps over 30 seconds live / 180 seconds pregame. Polling occurs while Games is open and uses the existing shared feed budget; this does not add a continuous unattended feed.
