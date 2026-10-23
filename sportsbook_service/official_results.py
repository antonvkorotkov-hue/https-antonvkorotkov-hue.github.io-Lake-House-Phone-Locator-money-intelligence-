"""MLB official final-score adapter with ESPN identity and score corroboration.
Other sports stay pending until an authorized official result adapter is configured.
No administrative API can assign winning outcomes.
"""
import datetime as dt
import json
import httpx
from . import app


def settle_mlb(client=None):
    owns=client is None
    client=client or httpx.Client(timeout=15)
    settled=0
    try:
        with app.db() as c:
            events=[dict(e) for e in c.execute("SELECT * FROM events WHERE sport='mlb' AND state IN ('final','postponed','cancelled')")]
        cache={}
        for e in events:
            if app.now()-e['source_at']>60:continue
            details=json.loads(e['payload']);date=dt.datetime.fromtimestamp(e['starts_at'],dt.timezone.utc).date().isoformat()
            source=f'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date={date}'
            if date not in cache:
                r=client.get(source);r.raise_for_status();cache[date]=r.json()
            candidates=[g for d in cache[date].get('dates',[]) for g in d.get('games',[])
                if g['teams']['home']['team']['name']==details['teams']['home']
                and g['teams']['away']['team']['name']==details['teams']['away']
                and abs(dt.datetime.fromisoformat(g['gameDate'].replace('Z','+00:00')).timestamp()-e['starts_at'])<=10800]
            # Ambiguous doubleheaders and schedule changes require review, never guesses.
            if len(candidates)!=1:continue
            game=candidates[0];state=game['status']['abstractGameState'];detail=game['status'].get('detailedState','').lower()
            result=None
            if state=='Final' and e['state']=='final':
                scores={side:game['teams'][side].get('score') for side in ('home','away')}
                if not all(isinstance(v,int) for v in scores.values()):continue
                if any(str(scores[k])!=str(details.get('scores',{}).get(k)) for k in scores):continue
                result={'state':'final','scores':scores,'official_game_id':game['gamePk'],'corroboration':e['source']}
            elif e['state'] in ('postponed','cancelled') and e['state'] in detail:
                result={'state':e['state'],'official_game_id':game['gamePk'],'corroboration':e['source']}
            if result is None:continue
            with app.db() as c:
                last=c.execute('SELECT * FROM results WHERE event_id=? ORDER BY version DESC LIMIT 1',(e['id'],)).fetchone()
            if last and json.loads(last['payload'])==result:continue
            app.ingest_result(e['id'],last['version']+1 if last else 1,result,source,app.now());settled+=1
    finally:
        if owns:client.close()
    return settled
