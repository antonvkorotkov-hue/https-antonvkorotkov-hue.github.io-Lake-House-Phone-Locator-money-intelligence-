# Lake House Picks

Existing GitHub Pages application: ESPN scores/statistics/published game quotes and Kalshi sampled public exchange trades.

## Verification

```
npm install --no-save --package-lock=false jsdom@26 playwright@1.61.1
npx playwright install --with-deps webkit
node scripts/test_visual.cjs
WEBKIT=1 node scripts/test_mobile.cjs
python scripts/test_collectors.py
```

The mobile suite exercises the actual index page at 375, 390 and 430px, all four sports, all four screens and six market selectors. Network fixtures make it deterministic; this does not certify a physical iPhone or upstream feed availability.

## Collection and deployment

- `collect_scores.py` records ESPN scoreboards and provider-specific quote history for NFL, college football, NBA and MLB.
- `collect_public.py` samples open Kalshi GAME/SPREAD/TOTAL series across all four sports, retaining per-market collection timestamps and prior transactions on errors. It reads up to 15 events and two markets per event (up to 24 per series, with an eight-minute cycle budget), 100 recent trades per market. This is bounded coverage, not a complete tape.
- Scheduled collection requests run every 10 minutes. GitHub can delay scheduled workflows; the UI labels observation times and stale snapshots. Direct scoreboard refresh runs every minute while the page is visible.
- `pages.yml` runs unit and WebKit mobile checks before deploying static assets, including after collector completion. Bot commits alone do not guarantee a Pages rebuild.
- Quote history starts when collected. First observed quotes are not claimed to be sportsbook opening lines. No earlier history is synthesized.

## External limitations

ESPN may omit prices, reports, injury lists and some markets. No licensed sportsbook feed or credentials are configured for team totals, first-half prices, player props, handle or ticket splits. Those sections explicitly report unavailable data rather than inferred odds. Kalshi contracts and premiums are separate exchange products and are never represented as DraftKings/FanDuel handle. Prices are source observations, not guaranteed executable offers. Public APIs can rate-limit, fail or change schema. Retained snapshots keep their original timestamps.
