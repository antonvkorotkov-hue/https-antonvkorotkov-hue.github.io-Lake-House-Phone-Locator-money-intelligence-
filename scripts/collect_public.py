"""Fetch small, explicitly labeled snapshots of public Kalshi sports transactions."""
import datetime as dt
import json
import urllib.parse
import urllib.request
import urllib.error
import time
import math
from pathlib import Path

BASE = "https://api.elections.kalshi.com/trade-api/v2"
SERIES = [prefix + kind for kind in ("GAME", "SPREAD", "TOTAL") for prefix in ("KXNFL", "KXNCAAF", "KXNBA", "KXMLB")]
UTC = dt.timezone.utc
def request(path, params):
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(BASE + path + "?" + query,
                                 headers={"Accept":"application/json","User-Agent":"LakeHousePicks-public-research/1.0"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == 3:
                raise
            time.sleep(2 ** attempt * 3)
    raise RuntimeError('Request retries exhausted')

now = dt.datetime.now(UTC).isoformat()
previous = {}
old = {}
try:
    old = json.loads(Path("public-trades.json").read_text(encoding="utf-8"))
    previous = {m["ticker"]: m for m in old.get("markets", []) if m.get("ticker")}
except (OSError, ValueError, KeyError, TypeError):
    pass
deadline = time.monotonic() + 480
results = []
errors = []
for series in SERIES:
    if time.monotonic() > deadline:
        errors.append(series + ": collection time budget reached")
        continue
    try:
        events = request("/events", {"series_ticker":series,"status":"open","with_nested_markets":"true","limit":15}).get("events",[])
        market_items = [(e,m) for e in events for m in e.get("markets", [])[:2]][:24]
        for event, market in market_items:
            if time.monotonic() > deadline:
                errors.append(series + ": collection time budget reached; retained prior observations")
                break
            ticker = market.get("ticker")
            if not ticker:
                continue
            try:
                time.sleep(0.6)
                trades = request("/markets/trades",{"ticker":ticker,"limit":100}).get("trades",[])
                sample = []
                for trade in trades:
                    side = trade.get("taker_outcome_side", trade.get("taker_side"))
                    count = trade.get("count_fp", trade.get("count"))
                    price = trade.get("yes_price_dollars" if side == "yes" else "no_price_dollars")
                    if side not in ("yes","no") or price is None or count is None:
                        continue
                    count, price = float(count), float(price)
                    if not math.isfinite(count) or not math.isfinite(price) or count <= 0 or not 0 <= price <= 1:
                        continue
                    sample.append({"id":trade.get("trade_id"),"time":trade.get("created_time"),"side":side,
                                   "contracts":count,"premium_usd":round(count*price,4)})
                merged = {}
                for item in previous.get(ticker, {}).get("trades", []) + sample:
                    key = item.get("id") or "|".join(str(item.get(k)) for k in ("time", "side", "contracts", "premium_usd"))
                    merged[key] = item
                history = sorted(merged.values(), key=lambda t: t.get("time") or "")[-2000:]
                results.append({"series":series,"event":event.get("title",event.get("event_ticker")),
                                "ticker":ticker,"market":market.get("title",ticker),
                                "collected_at":dt.datetime.now(UTC).isoformat(),"trades":history,"sample_limit":100,"complete_history":False})
            except Exception as e:
                errors.append(ticker + ": " + str(e)[:120])
    except Exception as e:
        errors.append(series + ": " + str(e)[:120])
seen_tickers = {m["ticker"] for m in results}
for ticker, old_market in previous.items():
    if ticker not in seen_tickers and old_market.get("trades"):
        old_market.setdefault("collected_at", old.get("collected_at"))
        results.append(old_market)
payload = {"source":"Kalshi public API","attempted_at":now,"collected_at":max((m.get("collected_at", old.get("collected_at", "")) for m in results),default=None),
           "measurement":"Sampled contract premium by taker outcome, not sportsbook handle or total game volume",
           "markets":results,"errors":errors}
Path("public-trades.json").write_text(json.dumps(payload,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
print(f"Recorded {len(results)} markets and {len(errors)} errors")
