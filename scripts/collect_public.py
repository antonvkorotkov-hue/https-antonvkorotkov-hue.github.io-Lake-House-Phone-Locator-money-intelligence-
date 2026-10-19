"""Fetch small, explicitly labeled snapshots of public Kalshi sports transactions."""
import datetime as dt
import json
import urllib.parse
import urllib.request
import urllib.error
import time
from pathlib import Path

BASE = "https://api.elections.kalshi.com/trade-api/v2"
SERIES = ["KXNFLGAME", "KXNFLSPREAD", "KXNFLTOTAL", "KXCFBGAME"]
UTC = dt.timezone.utc
def request(path, params):
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(BASE + path + "?" + query,
                                 headers={"Accept":"application/json","User-Agent":"LakeHousePicks-public-research/1.0"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == 3:
                raise
            time.sleep(2 ** attempt * 3)
    raise RuntimeError('Request retries exhausted')

now = dt.datetime.now(UTC).isoformat()
results = []
errors = []
for series in SERIES:
    try:
        events = request("/events", {"series_ticker":series,"status":"open","with_nested_markets":"true","limit":15}).get("events",[])
        market_items = [(e,m) for e in events for m in e.get("markets", [])][:5]
        for event, market in market_items:
            ticker = market.get("ticker")
            if not ticker:
                continue
            try:
                time.sleep(0.6)
                trades = request("/markets/trades",{"ticker":ticker,"limit":100}).get("trades",[])
                sample = []
                for trade in trades:
                    side = trade.get("taker_outcome_side")
                    count = trade.get("count_fp", trade.get("count"))
                    price = trade.get("yes_price_dollars" if side == "yes" else "no_price_dollars")
                    if side not in ("yes","no") or price is None or count is None:
                        continue
                    count, price = float(count), float(price)
                    if count <= 0 or not 0 <= price <= 1:
                        continue
                    sample.append({"id":trade.get("trade_id"),"time":trade.get("created_time"),"side":side,
                                   "contracts":count,"premium_usd":round(count*price,4)})
                results.append({"series":series,"event":event.get("title",event.get("event_ticker")),
                                "ticker":ticker,"market":market.get("title",ticker),
                                "trades":sample,"sample_limit":100,"complete_history":False})
            except Exception as e:
                errors.append(ticker + ": " + str(e)[:120])
    except Exception as e:
        errors.append(series + ": " + str(e)[:120])
payload = {"source":"Kalshi public API","collected_at":now,
           "measurement":"Sampled contract premium by taker outcome, not sportsbook handle or total game volume",
           "markets":results,"errors":errors}
Path("public-trades.json").write_text(json.dumps(payload,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
print(f"Recorded {len(results)} markets and {len(errors)} errors")
