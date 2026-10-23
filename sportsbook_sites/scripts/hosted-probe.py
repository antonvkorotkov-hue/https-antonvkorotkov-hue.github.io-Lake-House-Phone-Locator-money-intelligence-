import sys,json,urllib.request,urllib.error,termios
if sys.stdin.isatty():
 settings=termios.tcgetattr(sys.stdin);settings[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin,termios.TCSANOW,settings)
print('Ready for private Site access JSON on stdin (input hidden).',flush=True)
a=json.loads(sys.stdin.readline());base=a['url'];headers={'OAI-Sites-Authorization':'Bearer '+a['service_token']}
for path in a.get('paths',['/health']):
 try:
  with urllib.request.urlopen(urllib.request.Request(base+path,headers=headers),timeout=45) as r:d=json.load(r)
  print(json.dumps({'path':path,'status':200,'ok':d.get('ok'),'odds_configured':bool(d.get('odds')),'source':d.get('source'),'provider_error':d.get('providerError'),'markets':len(d.get('odds',[])) if isinstance(d.get('odds'),list) else None}),flush=True)
 except urllib.error.HTTPError as e:print(json.dumps({'path':path,'status':e.code}),flush=True)
