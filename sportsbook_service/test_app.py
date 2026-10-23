"""Deterministic fixtures only; no claim that test odds are live."""
import importlib
import json
import sqlite3
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def backend(tmp_path,monkeypatch):
    monkeypatch.setenv('LH_LEAGUE_DB',str(tmp_path/'test.sqlite3'))
    monkeypatch.setenv('LH_DEV_INSECURE_COOKIE','1')
    monkeypatch.delenv('LH_APP_ORIGIN',raising=False)
    monkeypatch.delenv('LH_LIVE_ODDS_AUTHORIZED',raising=False)
    sys.path.insert(0,str(Path(__file__).parent))
    sys.modules.pop('app',None)
    m=importlib.import_module('app');m.bootstrap_admin('owner','very-long-owner-password')
    return m


def login(m,name='owner',password='very-long-owner-password'):
    c=TestClient(m.app)
    r=c.post('/api/login',json={'username':name,'password':password});assert r.status_code==200,r.text
    return c


def post(c,path,body=None):
    return c.post('/api/'+path,json=body,headers={'X-CSRF-Token':c.cookies.get('lh_csrf','')})


def member(m,owner,name='friend',points=1000):
    code=post(owner,'invites',{'starting_points':points}).json()['invitation_code'];c=TestClient(m.app)
    r=c.post('/api/join',json={'username':name,'password':'member-password-123','invite':code});assert r.status_code==200,r.text
    return c,code


