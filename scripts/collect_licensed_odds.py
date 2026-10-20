"""Optional licensed odds feed. No API key is stored in public Pages files."""
import datetime as dt
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

SPORTS={'nfl':'americanfootball_nfl','college':'americanfootball_ncaaf','nba':'basketball_nba','mlb':'baseball_mlb'}
OUTPUT=Path('licensed-odds.json')
def norm(s): return ''.join(c for c in str(s).casefold() if c.isalnum())
def iso(s):
    try:return dt.datetime.fromisoformat(str(s).replace('Z','+00:00')).astimezone(dt.timezone.utc)
    except (ValueError,TypeError):return None
def match(offer,events):
    h,a=norm(offer.get('home_team')),norm(offer.get('away_team'))
    t=iso(offer.get('commence_time'))
    if not h or not a or t is None:return None
    eligible=[]
    for ev in events:
        teams={c.get('homeAway'):norm(c.get('team',{}).get('displayName')) for c in ev.get('competitions',[{}])[0].get('competitors',[])}
        when=iso(ev.get('date'))
        if teams.get('home')==h and teams.get('away')==a and when and abs((when-t).total_seconds())<=10800:eligible.append(str(ev.get('id')))
    return eligible[0] if len(eligible)==1 else None
def collect(key,scoreboard,fetch=None):
    if fetch is None:
        def fetch(url):
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'LakeHousePicks/odds'}),timeout=15) as r:return json.load(r)
    now=dt.datetime.now(dt.timezone.utc)
    out={'collected_at':now.isoformat(),'source':'The Odds API v4 (licensed)','status':'configured','quotes':[],'errors':[]}
    for sport,api_sport in SPORTS.items():
        params=urllib.parse.urlencode({'apiKey':key,'bookmakers':'draftkings,fanduel','markets':'h2h,spreads,totals','oddsFormat':'american','dateFormat':'iso'})
        url='https://api.the-odds-api.com/v4/sports/'+api_sport+'/odds/?'+params
        try:
            offers=fetch(url)
            if not isinstance(offers,list):raise ValueError('Unexpected provider payload')
            for offer in offers:
                eid=match(offer,scoreboard.get('sports',{}).get(sport,{}).get('events',[]))
                if not eid:continue
                for book in offer.get('bookmakers',[]):
                    if book.get('key') not in ('draftkings','fanduel'):continue
                    updated=iso(book.get('last_update'))
                    if updated is None or not (0<=(now-updated).total_seconds()<=300):continue
                    markets={}
                    for market in book.get('markets',[]):
                        if market.get('key') not in ('h2h','spreads','totals'):continue
                        outcomes=[]
                        for o in market.get('outcomes',[]):
                            p=o.get('price')
                            if isinstance(p,bool) or not isinstance(p,(int,float)) or not (-100000<=p<=100000) or -100<p<100:continue
                            if isinstance(o.get('point'),(int,float)):point=o['point']
                            else:point=None
                            outcomes.append({'name':str(o.get('name',''))[:100],'price':p,'point':point})
                        if outcomes:markets[market['key']]=outcomes
                    if markets:out['quotes'].append({'sport':sport,'event_id':eid,'provider':book['title'],'book_key':book['key'],'source_updated_at':updated.isoformat(),'markets':markets})
        except Exception as exc:
            out['errors'].append(sport+': '+type(exc).__name__)
    return out
if __name__=='__main__':
    key=(os.environ.get('LHP_ODDS_API_KEY') or os.environ.get('THE_ODDS_API_KEY') or '').strip()
    if not key:
        OUTPUT.write_text(json.dumps({'status':'not_configured','quotes':[],'source':'The Odds API v4','errors':[]},indent=2)+'\n')
    else:
        scoreboard=json.loads(Path('scoreboards.json').read_text())
        OUTPUT.write_text(json.dumps(collect(key,scoreboard),indent=2)+'\n')
