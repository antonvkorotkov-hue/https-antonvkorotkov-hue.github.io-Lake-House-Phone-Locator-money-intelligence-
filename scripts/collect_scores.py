"""Publish timestamped ESPN scoreboard quotes; never infer missing markets."""
import datetime as dt
import json
import urllib.request
from pathlib import Path
SPORTS = {'nfl':'football/nfl','college':'football/college-football','nba':'basketball/nba','mlb':'baseball/mlb'}

def collect():
    path = Path('scoreboards.json')
    try:
        payload = json.loads(path.read_text())
    except (OSError, ValueError):
        payload = {'sports': {}, 'history': {}}
    payload['errors'] = []
    for sport, league in SPORTS.items():
        try:
            url = 'https://site.api.espn.com/apis/site/v2/sports/' + league + '/scoreboard'
            with urllib.request.urlopen(url, timeout=25) as response:
                data = json.load(response)
            stamp = dt.datetime.now(dt.timezone.utc).isoformat()
            payload['sports'][sport] = {'events': data.get('events', []), 'collected_at': stamp, 'source': url}
            for event in data.get('events', []):
                for quote in event.get('competitions', [{}])[0].get('odds', []):
                    provider = quote.get('provider', {}).get('name', 'Unknown provider')
                    key = sport + ':' + str(event['id']) + ':' + provider
                    point = {'time': stamp, 'provider': provider, 'spread': quote.get('pointSpread', {}).get('home', {}).get('close', {}).get('line'), 'details': quote.get('details'), 'total': quote.get('overUnder'), 'home_moneyline': quote.get('moneyline', {}).get('home', {}).get('close', {}).get('odds', quote.get('homeTeamOdds', {}).get('moneyLine')), 'away_moneyline': quote.get('moneyline', {}).get('away', {}).get('close', {}).get('odds', quote.get('awayTeamOdds', {}).get('moneyLine')), 'home_spread': quote.get('pointSpread', {}).get('home', {}).get('close', {}), 'away_spread': quote.get('pointSpread', {}).get('away', {}).get('close', {}), 'over': quote.get('total', {}).get('over', {}).get('close', {}), 'under': quote.get('total', {}).get('under', {}).get('close', {})}
                    history = payload['history'].setdefault(key, [])
                    history.append(point)
                    payload['history'][key] = history[-1000:]
        except Exception as exc:
            payload['errors'].append(sport + ': ' + str(exc)[:160])
    # Retain only recent event observations, bounded for static hosting.
    cutoff = (dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=14)).isoformat()
    payload['history'] = {k:[p for p in v if p['time'] >= cutoff] for k,v in payload['history'].items() if v and v[-1]['time'] >= cutoff}
    path.write_text(json.dumps(payload, separators=(',', ':'))+'\n')
    print('Scoreboards:', len(payload['sports']), 'Errors:', payload['errors'])

if __name__ == '__main__':
    collect()
