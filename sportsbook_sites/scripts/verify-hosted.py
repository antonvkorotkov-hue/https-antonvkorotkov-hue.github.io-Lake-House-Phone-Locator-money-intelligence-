"""Verify actual hosted accounts. Private credentials are supplied only on stdin.
Never creates sample odds, fake games or forced results on the deployed database.
"""
import http.cookiejar,json,sys,termios,urllib.request,urllib.error,uuid
if sys.stdin.isatty():
 settings=termios.tcgetattr(sys.stdin);settings[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin,termios.TCSANOW,settings)
print('Ready for hosted acceptance JSON on stdin (input hidden).',flush=True)
a=json.loads(sys.stdin.readline());base=a['url'].rstrip('/');service=a['service_token']
def client():
 jar=http.cookiejar.CookieJar();return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)),jar
owner,oj=client();friend,fj=client();second,sj=client()
def call(c,jar,path,body=None,extra=None):
 headers={'OAI-Sites-Authorization':'Bearer '+service,'Origin':base}
 if body is not None:
  headers['Content-Type']='application/json';headers['X-CSRF-Token']=next((cookie.value for cookie in jar if cookie.name=='lh_csrf'),'')
 headers.update(extra or {});request=urllib.request.Request(base+'/api/sportsbook/'+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
 try:
  with c.open(request,timeout=60) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:
  try:data=json.load(e)
  except Exception:data={}
  return e.code,data

def check(condition,label):
 if not condition:raise AssertionError(label)
 print('PASS '+label,flush=True)
mode=a.get('mode','initial')
if mode=='initial':
 status,data=call(owner,oj,'status');check(status==200 and data.get('database')=='D1','hosted D1 route')
 status,data=call(owner,oj,'setup',{'username':'anton','password':a['owner_password']},{'X-Setup-Secret':a['setup']});print(json.dumps({'setup_status':status,'detail':data.get('detail')}),flush=True);check(status==200,'sole owner initialization')
for c,jar,name,pw in [(owner,oj,'anton',a['owner_password'])]:
 status,data=call(c,jar,'login',{'username':name,'password':pw});check(status==200,'owner username/password login')
if mode=='initial':
 for c,jar,name,pw in [(friend,fj,a['friend_username'],a['friend_password']),(second,sj,a['second_username'],a['second_password'])]:
  status,data=call(owner,oj,'invites',{'starting_points':1000});check(status==200,'owner invitation creation')
  code=data['invitation_code'];status,data=call(c,jar,'join',{'username':name,'password':pw,'invite':code});check(status==200,'independent invited account registration')
  status,data=call(c,jar,'admin');check(status==403,'member denied administrator access')
  status,data=call(c,jar,'me');check(status==200 and data['balance_points']==1000,'member starting balance')
else:
 for c,jar,name,pw in [(friend,fj,a['friend_username'],a['friend_password']),(second,sj,a['second_username'],a['second_password'])]:
  status,data=call(c,jar,'login',{'username':name,'password':pw});check(status==200,'independent member login after redeploy')
status,feed=call(friend,fj,'quotes');check(status==200,'real hosted sports feed retrieval')
print(json.dumps({'events':len(feed.get('events',[])),'quotes':len(feed.get('quotes',[])),'available':sum(not q.get('unavailable_reason') for q in feed.get('quotes',[]))}),flush=True)
if mode=='initial':
 candidates=[q for q in feed.get('quotes',[]) if not q.get('unavailable_reason')]
 if candidates:
  body={'quote_id':candidates[0]['id'],'stake_points':1,'request_key':str(uuid.uuid4())}
  status,pick=call(friend,fj,'picks',body);check(status==200,'real source-backed virtual wager accepted')
  status,again=call(friend,fj,'picks',body);check(status==200 and again.get('duplicate'),'accepted wager retry is idempotent')
 else:print('LIMITATION No fresh authorized quote available; no fake wager substituted',flush=True)
status,picks=call(friend,fj,'picks');check(status==200,'private member wager history')
status,other=call(second,sj,'picks');check(status==200 and len(other)==0,'second member cannot see first member picks')
status,personal=call(owner,oj,'picks');check(status==200 and len(personal)==0,'owner participant history remains separate')
status,report=call(owner,oj,'admin');check(status==200 and report['ledger_sum']==0,'hosted balanced house ledger')
# New network client / cookie jar signs in to the same persisted account.
third,tj=client();status,data=call(third,tj,'login',{'username':a['friend_username'],'password':a['friend_password']});check(status==200,'new session independent-device equivalent login')
status,same=call(third,tj,'picks');check(status==200 and [p['id'] for p in same]==[p['id'] for p in picks],'accepted picks synchronized between sessions')
print(json.dumps({'mode':mode,'friend_pick_count':len(picks),'house_outstanding_points':report['outstanding_return_points'],'ledger_sum':report['ledger_sum']}),flush=True)
