# Lake House Trading Academy

An iPhone-first educational application. All money is virtual. The app never places real securities orders.

## Working features

- Nine sticky top-navigation destinations and separate screens.
- Practice accounts with a $100,000 virtual opening balance.
- HttpOnly, Secure, SameSite session cookies, hashed server-side session tokens, and a 90-day expiry.
- Private one-time recovery codes. Recovery rotates the code and revokes older device sessions.
- Persistent display names, watchlists and an opening-balance ledger in D1.
- Account-isolated APIs, mutation origin checks, and IP-based request limits.
- Beginner lessons, a labeled hypothetical options-cost calculator, dark/light preference, and iPhone Home Screen metadata.
- Asset-only service-worker caching. Private pages and API responses are never cached by the service worker.

## Not yet available

Live stock prices and practice orders still require a licensed provider connection and verified product access. Market/limit order preview, atomic cash reservations and fills, saved positions and measured portfolio history are implemented; actual live operation has not been verified here. Options chains are read-only and options execution/expiration processing are not implemented. Company news, active-stock rankings, index dashboards and daily P/L remain unavailable. Official regulatory/central-bank news is available separately. No missing quote is invented or used to fill an order.

The hosted site is public. Practice-account records remain protected by individual server-validated sessions; usernames alone cannot access them.

## Development and checks

Use Node 24 and pnpm. Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, and `pnpm build`.

The account tests run the actual API route implementation against an in-memory SQLite adapter for D1. They cover creation, session persistence, opening ledger, watchlist deduplication, account separation, rename, recovery rotation, revocation, logout, origin checks and request limits. They do not establish hosted D1 or iPhone Safari behavior.

The calculation tests cover stock buy/sell consideration, buying power, ownership, quote freshness, bid/ask validity, market status, limit-price checks, and standard long-option premium calculations. Additional tests run stock previews, buys, sells, saved positions, repeat confirmation, and unavailable-feed rejection through the actual API against isolated synthetic provider fixtures. SQL batch tests cover atomic rollback, idempotency, simultaneous account-version changes, overspending, overselling, cost basis and ledger reconciliation. These tests do not establish a live-provider connection.

## Storage and deployment

The source hosting manifest declares the Site and logical `DB` binding, not credentials. SQL migrations live under `drizzle/`. Apply local migrations only to the local preview database; the Sites publication workflow applies hosted migrations. Runtime credentials belong in protected hosting environment variables or the encrypted owner-managed settings record, never Git or browser code.

The Site source repository owns hosted publication. The `trading-academy/` directory on the GitHub `feature/trading-academy` branch is the corresponding source copy. Publishing the GitHub branch alone does not deploy this full-stack application, and GitHub Pages cannot run its D1-backed API.

## Market-data activation

The server-only adapter targets Massive REST with fixed-origin HTTPS requests and an Authorization header. Protected runtime variables are `MARKETDATA_API_KEY`, `MARKETDATA_LICENSE_CONFIRMED` and `MARKETDATA_REALTIME_CONFIRMED`. The last two flags must be set to `true` only after the intended display/use entitlements and real-time product access have actually been verified. No credentials or entitlement claims are configured in source.

Each stock preview fetches reference data, current exchange status and a fresh bid/ask quote. Confirmation fetches a new quote and requires the reviewed execution price to remain unchanged. Orders are rejected if the quote is stale, the preview expired, the regular session is closed, or the security is unsupported. The simplified virtual model uses the ask to buy and bid to sell, rounds against the trader to whole cents, assumes full fills, and models no commissions, queue position or slippage.

## Owner connection setup

The public app has an owner-only setup view at `/?setup=marketdata`. It uses verified hosting identity headers and a protected `OWNER_EMAIL` value; a normal practice-account session never grants owner access. The provider key is tested against reference and quote endpoints, then encrypted with AES-GCM using the protected runtime `CREDENTIAL_ENCRYPTION_KEY`. Neither the key nor its ciphertext is returned through an API. The owner must separately verify the provider plan permits the public app’s data use and real-time quotes. A successful endpoint probe is not a license verification or a live-market test.

