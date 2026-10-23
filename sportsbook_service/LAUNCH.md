# Lake House Virtual Sportsbook — backend operations

## Release status
Development branch only. **No HTTPS deployment or production account exists. Do not merge or invite real members yet.** Existing Lake House Picks production files, feeds and Pages workflow are preserved.

This is free play only: no money, payment credentials, transferable prizes or redemption. All amounts are integer hundredths of virtual points.

## Specific external blockers
- No authorized backend host, server credentials, persistent disk, hostname/DNS or backup destination has been supplied. The available GitHub connection can manage code, not run this Python service.
- The optional existing odds integration needs `LHP_ODDS_API_KEY` (or `THE_ODDS_API_KEY`) **in private backend configuration**, plus confirmed provider permission for this invitation-only virtual wagering use. A public Pages feed is not a trusted private quote source.
- No live odds adapter or live-usage authorization is available. Team totals, first-half markets and player props have no authorized feed adapter. They show Unavailable.
- Official automatic settlement currently has an MLB adapter only. NFL, college and NBA still require official-result adapters. Do not open league wagering before completing and verifying these adapters.
- No physical-iPhone or deployed HTTPS verification has occurred. Docker and reverse proxy deployment also require host verification.

## Backend hosting package
`Dockerfile` builds a non-root Python service. `compose.yaml` runs a single API worker, separate feed worker, durable named SQLite volume and Caddy HTTPS proxy. No API/database port is published directly. Deploy on ONE Linux Docker host with a private local disk; do not replicate SQLite over a network filesystem. Caddy requires an owned hostname resolving to the host and inbound 80/443. Provisioning a host or subscription requires the owner's authorization.

1. Check out the verified commit on the host. Copy `.env.example` to a private file outside the repository (mode 0600). Set `LH_HOSTNAME` and the exact `LH_APP_ORIGIN` for direct/container deployments. Never set `LH_DEV_INSECURE_COOKIE` in production.
2. Build first: `docker compose --env-file /private/league.env -f sportsbook_service/compose.yaml build`.
3. Before starting HTTPS, initialize the only administrator interactively:
   `docker compose --env-file /private/league.env -f sportsbook_service/compose.yaml run --rm league python -m sportsbook_service.app`.
   Choose your username and unique password (12–128 characters). No bootstrap HTTP route exists; a database unique index enforces one admin. The password is prompted, never committed or printed.
4. Keep external access restricted during staging. Start with `docker compose --env-file /private/league.env -f sportsbook_service/compose.yaml up -d`. The API returns 503 without an HTTPS origin or initialized sole owner.
5. Add the private odds credential only after usage rights are confirmed; set `LH_PREGAME_ODDS_AUTHORIZED=1`. This is an operator assertion of authorization, not a license supplied by this project. The feed worker refreshes ESPN and the existing provider collector; it never logs API-key URLs. Polling all four sports consumes provider quota; size the subscription before enabling it. Live wagering remains off.
6. Run the deployed acceptance procedure below, verify backups/restoration and all supported settlement adapters, then approve release. Preserve `main` until that succeeds.

The server trusts the socket peer, not arbitrary forwarded headers. Behind the included proxy the IP limit conservatively applies across that proxy; account limits separately restrict login/recovery attempts. Larger groups require a verified trusted-proxy client-IP configuration and load testing.

## Owner and friend instructions (after verified deployment)
Owner: open the backend HTTPS URL in Safari, sign in, select Admin. Set stake/liability limits. Create an invitation with a chosen starting balance; share its one-time code privately with the intended friend. It expires in 24 hours. Admin also shows all wagers, house realized P/L, outstanding returns, ledger check and individual balances. Enable/disable members, make audited balance adjustments and issue one-hour recovery codes. Disabling revokes sessions. The owner cannot disable the sole owner account.

Friend: open that same HTTPS URL on their own internet connection. In Join by invitation enter the code, a unique username and a 12+ character password. No email is needed. Each member has a private server-side balance and wager history. Select an available game/market, enter a whole-point stake, review the confirmation and accept. The server determines freshness, deadlines and balance. Use My Picks and Leaderboard; Log out ends that session. Safari → Share → Add to Home Screen. The manifest supports standalone launch; physical-iPhone installation needs verification.

Recovery: the owner must verify the friend's identity through their existing private contact channel before issuing a code. The friend enters their username, recovery code and new password in Account recovery. All previous sessions are revoked. Lost owner access: use the private host console with `python -m sportsbook_service.ops owner-password`; this requires host access, never an invitation or public endpoint.

