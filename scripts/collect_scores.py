"""Bounded ESPN snapshots and genuine observed odds; unavailable values stay null."""
import datetime as dt
import json
import time
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo
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

def bounded_report(report, event_id):
    """Keep genuine structured context while bounding high-frequency play payloads."""
    header_id=report.get('header',{}).get('id')
    if header_id is not None and str(header_id)!=str(event_id):
        raise ValueError('Summary event identity mismatch')
    allowed=('header','boxscore','leaders','injuries','gameInfo','pickcenter','odds','againstTheSpread','seasonseries','lastFiveGames','standings','predictor','scoringPlays','drives','plays','rosters','notes')
    result={k:report[k] for k in allowed if k in report}
    for field,limit in (('plays',100),('scoringPlays',80)):
        if isinstance(result.get(field),list):result[field]=result[field][-limit:]
    if isinstance(result.get('drives'),dict):
        result['drives']=dict(result['drives'])
        previous=result['drives'].get('previous')
        if isinstance(previous,list):result['drives']['previous']=previous[-30:]
    if isinstance(result.get('rosters'),list):
        result['rosters']=[dict(group,roster=[dict(player,athlete={k:v for k,v in player.get('athlete',{}).items() if k in ('id','displayName','fullName','shortName','jersey','position')}) for player in group.get('roster',[])[:40]]) for group in result['rosters'][:2]]
    # Unknown and not-yet-published are distinct from real numeric zero.
    result['coverage']={'event_id':str(event_id),'play_limit':100,'scoring_play_limit':80,'field_status':{k:('available' if result.get(k) else 'not published in this summary') for k in ('boxscore','injuries','gameInfo','rosters','plays','scoringPlays','drives','lastFiveGames','seasonseries')}}
    return result

def independent_mlb(payload, fetch=request):
    """Strict official matchup verification; never overwrite ESPN source fields."""
    independent=payload.setdefault('independent',{})
    events=payload.get('sports',{}).get('mlb',{}).get('events',[])
    dates={}
    for event in events:
        try:
            date=dt.datetime.fromisoformat(event['date'].replace('Z','+00:00')).astimezone(ZoneInfo('America/New_York')).date().isoformat()
            dates.setdefault(date,[]).append(event)
        except (KeyError,ValueError):continue
    for date in sorted(dates)[:2]:
        url='https://statsapi.mlb.com/api/v1/schedule?sportId=1&date='+date+'&hydrate=team,venue'
        try:
            official=fetch(url)
            games=[g for day in official.get('dates',[]) if day.get('date')==date for g in day.get('games',[])]
            for event in dates[date]:
                key='mlb:'+str(event['id'])
                teams={c.get('homeAway'):c.get('team',{}).get('displayName') for c in event.get('competitions',[{}])[0].get('competitors',[])}
                matches=[g for g in games if all(g.get('teams',{}).get(side,{}).get('team',{}).get('name')==teams.get(side) and bool(teams.get(side)) for side in ('home','away'))]
                result={'checked_at':stamp(),'source':url,'matchup_status':'PASS' if len(matches)==1 else 'BLOCKED','espn_start':event.get('date'),'official_start':None,'start_difference_minutes':None,'official_game_id':None,'status':'BLOCKED','stale':False,'reason':'No unique exact date/home/away team match' if len(matches)!=1 else None}
                if len(matches)==1:
                    game=matches[0]
                    result.update(official_start=game.get('gameDate'),official_game_id=game.get('gamePk'))
                    if game.get('gameDate'):
                        difference=(dt.datetime.fromisoformat(game['gameDate'].replace('Z','+00:00'))-dt.datetime.fromisoformat(event['date'].replace('Z','+00:00'))).total_seconds()/60
                        result.update(start_difference_minutes=difference,status='PASS' if difference==0 else 'CONFLICT',reason=None if difference==0 else 'Sources differ on precise starting time; ESPN value preserved')
                independent[key]=result
        except Exception as exc:
            for event in dates[date]:
                key='mlb:'+str(event['id'])
                prior=independent.get(key,{})
                independent[key]=dict(prior,source=url,attempted_at=stamp(),stale=True,error=str(exc)[:160])
                if 'checked_at' not in prior:independent[key].update(status='BLOCKED',matchup_status='BLOCKED',reason='Official source request failed')
    cutoff=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=3)).isoformat()
    payload['independent']={k:v for k,v in independent.items() if v.get('checked_at',v.get('attempted_at',''))>=cutoff}

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
                    payload['reports'][key]={'collected_at':stamp(),'source':summary_url,'report':bounded_report(report,event['id'])}
                except Exception as exc: payload['report_errors'].append(key+': '+str(exc)[:160])
        except Exception as exc: payload['errors'].append(sport+': '+str(exc)[:160])
    cutoff=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=3)).isoformat()
    payload['history']={k:[p for p in v if p.get('time','')>=cutoff][-288:] for k,v in payload['history'].items() if v and v[-1].get('time','')>=cutoff}
    report_cutoff=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(hours=48)).isoformat()
    payload['reports']=dict(sorted(((k,v) for k,v in payload['reports'].items() if v.get('collected_at','')>=report_cutoff),key=lambda item:item[1].get('collected_at',''),reverse=True)[:64])
    independent_mlb(payload)
    path.write_text(json.dumps(payload,separators=(',',':'))+'\n')
    print('Scoreboards:',len(payload['sports']),'Reports:',len(payload['reports']),'Errors:',payload['errors'],payload['report_errors'])

if __name__ == '__main__': collect()
