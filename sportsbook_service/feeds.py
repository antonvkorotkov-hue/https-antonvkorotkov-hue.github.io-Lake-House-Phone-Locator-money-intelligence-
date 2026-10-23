"""Private feed worker. ESPN identity/state; existing optional licensed odds collector.
No public JSON is imported as a trusted offer. Run every 10 seconds on the backend.
Only pregame ML/spread/game totals are enabled by this adapter.
"""
import datetime as dt
import hashlib
import json
import os
import sys
import time
from pathlib import Path

import httpx

from . import app as service
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from collect_licensed_odds import collect

PATHS={'nfl':'football/nfl','college':'football/college-football','nba':'basketball/nba','mlb':'baseball/mlb'}


def timestamp(s):
    return int(dt.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp())


def refresh():
    board={'sports':{}}
    with httpx.Client(timeout=15,follow_redirects=False) as client:
        for sport,path in PATHS.items():
            url=f'https://site.api.espn.com/apis/site/v2/sports/{path}/scoreboard'
            try:
                response=client.get(url);response.raise_for_status(); events=response.json()['events']
                board['sports'][sport]={'events':events}
                for event in events:
                    comp=event['competitions'][0]
                    teams={t['homeAway']:t['team']['displayName'] for t in comp['competitors']}
                    state=event['status']['type']['state']
                    state={'pre':'scheduled','in':'live','post':'final'}.get(state,'unavailable')
                    # Detailed status takes precedence over broad pre/post flags.
                    detail=event['status']['type'].get('name','').lower()
                    for special in ('postponed','cancelled','suspended','delayed'):
                        if special in detail: state=special
                    details={'teams':teams,'scores':{t['homeAway']:t.get('score') for t in comp['competitors']},
                             'clock':event['status'].get('displayClock'),'period':event['status'].get('period'),
                             'status':event['status']['type'].get('detail'),'source':url,'retrieved_at':service.now(),
                             'timestamp_note':'ESPN retrieval time; provider does not expose an event update timestamp'}
                    with service.db() as c:
                        c.execute('''INSERT INTO events VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
                        matchup=excluded.matchup,starts_at=excluded.starts_at,state=excluded.state,
                        source=excluded.source,source_at=excluded.source_at,payload=excluded.payload''',
                        (f'{sport}:{event["id"]}',sport,f'{teams["away"]} @ {teams["home"]}',timestamp(event['date']),state,url,service.now(),json.dumps(details)))
            except (httpx.HTTPError,KeyError,ValueError,IndexError):
                # Never renew freshness following a failed retrieval.
                continue
    from .official_results import settle_mlb
    try:
        settle_mlb()
    except (httpx.HTTPError,KeyError,ValueError):
        pass  # failed corroboration keeps wagers pending
    key=os.environ.get('LHP_ODDS_API_KEY') or os.environ.get('THE_ODDS_API_KEY')
    if not key or os.environ.get('LH_PREGAME_ODDS_AUTHORIZED')!='1':
        return {'sports':len(board['sports']),'odds':'unavailable: API credential and usage authorization required'}
    offers=collect(key,board)
    with service.db() as c:
        c.execute('BEGIN IMMEDIATE')
        c.execute('UPDATE quotes SET suspended=1')
        for offer in offers['quotes']:
            eid=f'{offer["sport"]}:{offer["event_id"]}'
            event=c.execute('SELECT * FROM events WHERE id=?',(eid,)).fetchone()
            if not event or event['state']!='scheduled': continue
            teams=json.loads(event['payload'])['teams']
            source_at=timestamp(offer['source_updated_at'])
            for key,outcomes in offer['markets'].items():
                market={'h2h':'moneyline','spreads':'spread','totals':'total'}[key]
                for o in outcomes:
                    side=next((side for side,name in teams.items() if o['name']==name),None) if key!='totals' else o['name'].lower()
                    if side not in ('home','away','over','under'): continue
                    line=o.get('point');odds=o['price']
                    if isinstance(odds,bool) or not isinstance(odds,int) or not (100<=abs(odds)<=100000): continue
                    if key!='h2h' and (isinstance(line,bool) or not isinstance(line,(int,float))): continue
                    payload=[eid,market,side,line,odds,offer['book_key'],source_at]
                    qid=hashlib.sha256(json.dumps(payload).encode()).hexdigest()
                    selection=f'{o["name"]}'+(f' {line:+g}' if line is not None else '')
                    c.execute('''INSERT INTO quotes VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET suspended=0,received_at=excluded.received_at''',
                        (qid,eid,market,selection,odds,line,side,None,'full',f'The Odds API / {offer["provider"]}',source_at,service.now(),
                         source_at+120,event['starts_at'],0,0,1))
        c.commit()
    return {'sports':len(board['sports']),'odds_quotes':len(offers['quotes']),'errors':offers['errors']}


if __name__=='__main__':
    while True:
        try:
            print(json.dumps(refresh()),flush=True)
        except Exception as e:
            # Never log URLs or exceptions containing provider credentials.
            print(json.dumps({'error':type(e).__name__}),flush=True)
        time.sleep(10)
