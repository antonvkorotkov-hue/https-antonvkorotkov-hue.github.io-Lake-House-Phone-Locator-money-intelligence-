# Lake House Trading Academy

An iPhone-first educational application. All money is virtual. The app never places real securities orders.

## Working features

- Eight sticky top-navigation destinations and separate screens.
- Practice accounts with a $100,000 virtual opening balance.
- HttpOnly, Secure, SameSite session cookies, hashed server-side session tokens, and a 90-day expiry.
- Private one-time recovery codes. Recovery rotates the code and revokes older device sessions.
- Persistent display names, watchlists and an opening-balance ledger in D1.
- Account-isolated APIs, mutation origin checks, and IP-based request limits.
- Beginner lessons, a labeled hypothetical options-cost calculator, dark/light preference, and iPhone Home Screen metadata.
- Asset-only service-worker caching. Private pages and API responses are never cached by the service worker.

## Not yet available

This is not a completed trading simulator. Stock market-order preview/confirmation, an atomic cash ledger and persistent positions are implemented, but remain disabled until a licensed real-time provider is activated. Market movers, search, news, charts, live valuations, limit-order processing, options execution and expiration processing are not implemented. The app explicitly blocks trading and shows no invented market data. No stock-market API credential was found in the accessible existing projects. A licensed stock/options provider connection and verified entitlements are still required.

The hosted site is public. Practice-account records remain protected by individual server-validated sessions; usernames alone cannot access them.

## Development and checks

Use Node 24 and pnpm. Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, and `pnpm build`.

The account tests run the actual API route implementation against an in-memory SQLite adapter for D1. They cover creation, session persistence, opening ledger, watchlist deduplication, account separation, rename, recovery rotation, revocation, logout, origin checks and request limits. They do not establish hosted D1 or iPhone Safari behavior.

The calculation tests cover stock buy/sell consideration, buying power, ownership, quote freshness, bid/ask validity, market status, limit-price checks, and standard long-option premium calculations. Additional tests run stock previews, buys, sells, saved positions, repeat confirmation, and unavailable-feed rejection through the actual API against isolated synthetic provider fixtures. SQL batch tests cover atomic rollback, idempotency, simultaneous account-version changes, overspending, overselling, cost basis and ledger reconciliation. These tests do not establish a live-provider connection.

## Storage and deployment

The source hosting manifest declares the Site and logical `DB` binding, not credentials. SQL migrations live under `drizzle/`. Apply local migrations only to the local preview database; the Sites publication workflow applies hosted migrations. Runtime credentials belong in protected hosting environment variables, never Git or browser code.

The Site source repository owns hosted publication. The `trading-academy/` directory on the GitHub `feature/trading-academy` branch is the corresponding source copy. Publishing the GitHub branch alone does not deploy this full-stack application, and GitHub Pages cannot run its D1-backed API.

## Market-data activation

The server-only adapter targets Massive REST with fixed-origin HTTPS requests and an Authorization header. Protected runtime variables are `MARKETDATA_API_KEY`, `MARKETDATA_LICENSE_CONFIRMED` and `MARKETDATA_REALTIME_CONFIRMED`. The last two flags must be set to `true` only after the intended display/use entitlements and real-time product access have actually been verified. No credentials or entitlement claims are configured in source.

Each stock preview fetches reference data, current exchange status and a fresh bid/ask quote. Confirmation fetches a new quote and requires the reviewed execution price to remain unchanged. Orders are rejected if the quote is stale, the preview expired, the regular session is closed, or the security is unsupported. The simplified virtual model uses the ask to buy and bid to sell, rounds against the trader to whole cents, assumes full fills, and models no commissions, queue position or slippage.