## Accounting and settlement
A wager transfers stake from `member:<id>` to `house` in one `BEGIN IMMEDIATE` transaction. Grants and owner balance adjustments use a separate `issuance` counter-account, not house P/L. The owner bets through their own participant account. Every transfer has equal/opposite append-only postings; their total must always be zero.

Accepted quote, event, sport, selection, odds, line, period, source/update/retrieval timestamps, stake, return and acceptance timestamp are frozen. SQL triggers reject edits to accepted details and audit/posting/result/settlement history. Session permission and balance are rechecked inside the transaction. A member-specific request key prevents retry double debits; reuse with changed payload is rejected.

Rules v1: full-game markets include overtime/extra innings; ties push for supported two-way ML. Spread/total exact ties push. First half uses only verified first-half scores. Player props require an explicit verified participation flag/stat; nonparticipants void. Missing market-specific results remain pending. Postponement/cancellation/abandonment void immediately (documented league policy, not a claim to copy every commercial book's rules). Integer returns round down to hundredths. Verified, increasing official result versions append corrections, never edit accepted wagers. A correction can create a visible member debt if points have already been spent; the debt blocks further spending. No administrative HTTP route grades games.

`official_results.py` cross-checks MLB official StatsAPI final scores with fresh ESPN event identity and scores; ambiguous doubleheaders or conflicts stay pending. Re-polling identical results is idempotent. Corrections must be corroborated. Legacy prototype demo wagers remain labeled legacy records, preserve their balances/reserves and are never graded using fabricated results. A documented migration audit entry records their preservation.

## Feed sources and freshness
- ESPN scoreboard: `https://site.api.espn.com/apis/site/v2/sports/{football/nfl,football/college-football,basketball/nba,baseball/mlb}/scoreboard`. Schedule, score, clock, period/status and identity. The timestamp is retrieval time, explicitly not a provider-supplied event update timestamp. Acceptance requires event retrieval within 60 seconds.
- Existing `scripts/collect_licensed_odds.py`: The Odds API v4, DraftKings/FanDuel book snapshots, pregame ML/spread/full-game totals. Exact team/time matching; immutable quote IDs include provider time and price. Source and retrieval must be at most 120 seconds old; expiry and kickoff are independently enforced. Missing offers from a successful poll suspend prior offers. Failed retrieval cannot extend source freshness.
- MLB official schedule/results: `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=YYYY-MM-DD`. No redistribution license is implied by technical reachability. Confirm relevant provider terms before opening the service.
- Live/halves/team totals/props are not supplied by this adapter. Their settlement arithmetic is fixture-tested, which does not make a feed available.

## Backup and recovery
Use SQLite's backup API, not a plain copy of a live database/WAL. Private command:
`python -m sportsbook_service.ops backup /private/backups/league-YYYYMMDD-HHMM.sqlite3`.
A new backup is mode 0600 and integrity-checked. Schedule daily snapshots plus snapshots before migration, encrypt and transfer them to a separately authorized backup destination, retain versions and test restoration. The Compose backup worker creates a private snapshot at startup and daily thereafter in the private-backups volume. It does not prune backups or provision off-host storage; configure capacity alerts and an authorized encrypted off-host replication/retention policy before release.

Restore while service/feeds are stopped: `python -m sportsbook_service.ops restore BACKUP NEW_DATABASE`. It refuses to overwrite a database. Verify restored balances/history and `PRAGMA integrity_check`, then point `LH_LEAGUE_DB` to the new file and restart. Treat restored session data as sensitive and revoke sessions after incident recovery. Back up the TLS volume/config separately. Never commit DBs, backups, invite/recovery codes or credentials.

## Required deployed acceptance
Record exact release SHA and HTTPS URL. On two independent phones/networks, verify login and one-time invitation, private histories, cross-device same-account sync, hidden/denied Admin for a friend, stake/return/account/house balance calculations, retry handling, stale/suspended/kickoff rejection and logout. Reboot the backend and verify the same session/account/history/balance. Restore a backup into isolated staging and check ledger totals. Exercise a verified official settlement and correction for each enabled sport and market; unavailable markets must remain closed. Record real feed timestamps and source comparisons. Only after this passes may PR #1 be marked ready, merged and released.

## Local verification
`pip install -r sportsbook_service/requirements.txt`
`python -m pytest -q sportsbook_service`
`npm install --no-save --package-lock=false playwright@1.61.1`
`npx playwright install --with-deps webkit`
`node sportsbook_service/test_mobile.cjs`

Mobile tests use real HTTP and independent WebKit contexts against fixtures, not physical phones or deployed live feeds. GitHub Actions runs the same checks and retains test XML/screenshot evidence.
