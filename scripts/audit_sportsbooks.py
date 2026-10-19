"""Read-only candidate feed audit; no authentication or private endpoints."""
import concurrent.futures
import datetime as dt
import json
import re
import urllib.error
import urllib.request
URLS=[
'https://data.vsin.com/draftkings/betting-splits/',
'https://data.vsin.com/fanduel/betting-splits/',
'https://vsin.com/betting-splits/',
'https://sportsbook.draftkings.com/leagues/football/nfl',
'https://sportsbook.fanduel.com/navigation/nfl',
]
def audit(url):
    result={'url':url,'checked_at':dt.datetime.now(dt.timezone.utc).isoformat()}
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; LakeHousePicks public source audit)','Accept':'text/html,application/json'})
        with urllib.request.urlopen(req,timeout=15) as response:
            raw=response.read(2000000).decode('utf-8','replace')
            result.update(status=response.status,final_url=response.url,content_type=response.headers.get('Content-Type'),bytes_sampled=len(raw))
        title=re.search(r'<title[^>]*>(.*?)</title>',raw,re.S|re.I)
        result['title']=re.sub('<[^>]+>',' ',title.group(1)).strip() if title else None
        result['signals']={term:len(re.findall(term,raw,re.I)) for term in ['handle','bets','tickets','last updated','Commanders','49ers','2026','subscribe','login','__NEXT_DATA__']}
        result['external_scripts']=re.findall(r'<script[^>]+src=[\"\']([^\"\']+)',raw,re.I)[:12]
        # Short surrounding text reveals whether actual split tables, or merely marketing, are returned.
        text=re.sub(r'<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>',' ',raw,flags=re.S|re.I)
        text=re.sub('<[^>]+>',' ',text)
        text=re.sub(r'\s+',' ',text)
        result['split_excerpts']=[text[max(0,m.start()-80):m.end()+180] for m in list(re.finditer('handle|ticket|updated|Commanders|49ers|subscribe',text,re.I))[:12]]
    except urllib.error.HTTPError as exc:result.update(status=exc.code,error=str(exc))
    except Exception as exc:result.update(status='ERROR',error=str(exc))
    return result
if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as p:print(json.dumps(list(p.map(audit,URLS)),indent=2))