def seed(m,market='moneyline',side='home',line=None,period='full',subject=None,odds=-125):
    t=m.now()
    with m.db() as c:
        c.execute("INSERT OR REPLACE INTO events VALUES('nfl:1','nfl','Away @ Home',?,'scheduled','https://official.example/schedule',?,?)",(t+3600,t,json.dumps({'teams':{'home':'Home','away':'Away'}})))
        c.execute('INSERT OR REPLACE INTO quotes VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          ('q1','nfl:1',market,'Home selection',odds,line,side,subject,period,'Fixture provider',t,t,t+120,t+3600,0,0,1))
    return {'quote_id':'q1','stake_points':100,'request_key':'unique-request-123'}


def result(m,home=20,away=10,version=1,**extra):
    m.ingest_result('nfl:1',version,{'state':'final','scores':{'home':home,'away':away},**extra},'https://official.example/result',m.now())


def test_owner_enforcement_and_registration(backend):
    m=backend;a=login(m);b,code=member(m,a)
    assert b.get('/api/me').json()['role']=='member'
    assert post(b,'invites').status_code==403
    for path in ('admin','members'): assert b.get('/api/'+path).status_code==403
    assert b.post('/api/join',json={'username':'other','password':'long-password-123','invite':code}).status_code==400
    assert b.post('/api/join',json={'username':'other','password':'long-password-123','invite':'x'*32,'role':'admin'}).status_code==422
    with pytest.raises(ValueError):m.bootstrap_admin('second','long-password-123')
    with m.db() as c:
        with pytest.raises(sqlite3.IntegrityError):c.execute("INSERT INTO users(username,password_hash,role,balance,created_at) VALUES('intruder','x','admin',0,1)")


def test_isolation_two_devices_and_idempotency(backend):
    m=backend;a=login(m);b,_=member(m,a);c,_=member(m,a,'another');pick=seed(m)
    assert post(b,'picks',pick).json()['duplicate'] is False
    assert post(b,'picks',pick).json()['duplicate'] is True
    assert post(b,'picks',{**pick,'stake_points':101}).status_code==409
    assert b.get('/api/me').json()['balance_points']==900
    assert len(c.get('/api/picks').json())==0
    assert a.get('/api/me').json()['balance_points']==1000
    assert login(m,'friend','member-password-123').get('/api/picks').json()[0]['stake_points']==100
    assert post(b,'picks',{**pick,'request_key':'another-request-key','stake_points':1000}).status_code==400
    assert post(b,'picks',{**pick,'user_id':1}).status_code==422


@pytest.mark.parametrize('field,value,reason',[
 ('source_at',0,'stale'),('received_at',0,'stale'),('expires_at',0,'stale'),('closes_at',0,'closed'),
 ('suspended',1,'suspended'),('licensed',0,'authorization'),('live',1,'Live')])
def test_market_rejections(backend,field,value,reason):
    m=backend;a=login(m);p=seed(m)
    with m.db() as c:c.execute(f'UPDATE quotes SET {field}=?',(value,))
    r=post(a,'picks',p);assert r.status_code==409 and reason.lower() in r.text.lower()
    assert a.get('/api/me').json()['balance_points']==1000


@pytest.mark.parametrize('state',['final','postponed','cancelled','live','suspended'])
def test_closed_event(backend,state):
    m=backend;a=login(m);p=seed(m)
    with m.db() as c:c.execute('UPDATE events SET state=?',(state,))
    assert post(a,'picks',p).status_code==409


def test_event_freshness_future_timestamps_and_unknown(backend):
    m=backend;a=login(m);p=seed(m)
    with m.db() as c:c.execute('UPDATE events SET source_at=?',(m.now()-61,))
    assert post(a,'picks',p).status_code==409
    with m.db() as c:c.execute('UPDATE events SET source_at=?',(m.now()+10,))
    assert post(a,'picks',p).status_code==409
    assert post(a,'picks',{**p,'quote_id':'demo-home'}).status_code==400
    assert a.get('/api/quotes').json()['mode']=='VERIFIED_FEEDS_ONLY'


def test_concurrent_retries_and_balance(backend):
    m=backend;a=login(m);p=seed(m);p['stake_points']=700
    def submit(key):return post(a,'picks',{**p,'request_key':key})
    with ThreadPoolExecutor(max_workers=2) as pool:responses=list(pool.map(submit,['concurrent-key-one','concurrent-key-two']))
    assert sorted(r.status_code for r in responses)==[200,400]
    assert a.get('/api/me').json()['balance_points']==300
    with m.db() as c:
        assert c.execute('SELECT SUM(delta) FROM postings').fetchone()[0]==0
        assert c.execute('SELECT COUNT(*) FROM picks').fetchone()[0]==1


@pytest.mark.parametrize('home,away,status,balance',[(20,10,'win',1080),(10,20,'loss',900),(10,10,'push',1000)])
def test_settlement_idempotency(backend,home,away,status,balance):
    m=backend;a=login(m);p=seed(m);assert post(a,'picks',p).status_code==200
    result(m,home,away);result(m,home,away)
    assert a.get('/api/picks').json()[0]['status']==status
    assert a.get('/api/me').json()['balance_points']==balance
    report=a.get('/api/admin').json();assert report['ledger_sum']==0 and report['outstanding_return_points']==0
    assert report['house_realized_pnl_points']==1000-balance
    with m.db() as c:assert c.execute('SELECT COUNT(*) FROM settlements').fetchone()[0]==1


def test_correction_and_immutable_history(backend):
    m=backend;a=login(m);post(a,'picks',seed(m));result(m)
    result(m,10,20,2);result(m,10,20,2)
    assert a.get('/api/me').json()['balance_points']==900
    assert a.get('/api/picks').json()[0]['status']=='loss'
    with m.db() as c:
        assert c.execute('SELECT COUNT(*) FROM settlements').fetchone()[0]==2
        for statement in ("UPDATE picks SET odds=200","DELETE FROM postings","UPDATE settlements SET payout=0","DELETE FROM audit"):
            with pytest.raises(sqlite3.IntegrityError):c.execute(statement)
    with pytest.raises(ValueError):result(m,99,20,2)


@pytest.mark.parametrize('state',['postponed','cancelled','abandoned'])
def test_void(backend,state):
    m=backend;a=login(m);post(a,'picks',seed(m));m.ingest_result('nfl:1',1,{'state':state},'https://official.example/result',m.now())
    assert a.get('/api/me').json()['balance_points']==1000
    assert a.get('/api/picks').json()[0]['status']=='void'


@pytest.mark.parametrize('market,side,line,period,subject,extra,expected',[
 ('spread','away',10,'full',None,{},'push'),('total','over',29.5,'full',None,{},'win'),
 ('total','under',30,'full',None,{},'push'),('team_total','over',19.5,'full','home',{},'win'),
 ('first_half','home',None,'first_half',None,{'first_half':{'home':0,'away':7}},'loss'),
 ('player_prop','over',50.5,'full','player:rushing',{'props':{'player:rushing':{'participated':True,'value':51}}},'win'),
 ('player_prop','under',50.5,'full','player:rushing',{'props':{'player:rushing':{'participated':False}}},'void')])
def test_market_specific_rules(backend,market,side,line,period,subject,extra,expected):
    m=backend;a=login(m);post(a,'picks',seed(m,market,side,line,period,subject));result(m,**extra)
    assert a.get('/api/picks').json()[0]['status']==expected


def test_missing_prop_remains_pending(backend):
    m=backend;a=login(m);post(a,'picks',seed(m,'player_prop','over',1,'full','player:stat'));result(m)
    assert a.get('/api/picks').json()[0]['status']=='pending'


def test_disable_recovery_csrf_logout(backend):
    m=backend;a=login(m);b,_=member(m,a);uid=b.get('/api/me').json()['id'];p=seed(m)
    assert b.post('/api/picks',json=p).status_code==403
    assert b.post('/api/picks',json=p,headers={'X-CSRF-Token':a.cookies.get('lh_csrf')}).status_code==403
    assert a.post('/api/invites',headers={'Origin':'https://evil.example','X-CSRF-Token':a.cookies.get('lh_csrf')}).status_code==403
    code=post(a,f'members/{uid}/recovery',{}).json()['recovery_code']
    c=TestClient(m.app);body={'username':'friend','password':'new-password-123456','code':code}
    assert c.post('/api/recover',json=body).status_code==200
    assert b.get('/api/me').status_code==401
    assert c.post('/api/recover',json=body).status_code==400
    b=login(m,'friend','new-password-123456')
    change={'enabled':False,'reason':'test disable','request_key':'disable-key-123456'}
    assert post(a,f'members/{uid}',change).status_code==200
    assert b.get('/api/me').status_code==401
    assert b.post('/api/login',json={'username':'friend','password':'new-password-123456'}).status_code==401
    assert post(a,'members/1',{**change,'request_key':'owner-disable-1234'}).status_code==400
    assert post(a,'logout').status_code==200
    assert a.get('/api/me').status_code==401


def test_adjustment_rules_restart_and_sessions(backend):
    m=backend;a=login(m);b,_=member(m,a);uid=b.get('/api/me').json()['id']
    change={'adjustment_points':50,'reason':'test grant','request_key':'grant-request-12345'}
    assert post(a,f'members/{uid}',change).status_code==200
    assert post(a,f'members/{uid}',change).json()['duplicate']
    assert post(a,f'members/{uid}',{**change,'adjustment_points':51}).status_code==409
    assert post(a,'rules',{'max_stake_points':10,'starting_points':500,'max_liability_points':10000}).status_code==200
    p=seed(m);assert post(b,'picks',p).status_code==400
    m.setup()  # process restart path and migration replay
    assert b.get('/api/me').json()['balance_points']==1050
    assert a.get('/api/admin').json()['ledger_sum']==0
    reloaded=importlib.reload(m)
    assert TestClient(reloaded.app,cookies=dict(b.cookies)).get('/api/me').json()['balance_points']==1050


def test_production_gate_headers_and_rate_limit(backend,monkeypatch):
    m=backend;c=TestClient(m.app)
    response=c.get('/');assert "script-src 'self'" in response.headers['content-security-policy']
    assert response.headers['cache-control']=='no-store'
    for _ in range(10):assert c.post('/api/login',json={'username':'bad','password':'invalid-password-123'}).status_code==401
    assert c.post('/api/login',json={'username':'bad','password':'invalid-password-123'}).status_code==429
    monkeypatch.setattr(m,'COOKIE_SECURE',True)
    assert c.get('/').status_code==503
    monkeypatch.setattr(m,'ORIGIN','https://league.example')
    c=TestClient(m.app,base_url='https://league.example')
    # New rate-limit window is unnecessary for checking static secure headers.
    assert 'max-age=' in c.get('/').headers['strict-transport-security']


def test_integer_stakes_and_liability(backend):
    m=backend;a=login(m);p=seed(m)
    for value in (True,1.5,'10',0,-1): assert post(a,'picks',{**p,'stake_points':value}).status_code==422
    assert post(a,'rules',{'max_stake_points':1000,'starting_points':1000,'max_liability_points':10}).status_code==200
    assert post(a,'picks',p).status_code==409


def test_backup_restore(backend,tmp_path,monkeypatch):
    m=backend;a=login(m);post(a,'picks',seed(m))
    from sportsbook_service import ops
    monkeypatch.setattr(ops,'app',m)
    dest=tmp_path/'backup.sqlite3';restored=tmp_path/'restored.sqlite3'
    ops.backup(dest);ops.restore(dest,restored)
    assert dest.stat().st_mode & 0o777==0o600
    with sqlite3.connect(restored) as c:
        assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        assert c.execute('SELECT COUNT(*) FROM picks').fetchone()[0]==1
        assert c.execute('SELECT SUM(delta) FROM postings').fetchone()[0]==0
    with pytest.raises(ValueError):ops.restore(dest,restored)


def test_correction_debt_blocks_spending(backend):
    m=backend;a=login(m);p=seed(m,odds=200);post(a,'picks',p);result(m)
    # Owner simulates funds spent after a win, then the official result is corrected.
    post(a,'members/1',{'adjustment_points':-1150,'reason':'test prior spending','request_key':'debt-adjustment-key'})
    result(m,10,20,2)
    me=a.get('/api/me').json();assert me['balance_points']==-250 and me['available_points']==0
    with m.db() as c:
        c.execute("UPDATE events SET state='scheduled',source_at=?",(m.now(),))
        c.execute('UPDATE quotes SET suspended=0')
    assert post(a,'picks',{**p,'request_key':'debt-new-wager-key'}).status_code==400
    assert a.get('/api/admin').json()['ledger_sum']==0


def test_leaderboard_excludes_pending_stakes_and_grants(backend):
    m=backend;a=login(m);post(a,'picks',seed(m))
    assert a.get('/api/leaderboard').json()[0]['net_points']==0
    result(m)
    assert a.get('/api/leaderboard').json()[0]['net_points']==80


def test_additive_migration_preserves_legacy(backend,tmp_path,monkeypatch):
    m=backend;path=tmp_path/'legacy.sqlite3'
    with sqlite3.connect(path) as c:
        c.executescript('''
        CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL,balance INTEGER NOT NULL,created_at INTEGER NOT NULL);
        CREATE TABLE picks(id INTEGER PRIMARY KEY,user_id INTEGER,quote_id TEXT,event_name TEXT,selection TEXT,odds INTEGER,stake INTEGER,potential_return INTEGER,status TEXT DEFAULT 'pending',request_key TEXT,created_at INTEGER);
        INSERT INTO users VALUES(1,'legacy','hash','admin',90000,1);
        INSERT INTO picks VALUES(1,1,'demo-home','Demo','Home',-125,10000,18000,'pending','legacy-key',1);
        ''')
    monkeypatch.setattr(m,'DB_PATH',str(path));m.setup();m.setup()
    with m.db() as c:
        assert m.balance(c,1)==90000
        assert c.execute('SELECT SUM(delta) FROM postings').fetchone()[0]==0
        assert c.execute("SELECT SUM(delta) FROM postings WHERE account='house'").fetchone()[0]==10000
        assert c.execute('SELECT event_name FROM picks').fetchone()[0]=='Demo'
