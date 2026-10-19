"""Read-only independent official-source checks against collected ESPN events."""
import concurrent.futures
import datetime as dt
import json
import urllib.request
from pathlib import Path
CHECKS=[('nfl','401873008','https://www.nfl.com/schedules/2026/by-week/week-6',['Commanders','49ers'],'2026-10-20T00:15Z'),('college','401871069','https://missouristatebears.com/news/2026/10/16/football-bears-square-off-with-delaware-tuesday-on-espnu',['Missouri State','Delaware'],'2026-10-20T23:00Z'),('nba','401909088','https://www.nba.com/game/bos-vs-det-0022600001',['Celtics','Pistons'],'2026-10-20T19:00Z')]

def official_check(check, scores):
    sport,event_id,url,terms,expected=check
    result={'sport':sport,'event_id':event_id,'source':url,'checked_at':dt.datetime.now(dt.timezone.utc).isoformat()}
    event=next((e for e in scores.get('sports',{}).get(sport,{}).get('events',[]) if str(e.get('id'))==event_id),None)
    if not event:return dict(result,status='BLOCKED',reason='Target ESPN event no longer in current schedule')
    result['espn_date']=event['date'];result['expected_official_date']=expected
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(req,timeout=15) as response:text=response.read(3000000).decode('utf-8','replace')
        result['team_mentions']={term:term.lower() in text.lower() for term in terms}
        result['status']='PASS' if all(result['team_mentions'].values()) and event['date']==expected else 'BLOCKED'
        result['scope']='Matchup mentions and ESPN schedule match manually verified official schedule time; not a full official feed parser.'
    except Exception as exc:result.update(status='BLOCKED',reason=str(exc))
    return result

def mlb_check(scores):
    url='https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-10-19&hydrate=team,venue'
    result={'sport':'mlb','event_id':'401908028','source':url,'checked_at':dt.datetime.now(dt.timezone.utc).isoformat()}
    try:
        with urllib.request.urlopen(url,timeout=15) as response:payload=json.load(response)
        games=[g for d in payload.get('dates',[]) for g in d.get('games',[]) if g.get('teams',{}).get('away',{}).get('team',{}).get('name')=='Cleveland Guardians' and g.get('teams',{}).get('home',{}).get('team',{}).get('name')=='Tampa Bay Rays']
        event=next(e for e in scores['sports']['mlb']['events'] if str(e['id'])=='401908028')
        if len(games)!=1:raise ValueError('Official matchup missing or ambiguous')
        game=games[0]; official=dt.datetime.fromisoformat(game['gameDate'].replace('Z','+00:00'));espn=dt.datetime.fromisoformat(event['date'].replace('Z','+00:00'))
        result.update(matchup_status='PASS',official_start=game['gameDate'],espn_start=event['date'],start_difference_minutes=(official-espn).total_seconds()/60,official_game_id=game['gamePk'],status='PASS' if official==espn else 'BLOCKED: sources disagree on precise first pitch')
    except Exception as exc:result.update(status='BLOCKED',reason=str(exc))
    return result
if __name__=='__main__':
    scores=json.loads(Path('scoreboards.json').read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures=[pool.submit(official_check,c,scores) for c in CHECKS]+[pool.submit(mlb_check,scores)]
        print(json.dumps([f.result() for f in futures],indent=2))
