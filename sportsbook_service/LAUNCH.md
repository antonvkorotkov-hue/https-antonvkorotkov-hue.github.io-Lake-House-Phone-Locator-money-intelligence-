# Lake House Virtual Sportsbook — deployment checklist

**This branch is not deployed.** The current app supports private user accounts and shared *demo* virtual picks only. There are no real-money transactions. All market prices are invented fixtures; live sports feeds and automatic pick settlement are **not yet implemented**.

## Run on a local development computer
From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r sportsbook_service/requirements.txt
export LH_LEAGUE_DB="$(pwd)/sportsbook_service/league.sqlite3"
export LH_DEV_INSECURE_COOKIE=1
python sportsbook_service/app.py
uvicorn sportsbook_service.app:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000 on that computer. Run `pytest -q sportsbook_service/test_app.py` separately. Do not share development cookies or expose this instance on the public internet.

## Production steps (not yet completed)
1. Choose an HTTPS-capable backend host with a persistent private disk and SQLite backups (or migrate to managed PostgreSQL).
2. Set `LH_LEAGUE_DB` to a private persisted location, `LH_APP_ORIGIN` to the exact HTTPS origin, **do not set** `LH_DEV_INSECURE_COOKIE=1`. Use a secured admin console to initialize the sole owner before opening registration.
3. Put a reverse proxy with HTTPS, request-rate limits, response security headers, and logging in front of the service; harden and audit the app. Do **not** deploy this unreviewed prototype publicly as-is.
4. Configure private recovery codes, backups, session revocation after password changes, monitoring, and anti-abuse controls.
5. Verify two iPhones can sign in separately, invitation redemption works exactly once, accounts stay separate, CSRF works, no plain-text passwords leak, and restarts preserve accounts and picks.
6. Secure a licensed source permitting live-odds redistribution before enabling active real-game pick placement. Show source/provider timestamp and disable stale or unavailable games.

**GitHub Pages cannot run a secure Python server**, so this cannot be published as a working private multi-user app on Pages alone. The backend UI must be served from the HTTPS API host (at `/`). No friend should be invited until the production prerequisites are satisfied.

## Administrator vs participant
The sole administrator can invite users; the admin may also submit virtual picks as a participant. House accounting is **not implemented yet**, and no backend routes can alter winning results or automatically award credits.
