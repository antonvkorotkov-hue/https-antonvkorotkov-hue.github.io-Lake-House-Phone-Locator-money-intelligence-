"""Collect only publicly rendered VSiN/DraftKings split rows, with strict mapping."""
import datetime as dt
import html
import json
import re
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo
SOURCE='https://data.vsin.com/draftkings/betting-splits/'

def clean(s): return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',s))).strip()
def norm(s): return re.sub('[^a-z0-9]','',s.lower())
def percent(s):
    match=re.search(r'(\d+(?:\.\d+)?)\s*%',s)
    if not match: raise ValueError('Missing percentage')
    n=float(match.group(1))
    if not 0<=n<=100: raise ValueError('Percentage out of range')
    return n

def parse(raw,scoreboards,observed):
    entries=[]
    for table in re.findall(r'<table\b[^>]*>(.*?)</table>',raw,re.S|re.I):
        if not re.search(r'sp-source-dk',table): continue
        date=re.search(r'gamedate=(\d{4}-\d{2}-\d{2})',table)
        if not date: continue
        date=date.group(1)
        rows=[]
        for row in re.findall(r'<tr\b[^>]*class=[\"\'][^\"\']*\bsp-row\b[^\"\']*[\"\'][^>]*>(.*?)</tr>',table,re.S|re.I):
            cells=re.findall(r'<td\b[^>]*>(.*?)</td>',row,re.S|re.I)
            team=re.search(r'<a\b[^>]*class=[\"\']sp-team-link[\"\'][^>]*>(.*?)</a>',row,re.S|re.I)
            code=re.search(r'data-gamecode=[\"\'](\d{8})(NFL|CFB|NBA|MLB)\w+[\"\']',row)
            if len(cells)!=11 or not team or not code or code.group(1)!=date.replace('-',''):continue
            sport={'NFL':'nfl','CFB':'college','NBA':'nba','MLB':'mlb'}[code.group(2)]
            try:
                rows.append({'team':clean(team.group(1)),'sport':sport,'game_code':code.group(0).split('=')[1].strip("\"'"),'spread':{'line':clean(cells[2]),'handle_pct':percent(clean(cells[3])),'ticket_pct':percent(clean(cells[4]))},'moneyline':{'line':clean(cells[8]),'handle_pct':percent(clean(cells[9])),'ticket_pct':percent(clean(cells[10]))},'total_line':clean(cells[5])})
            except ValueError:continue
        for i in range(0,len(rows)-1,2):
            away,home=rows[i:i+2]
            if away['sport']!=home['sport'] or away['game_code']!=home['game_code']:continue
            if any(abs(away[k]['handle_pct']+home[k]['handle_pct']-100)>1 or abs(away[k]['ticket_pct']+home[k]['ticket_pct']-100)>1 for k in ('spread','moneyline')):continue
            sport=away['sport']; matches=[]
            for event in scoreboards.get('sports',{}).get(sport,{}).get('events',[]):
                try:eventdate=dt.datetime.fromisoformat(event['date'].replace('Z','+00:00')).astimezone(ZoneInfo('America/New_York')).date().isoformat()
                except (ValueError,KeyError):continue
                teams={c.get('homeAway'):c.get('team',{}).get('displayName','') for c in event.get('competitions',[{}])[0].get('competitors',[])}
                if eventdate==date and norm(teams.get('away',''))==norm(away['team']) and norm(teams.get('home',''))==norm(home['team']):matches.append(event)
            entry={'provider':'DraftKings via VSiN public preview','source_url':SOURCE,'observed_at':observed,'source_updated_at':None,'source_date_text':date,'sport':sport,'event_id':str(matches[0]['id']) if len(matches)==1 else None,'mapping_status':'matched' if len(matches)==1 else 'unmatched: exact date/home/away match missing or ambiguous','away':away,'home':home,'coverage':'Public preview only; additional rows require VSiN subscription. Source update timestamp unavailable.','total_limitation':'Public rows do not explicitly identify over/under sides; total split percentages omitted.'}
            for side in ('away','home'):
                for market in ('spread','moneyline'):
                    quote=entry[side][market];quote['handle_minus_tickets_pp']=quote['handle_pct']-quote['ticket_pct']
            entries.append(entry)
    return entries

def collect():
    path=Path('sportsbook-splits.json'); now=dt.datetime.now(dt.timezone.utc).isoformat()
    try:payload=json.loads(path.read_text())
    except (OSError,ValueError):payload={'entries':[]}
    payload.update(attempted_at=now,errors=[],source_url=SOURCE)
    try:
        req=urllib.request.Request(SOURCE,headers={'User-Agent':'Mozilla/5.0 (compatible; LakeHousePicks public source audit)'})
        with urllib.request.urlopen(req,timeout=15) as response:raw=response.read(2000000).decode('utf-8','replace')
        scores=json.loads(Path('scoreboards.json').read_text())
        entries=parse(raw,scores,now)
        if not entries:raise ValueError('No valid public preview rows; prior observation retained')
        payload.update(entries=entries,collected_at=now)
    except Exception as exc:payload['errors'].append(str(exc)[:200])
    path.write_text(json.dumps(payload,separators=(',',':'))+'\n')
    print('Sportsbook splits:',len(payload['entries']),'Errors:',payload['errors'])
if __name__=='__main__':collect()
