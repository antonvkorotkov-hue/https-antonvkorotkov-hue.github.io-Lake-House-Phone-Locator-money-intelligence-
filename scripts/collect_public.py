"""Fetch small, explicitly labeled snapshots of public Kalshi sports transactions."""
import datetime as dt
import json
import urllib.parse
import urllib.request
import urllib.error
import time
import math
import os
from pathlib import Path

BASE = "https://api.elections.kalshi.com/trade-api/v2"
SERIES = [prefix + kind for kind in ("GAME", "SPREAD", "TOTAL") for prefix in ("KXNFL", "KXNCAAF", "KXNBA", "KXMLB")]
EXTRA_SERIES = {**{p+"TEAMTOTAL":"team" for p in ("KXNFL","KXNCAAF","KXNBA","KXMLB")}, **{p+k:"half" for p in ("KXNFL","KXNCAAF","KXNBA") for k in ("1HWINNER","1HSPREAD","1HTOTAL")}, **{p+k:"props" for p,ks in (("KXNFL",("PASSYDS","RSHYDS","RECYDS","PASSTDS")),("KXNBA",("PTS","REB","AST")),("KXMLB",("HR",))) for k in ks}}
SERIES += list(EXTRA_SERIES)
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
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise
            time.sleep(2 ** attempt * 3)
        except (urllib.error.URLError, TimeoutError, OSError):
            if attempt == 3: raise
            time.sleep(attempt + 1)
    raise RuntimeError('Request retries exhausted')

now = dt.datetime.now(UTC).isoformat()
previous = {}
old = {}
try:
    old = json.loads(Path("public-trades.json").read_text(encoding="utf-8"))
    previous = {m["ticker"]: m for m in old.get("markets", []) if m.get("ticker")}
except (OSError, ValueError, KeyError, TypeError):
    pass
deadline = time.monotonic() + int(os.environ.get("LHP_COLLECTION_SECONDS", "480"))
market_depth = max(1, int(os.environ.get("LHP_MARKETS_PER_SERIES", "24")))
results = []
errors = []
coverage_warnings = []
discovered = []
for series in SERIES:
    if time.monotonic() > deadline:
        coverage_warnings.append(series + ": discovery time budget reached")
        continue
    try:
        data = request("/events", {"series_ticker":series,"status":"open","with_nested_markets":"true","limit":(3 if series in EXTRA_SERIES else 15)})
        events = data.get("events", [])
        items = [(e,m) for e in events for m in e.get("markets", [])[:2]][:min(market_depth,(4 if series in EXTRA_SERIES else 24))]
        for _, market in items:
            market["_lh_quote_observed_at"] = dt.datetime.now(UTC).isoformat()
        discovered.append((series, items))
        print(f"Discovered {series}: {len(items)} sampled market candidates", flush=True)
        if data.get("cursor"):
            coverage_warnings.append(series + ": additional event pages omitted by bounded sampling policy")
    except Exception as exc:
        errors.append(series + ": " + str(exc)[:120])
# Round-robin gives every configured series a first observation before deeper sampling.
for position in range(max((len(items) for _,items in discovered),default=0)):
    print(f"Trade sampling round {position+1}; successful markets {len(results)}", flush=True)
    for series, items in discovered:
        if position >= len(items): continue
        market_items = items[position:position+1]
        try:
            for event, market in market_items:
                if time.monotonic() > deadline:
                    coverage_warnings.append(series + ": collection time budget reached; retained prior observations")
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
                        try:
                            count, price = float(count), float(price)
                        except (TypeError, ValueError):
                            continue
                        if not math.isfinite(count) or not math.isfinite(price) or count <= 0 or not 0 <= price <= 1:
                            continue
                        sample.append({"id":trade.get("trade_id"),"time":trade.get("created_time"),"side":side,
                                       "contracts":count,"price_usd":price,"premium_usd":round(count*price,4)})
                    merged = {}
                    for item in previous.get(ticker, {}).get("trades", []) + sample:
                        key = item.get("id") or "|".join(str(item.get(k)) for k in ("time", "side", "contracts", "premium_usd"))
                        merged[key] = item
                    cutoff = (dt.datetime.now(UTC) - dt.timedelta(days=3)).isoformat()
                    history = [t for t in sorted(merged.values(), key=lambda t: t.get("time") or "") if (t.get("time") or "") >= cutoff][-500:]
                    results.append({"series":series,"event":event.get("title",event.get("event_ticker")),
                                    "ticker":ticker,"event_ticker":event.get("event_ticker"),"category":EXTRA_SERIES.get(series, "winner" if series.endswith("GAME") else "spread" if series.endswith("SPREAD") else "total"),"market":market.get("title",ticker),"yes_sub_title":market.get("yes_sub_title"),"floor_strike":market.get("floor_strike"),"custom_strike":market.get("custom_strike"),"yes_bid_dollars":market.get("yes_bid_dollars"),"yes_ask_dollars":market.get("yes_ask_dollars"),"last_price_dollars":market.get("last_price_dollars"),
                                    "quote_observed_at":market.get("_lh_quote_observed_at"),"collected_at":dt.datetime.now(UTC).isoformat(),"trades":history,"sample_limit":100,"complete_history":False,"history_retention_days":3,"history_limit":500})
                except Exception as e:
                    errors.append(ticker + ": " + str(e)[:120])
        except Exception as e:
            errors.append(series + ": " + str(e)[:120])
seen_tickers = {m["ticker"] for m in results}
for ticker, old_market in previous.items():
    if ticker not in seen_tickers and old_market.get("trades") and (old_market.get("collected_at", old.get("collected_at")) or "") >= (dt.datetime.now(UTC)-dt.timedelta(days=14)).isoformat():
        old_market.setdefault("collected_at", old.get("collected_at"))
        results.append(old_market)
# Keep the static phone snapshot bounded; Git retains earlier releases.
results = sorted(results, key=lambda m: m.get("collected_at") or "", reverse=True)[:400]
per_market_budget = min(500, max(2, 25000 // max(1, len(results))))
for market in results:
    market["trades"] = [t for t in market.get("trades", []) if (t.get("time") or "") >= (dt.datetime.now(UTC)-dt.timedelta(days=3)).isoformat()][-per_market_budget:]
    market["snapshot_trade_limit"] = per_market_budget
payload = {"history_retention_days":3,"max_markets":400,"max_snapshot_trades":25000,"coverage":"At most 15 events per series, two markets per event; last 100 returned trades per requested market. Sample, not complete tape.","source":"Kalshi public API","attempted_at":now,"collected_at":max((m.get("collected_at", old.get("collected_at", "")) for m in results),default=None),
           "measurement":"Sampled contract premium by taker outcome, not sportsbook handle or total game volume",
           "markets":results,"errors":errors,"coverage_warnings":coverage_warnings}
Path("public-trades.json").write_text(json.dumps(payload,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
print(f"Recorded {len(results)} markets and {len(errors)} errors")
