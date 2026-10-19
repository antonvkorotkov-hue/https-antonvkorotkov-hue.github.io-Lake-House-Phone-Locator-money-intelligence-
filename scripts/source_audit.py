"""Read-only reproducible public source coverage audit; emits JSON to stdout."""
import concurrent.futures
import datetime as dt
import json
from collect_scores import SPORTS, BASE, request

def audit(item):
    sport, league = item
    url = BASE+league+'/scoreboard'+('?groups=80&limit=1000' if sport=='college' else '?limit=1000')
    result={'sport':sport,'source':url,'checked_at':dt.datetime.now(dt.timezone.utc).isoformat()}
    try:
        data=request(url); events=data.get('events',[])
        result['events']=len(events)
        result['odds_events']=sum(bool(e.get('competitions',[{}])[0].get('odds')) for e in events)
        result['providers']=sorted({q.get('provider',{}).get('name','Unknown') for e in events for q in e.get('competitions',[{}])[0].get('odds',[])})
        result['opening_events']=sum(any(any(isinstance(v,dict) and bool(v.get('open')) for v in q.get(m,{}).values()) for m in ('moneyline','pointSpread','total') for q in e.get('competitions',[{}])[0].get('odds',[])) for e in events)
        result['status']='PASS'
    except Exception as exc:result.update(status='BLOCKED',error=str(exc))
    return result

if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        print(json.dumps(list(pool.map(audit,SPORTS.items())),indent=2))
