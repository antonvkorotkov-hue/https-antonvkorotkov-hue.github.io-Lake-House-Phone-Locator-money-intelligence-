"""Bounded ESPN snapshots and genuine observed odds; unavailable values stay null."""
import datetime as dt
import json
import time
import urllib.request
from pathlib import Path
SPORTS = {'nfl':'football/nfl','college':'football/college-football','nba':'basketball/nba','mlb':'baseball/mlb'}
BASE = 'https://site.api.espn.com/apis/site/v2/sports/'

def request(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent':'LakeHousePicks-public-research/1.0','Accept':'application/json'})
            with urllib.request.urlopen(req, timeout=12) as response:
                return json.load(response)
        except Exception:
            if attempt == 2: raise
            time.sleep(attempt + 1)

def stamp():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def relevant(event):
    state = event.get('status', {}).get('type', {}).get('state')
    return ({'in':0,'pre':1,'post':2}.get(state,3), event.get('date',''))

def collect():
    path = Path('scoreboards.json')
    try: payload = json.loads(path.read_text())
    except (OSError, ValueError): payload = {}
    for field in ('sports','history','reports'): payload.setdefault(field,{})
    payload.update(attempted_at=stamp(), errors=[], report_errors=[])
    for sport, league in SPORTS.items():
        url = BASE + league + '/scoreboard' + ('?groups=80&limit=1000' if sport == 'college' else '?limit=1000')
        try:
            data = request(url)
            collected = stamp()
            events = data.get('events', [])
            payload['sports'][sport] = {'events':events,'collected_at':collected,'source':url}
            for event in events:
                for quote in event.get('competitions', [{}])[0].get('odds', []):
                    provider = quote.get('provider', {}).get('name', 'Unknown provider')
                    key = sport + ':' + str(event['id']) + ':' + provider
                    point = {'time':collected,'provider':provider,'source':url,'home_spread_line':quote.get('pointSpread',{}).get('home',{}).get('close',{}).get('line'),'details':quote.get('details'),'total':quote.get('overUnder')}
                    for side in ('home','away'):
                        point[side+'_moneyline'] = quote.get('moneyline',{}).get(side,{}).get('close',{}).get('odds',quote.get(side+'TeamOdds',{}).get('moneyLine'))
                        point[side+'_spread'] = quote.get('pointSpread',{}).get(side,{}).get('close',{})
                    for side in ('over','under'): point[side] = quote.get('total',{}).get(side,{}).get('close',{})
                    point['opening'] = {market:{side:values.get('open') for side,values in quote.get(market,{}).items() if isinstance(values,dict) and values.get('open')} for market in ('moneyline','pointSpread','total')}
                    history = payload['history'].setdefault(key,[])
                    # Record observations with their real collection time; never interpolate.
                    history.append(point)
                    payload['history'][key] = history[-288:]
            for event in sorted(events,key=relevant)[:4]:
                key = sport+':'+str(event['id'])
                summary_url = BASE+league+'/summary?event='+str(event['id'])
                try:
                    report=request(summary_url)
                    # Preserve fields used by analytics, without commentary/video payloads.
                    allowed=('header','boxscore','leaders','injuries','gameInfo','pickcenter','odds','againstTheSpread','seasonseries','lastFiveGames','standings','predictor','scoringPlays','drives')
                    payload['reports'][key]={'collected_at':stamp(),'source':summary_url,'report':{k:report[k] for k in allowed if k in report}}
                except Exception as exc: payload['report_errors'].append(key+': '+str(exc)[:160])
        except Exception as exc: payload['errors'].append(sport+': '+str(exc)[:160])
    cutoff=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=3)).isoformat()
    payload['history']={k:[p for p in v if p.get('time','')>=cutoff][-288:] for k,v in payload['history'].items() if v and v[-1].get('time','')>=cutoff}
    report_cutoff=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(hours=48)).isoformat()
    payload['reports']=dict(sorted(((k,v) for k,v in payload['reports'].items() if v.get('collected_at','')>=report_cutoff),key=lambda item:item[1].get('collected_at',''),reverse=True)[:64])
    path.write_text(json.dumps(payload,separators=(',',':'))+'\n')
    print('Scoreboards:',len(payload['sports']),'Reports:',len(payload['reports']),'Errors:',payload['errors'],payload['report_errors'])

if __name__ == '__main__': collect()
