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
