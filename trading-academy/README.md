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

This is not a completed trading simulator. Market quotes, movers, search, news, charts, stock/option order execution, positions, limit-order processing and expiration processing are not connected. The app explicitly blocks trading and shows no invented market data. No stock-market API credential was found in the accessible existing projects. A licensed stock/options provider connection and verified entitlements are still required.

The private hosted preview uses the hosting platform's owner-only access boundary in addition to the app's practice-account session. Public access has not been enabled.

## Development and checks

Use Node 24 and pnpm. Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, and `pnpm build`.

The account tests run the actual API route implementation against an in-memory SQLite adapter for D1. They cover creation, session persistence, opening ledger, watchlist deduplication, account separation, rename, recovery rotation, revocation, logout, origin checks and request limits. They do not establish hosted D1 or iPhone Safari behavior.

The calculation tests cover stock buy/sell consideration, buying power, ownership, quote freshness, bid/ask validity, market status, limit-price checks, and standard long-option premium calculations. The pure engine is not connected to an order-persistence API yet and does not prove idempotent order execution.

## Storage and deployment

The source hosting manifest declares the Site and logical `DB` binding, not credentials. SQL migrations live under `drizzle/`. Apply local migrations only to the local preview database; the Sites publication workflow applies hosted migrations. Runtime credentials belong in protected hosting environment variables, never Git or browser code.

The Site source repository owns hosted publication. The `trading-academy/` directory on the GitHub `feature/trading-academy` branch is the corresponding source copy. Publishing the GitHub branch alone does not deploy this full-stack application, and GitHub Pages cannot run its D1-backed API.