The automated API tests include owner/non-owner checks, encrypted persistence and key retrieval restricted to server code. Credential encryption tests reject a wrong key and tampered ciphertext. Market-read tests use isolated fixtures to cover search filtering, mover coverage, historical bars and timestamp normalization. No fixtures are used in the deployed application.

## Saved trades, news and options views

Activity includes account-isolated buy/sell history, date and side filters, cursor pagination and expandable execution details. Integration tests confirm buys and partial sales remain in order history and positions after session recovery; another account cannot access them. Trade executions in these tests use isolated fixtures, not a live feed.

News reads the official SEC and Federal Reserve RSS feeds without a market-data credential. It displays only attributed headlines, publication dates and source links. A shared five-minute cache and refresh lease limit upstream requests. Failed refreshes retain the last successful response with a visible warning and its original refresh time. No headlines are fabricated. Content is limited to official regulatory and central-bank announcements.

Options chains require the owner to confirm options-data display rights separately. The API returns a bounded, filterable page of actual provider contracts, preserves each quote’s own delayed/real-time label, and leaves missing prices/Greeks blank. It never returns provider pagination URLs or API keys. Options orders are not enabled. The optional cost example is educational and is not an executable order.

### Pending limits and portfolio valuation
Stock previews support market and DAY/GTC limit orders. Pending buys reserve cash, pending sells reserve shares, and atomic fill guards prevent concurrent orders from using the same funds or shares. Cancellation releases reservations without changing the cash ledger. Limits are checked in the foreground, up to five each minute while the app is visible, and on manual refresh. There is no unattended execution service or backfill of missed crossings. DAY orders expire after their trading date or a confirmed session close.

Portfolio totals use actual provider snapshots with per-position timestamps. Missing marks leave equity unavailable rather than valuing a holding at zero. Saved equity measurements are bucketed to 15 minutes, capped at 200 displayed measurements, and include the original opening balance; they are not reconstructed historical valuations. Daily P/L and options execution remain future work. Live stock data still requires owner activation of a licensed provider key.

### Existing provider subscriptions
Owner setup now supports Finnhub and StockData.org alongside Massive. Finnhub supports company lookup, latest prices, and (when separately enabled and endpoint access verified) real-time bid/ask practice fills using provider market status. StockData.org supports exact-symbol latest IEX price lookup only. Its offset-free local timestamps are preserved as text and never used as execution timestamps. Finnhub valuation is limited to five held symbols per response; portfolios with missing marks remain unvalued. Alternate connections do not support movers, historical charts, or options chains. Quiver is not used for execution quotes. Provider API keys must be entered through owner-only encrypted setup; ChatGPT account access does not supply provider credentials. Existing options permissions are preserved until a connection is replaced; replacement through the simplified setup does not enable options.

## Watchlist and provider repairs

Saved watchlists now request actual provider reports in account-isolated pages of five symbols, with manual refresh, individual source timestamps and per-symbol errors. A failed symbol leaves its price blank while successful reports remain visible. Finnhub/StockData connections show search and latest-price viewing without requesting unsupported movers/history. Authorized delayed display data remains separate from real-time execution eligibility.

The pnpm workspace records the existing sharp override and the required dependency build allowlist; the installer shell entry points retain executable permissions. The frozen dependency install, 23 automated tests, TypeScript check and production build passed for this source update. Tests use isolated fixtures; live provider credentials, hosting migration and physical iPhone behavior were not verified. Browser preview was unavailable.

The existing Site identity is retained in `.openai/hosting.json`. The current connection returned `project_not_found` for that exact project, so this GitHub source update is not a hosted release. Resume from the account/workspace that can access that Site; do not create a replacement or deploy this full-stack source through GitHub Pages.
