"""Private free-play league. Integer hundredths; no payments or monetary prizes."""
import hashlib
import json
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlsplit

from argon2 import PasswordHasher
from fastapi import FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from pydantic import BaseModel, Field, ConfigDict, StrictInt

DB_PATH = os.environ.get('LH_LEAGUE_DB', str(Path(__file__).parent / 'league.sqlite3'))
COOKIE_SECURE = os.environ.get('LH_DEV_INSECURE_COOKIE') != '1'
ORIGIN = os.environ.get('LH_APP_ORIGIN', '')
ph = PasswordHasher()
DUMMY_HASH = ph.hash(secrets.token_urlsafe(32))
app = FastAPI(title='Lake House free-play league', docs_url=None, redoc_url=None, openapi_url=None)
SPORTS = ('nfl', 'college', 'nba', 'mlb')
MARKETS = ('moneyline', 'spread', 'total', 'team_total', 'first_half', 'player_prop')
STARTING_POINTS = 100000


@contextmanager
def db():
    c = sqlite3.connect(DB_PATH, timeout=15, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    c.execute('PRAGMA busy_timeout=15000')
    try:
        yield c
    finally:
        if c.in_transaction:
            c.rollback()
        c.close()


def digest(s):
    return hashlib.sha256(s.encode()).hexdigest()


def now():
    return int(time.time())


def audit(c, actor, action, payload):
    c.execute('INSERT INTO audit(actor,action,payload,created_at) VALUES(?,?,?,?)',
              (actor, action, json.dumps(payload, sort_keys=True), now()))


def transfer(c, source, target, amount, kind, reference):
    """Every operation has equal and opposite entries; transactions own atomicity."""
    if amount < 0:
        source, target, amount = target, source, -amount
    tid = secrets.token_hex(16)
    c.executemany('INSERT INTO postings(tx,account,delta,kind,reference,created_at) VALUES(?,?,?,?,?,?)',
                  [(tid, source, -amount, kind, reference, now()),
                   (tid, target, amount, kind, reference, now())])


def balance(c, uid):
    return c.execute('SELECT COALESCE(SUM(delta),0) FROM postings WHERE account=?',
                     (f'member:{uid}',)).fetchone()[0]


def setup():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with db() as c:
        c.execute('PRAGMA journal_mode=WAL')
        c.executescript('''
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','member')),
          balance INTEGER NOT NULL CHECK(balance>=0),created_at INTEGER NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS only_one_admin ON users(role) WHERE role='admin';
        CREATE TABLE IF NOT EXISTS invites(digest TEXT PRIMARY KEY,expires_at INTEGER NOT NULL,
          used_by INTEGER REFERENCES users(id));
        CREATE TABLE IF NOT EXISTS sessions(digest TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS picks(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),
          quote_id TEXT NOT NULL,event_name TEXT NOT NULL,selection TEXT NOT NULL,odds INTEGER NOT NULL,
          stake INTEGER NOT NULL,potential_return INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',
          request_key TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(user_id,request_key));
        CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY,user_id INTEGER,delta INTEGER,kind TEXT,reference TEXT,created_at INTEGER);
        CREATE TABLE IF NOT EXISTS postings(id INTEGER PRIMARY KEY,tx TEXT NOT NULL,account TEXT NOT NULL,
          delta INTEGER NOT NULL,kind TEXT NOT NULL,reference TEXT NOT NULL,created_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS postings_account ON postings(account);
        CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor INTEGER,action TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS recovery(digest TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,window INTEGER NOT NULL,hits INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY,value INTEGER NOT NULL);
        INSERT OR IGNORE INTO config VALUES('max_stake',1000000),('starting_balance',100000),('max_liability',100000000);
        CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,sport TEXT NOT NULL,matchup TEXT NOT NULL,
          starts_at INTEGER NOT NULL,state TEXT NOT NULL,source TEXT NOT NULL,source_at INTEGER NOT NULL,payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS quotes(id TEXT PRIMARY KEY,event_id TEXT REFERENCES events(id),market TEXT NOT NULL,
          selection TEXT NOT NULL,odds INTEGER NOT NULL,line REAL,side TEXT,subject TEXT,period TEXT NOT NULL,
          source TEXT NOT NULL,source_at INTEGER NOT NULL,received_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,
          closes_at INTEGER NOT NULL,live INTEGER NOT NULL,suspended INTEGER NOT NULL,licensed INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS results(event_id TEXT NOT NULL,version INTEGER NOT NULL,payload TEXT NOT NULL,
          source TEXT NOT NULL,source_at INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(event_id,version));
        CREATE TABLE IF NOT EXISTS settlements(id INTEGER PRIMARY KEY,pick_id INTEGER REFERENCES picks(id),
          version INTEGER NOT NULL,status TEXT NOT NULL,payout INTEGER NOT NULL,source TEXT NOT NULL,created_at INTEGER NOT NULL,
          UNIQUE(pick_id,version));
        CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
        ''')
        # Additive migration retains the original users, wagers and audit data.
        for table, column, declaration in [
            ('users','enabled','INTEGER NOT NULL DEFAULT 1'),
            ('sessions','csrf','TEXT'), ('invites','starting_balance','INTEGER'),
            ('picks','snapshot','TEXT'), ('picks','event_id','TEXT'),
            ('picks','result_version','INTEGER NOT NULL DEFAULT 0')]:
            if column not in {r['name'] for r in c.execute(f'PRAGMA table_info({table})')}:
                c.execute(f'ALTER TABLE {table} ADD COLUMN {column} {declaration}')
        c.execute('BEGIN IMMEDIATE')
        if not c.execute('SELECT 1 FROM migrations WHERE version=2').fetchone():
            for u in c.execute('SELECT * FROM users').fetchall():
                transfer(c, 'issuance', f'member:{u["id"]}', u['balance'], 'migration', str(u['id']))
            for p in c.execute("SELECT * FROM picks WHERE status='pending'").fetchall():
                transfer(c, 'issuance', 'house', p['stake'], 'legacy_reserve', str(p['id']))
            c.execute('DELETE FROM sessions')  # old CSRF cookies were not bound to sessions
            c.execute('INSERT INTO migrations VALUES(2)')
            audit(c, None, 'migration_v2', {'legacy_pending': 'Preserved; never settled from fabricated demo results'})
        for table in ('postings', 'audit', 'settlements', 'results'):
            for operation in ('UPDATE', 'DELETE'):
                c.execute(f"CREATE TRIGGER IF NOT EXISTS immutable_{table}_{operation} BEFORE {operation} ON {table} BEGIN SELECT RAISE(ABORT,'Append-only audit data'); END")
        c.execute("CREATE TRIGGER IF NOT EXISTS immutable_pick BEFORE UPDATE OF user_id,quote_id,event_name,selection,odds,stake,potential_return,request_key,created_at,snapshot,event_id ON picks BEGIN SELECT RAISE(ABORT,'Accepted wager is immutable'); END")
        c.commit()


setup()


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Credentials(Model):
    username: str = Field(min_length=3, max_length=32, pattern=r'^[A-Za-z0-9_]+$')
    password: str = Field(min_length=12, max_length=128)


class Join(Credentials):
    invite: str = Field(min_length=12, max_length=128)


class Recover(Credentials):
    code: str = Field(min_length=12, max_length=128)


class Pick(Model):
    quote_id: str = Field(max_length=128)
    stake_points: StrictInt = Field(ge=1, le=10000)
    request_key: str = Field(min_length=12, max_length=80)


class Invite(Model):
    starting_points: StrictInt | None = Field(default=None, ge=0, le=1000000)


class MemberChange(Model):
    enabled: bool | None = None
    adjustment_points: StrictInt = Field(default=0, ge=-1000000, le=1000000)
    reason: str = Field(min_length=3, max_length=300)
    request_key: str = Field(min_length=12, max_length=80)


class Rules(Model):
    max_stake_points: StrictInt = Field(ge=1, le=10000)
    starting_points: StrictInt = Field(ge=0, le=1000000)
    max_liability_points: StrictInt = Field(ge=1, le=10000000)


def get_user(request, c=None):
    token = request.cookies.get('lh_session', '')
    def query(conn):
        return conn.execute('''SELECT u.*,s.csrf AS session_csrf FROM sessions s JOIN users u ON u.id=s.user_id
          WHERE s.digest=? AND s.expires_at>? AND u.enabled=1''', (digest(token), now())).fetchone()
    if c is None:
        with db() as conn:
            row = query(conn)
    else:
        row = query(c)
    if not row:
        raise HTTPException(401, 'Login required or account disabled')
    return dict(row)


def owner(request, c=None):
    u = get_user(request, c)
    if u['role'] != 'admin':
        raise HTTPException(403, 'Sole administrator only')
    return u


def require_mutation(request, token):
    u = get_user(request)
    if not token or not u['session_csrf'] or not secrets.compare_digest(digest(token), u['session_csrf']):
        raise HTTPException(403, 'CSRF token required')
    check_origin(request)
    return u


def check_origin(request):
    origin = request.headers.get('origin')
    if origin and origin != (ORIGIN or str(request.base_url).rstrip('/')):
        raise HTTPException(403, 'Origin mismatch')
    if request.headers.get('sec-fetch-site') == 'cross-site':
        raise HTTPException(403, 'Cross-site request blocked')


def new_session(c, response, uid):
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    c.execute('INSERT INTO sessions(digest,user_id,expires_at,csrf) VALUES(?,?,?,?)',
              (digest(token), uid, now()+86400*14, digest(csrf)))
    for name, value, http_only in [('lh_session', token, True), ('lh_csrf', csrf, False)]:
        response.set_cookie(name, value, httponly=http_only, secure=COOKIE_SECURE,
                            samesite='strict', max_age=86400*14, path='/')


def bootstrap_admin(username, password):
    creds = Credentials(username=username, password=password)
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        if c.execute("SELECT 1 FROM users WHERE role='admin'").fetchone():
            raise ValueError('Administrator already exists')
        uid = c.execute("INSERT INTO users(username,password_hash,role,balance,created_at) VALUES(?,?,'admin',0,?)",
                        (creds.username.lower(), ph.hash(creds.password), now())).lastrowid
        transfer(c, 'issuance', f'member:{uid}', STARTING_POINTS, 'initial_grant', 'bootstrap')
        audit(c, uid, 'bootstrap', {})
        c.commit()


@app.middleware('http')
async def security(request: Request, call_next):
    if not COOKIE_SECURE and request.url.hostname not in ('localhost','127.0.0.1','testserver'):
        return JSONResponse({'detail':'Insecure development mode is localhost only'},status_code=503)
    # Refuse public service startup without a sole owner and configured HTTPS origin.
    if COOKIE_SECURE and (not ORIGIN.startswith('https://') or urlsplit(ORIGIN).path not in ('', '/')):
        return JSONResponse({'detail':'Service not provisioned: configure exact LH_APP_ORIGIN HTTPS origin'}, status_code=503)
    with db() as c:
        if COOKIE_SECURE and not c.execute("SELECT 1 FROM users WHERE role='admin'").fetchone():
            return JSONResponse({'detail':'Private owner initialization required'}, status_code=503)
    if request.method == 'POST':
        if len(await request.body()) > 16384:
            return JSONResponse({'detail':'Request too large'}, status_code=413)
        # Persistent limiter; source IP is the socket peer, never an untrusted X-Forwarded-For.
        ip = request.client.host if request.client else 'unknown'
        key = digest(ip + (request.url.path if request.url.path in ('/api/login','/api/join','/api/recover') else '/mutations'))
        window = now()//60
        keys = [key]
        if request.url.path in ('/api/login','/api/recover'):
            try:
                username = (await request.json()).get('username', '')
                if isinstance(username,str): keys.append(digest('account:' + username.lower()))
            except (ValueError, AttributeError):
                pass
        with db() as c:
            c.execute('BEGIN IMMEDIATE')
            c.execute('DELETE FROM rate_limits WHERE window<?', (window-2,))
            hits = 0
            for key in keys:
                c.execute('''INSERT INTO rate_limits VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET
                    hits=CASE WHEN window=excluded.window THEN hits+1 ELSE 1 END,window=excluded.window''', (key, window))
                hits = max(hits,c.execute('SELECT hits FROM rate_limits WHERE key=?',(key,)).fetchone()[0])
            c.commit()
        if hits > (10 if request.url.path in ('/api/login','/api/join','/api/recover') else 120):
            return JSONResponse({'detail':'Too many attempts; retry in one minute'}, status_code=429, headers={'Retry-After':'60'})
    response = await call_next(request)
    response.headers.update({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
        'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"})
    if COOKIE_SECURE:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000'
    return response


@app.post('/api/login')
def login(body: Credentials, request: Request, response: Response):
    check_origin(request)
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        u = c.execute('SELECT * FROM users WHERE username=?',(body.username.lower(),)).fetchone()
        try:
            ph.verify(u['password_hash'] if u else DUMMY_HASH, body.password)
            if not u or not u['enabled']:
                raise ValueError()
        except Exception:
            raise HTTPException(401, 'Invalid credentials')
        new_session(c, response, u['id'])
        audit(c, u['id'], 'login', {})
        c.commit()
    return {'ok':True}


@app.post('/api/join')
def join(body: Join, request: Request, response: Response):
    check_origin(request)
    hashed = ph.hash(body.password)
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        inv = c.execute('SELECT * FROM invites WHERE digest=?',(digest(body.invite),)).fetchone()
        if not inv or inv['used_by'] is not None or inv['expires_at'] <= now():
            raise HTTPException(400,'Invitation invalid or expired')
        try:
            uid = c.execute("INSERT INTO users(username,password_hash,role,balance,created_at) VALUES(?,?,'member',0,?)",
                            (body.username.lower(), hashed, now())).lastrowid
        except sqlite3.IntegrityError:
            raise HTTPException(409,'Username unavailable')
        c.execute('UPDATE invites SET used_by=? WHERE digest=?',(uid,digest(body.invite)))
        transfer(c,'issuance',f'member:{uid}',inv['starting_balance'] if inv['starting_balance'] is not None else STARTING_POINTS,'initial_grant',str(uid))
        new_session(c,response,uid)
        audit(c,uid,'joined',{})
        c.commit()
    return {'ok':True}


@app.get('/api/me')
def me(request: Request):
    u = get_user(request)
    with db() as c:
        b = balance(c,u['id'])
    return {'id':u['id'],'username':u['username'],'role':u['role'], 'balance_points':b/100,
            'available_points':max(0,b)/100,'debt_points':max(0,-b)/100}


@app.post('/api/logout')
def logout(request: Request,response: Response,x_csrf_token: str | None = Header(None)):
    require_mutation(request,x_csrf_token)
    with db() as c:
        c.execute('DELETE FROM sessions WHERE digest=?',(digest(request.cookies.get('lh_session','')),))
    for key in ('lh_session','lh_csrf'):
        response.delete_cookie(key,path='/')
    return {'ok':True}


@app.post('/api/invites')
def invite(request: Request, body: Invite = Invite(), x_csrf_token: str | None = Header(None)):
    require_mutation(request,x_csrf_token)
    code = secrets.token_urlsafe(32)
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        u = owner(request,c)
        starting = body.starting_points*100 if body.starting_points is not None else c.execute("SELECT value FROM config WHERE key='starting_balance'").fetchone()[0]
        c.execute('INSERT INTO invites(digest,expires_at,starting_balance) VALUES(?,?,?)',
                  (digest(code),now()+86400,starting))
        audit(c,u['id'],'invitation_created',{'starting_points':starting/100})
        c.commit()
    return {'invitation_code':code,'expires_in_seconds':86400}


@app.post('/api/members/{uid}/recovery')
def issue_recovery(uid:int, request:Request,x_csrf_token:str|None=Header(None)):
    require_mutation(request,x_csrf_token)
    code=secrets.token_urlsafe(32)
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        u=owner(request,c)
        if not c.execute('SELECT 1 FROM users WHERE id=?',(uid,)).fetchone():
            raise HTTPException(404,'Member not found')
        c.execute('DELETE FROM recovery WHERE user_id=?',(uid,))
        c.execute('INSERT INTO recovery VALUES(?,?,?)',(digest(code),uid,now()+3600))
        audit(c,u['id'],'recovery_issued',{'member_id':uid})
        c.commit()
    return {'recovery_code':code,'expires_in_seconds':3600}


@app.post('/api/recover')
def recover(body:Recover,request:Request):
    check_origin(request)
    hashed=ph.hash(body.password)
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        r=c.execute('''SELECT r.*,u.username,u.enabled FROM recovery r JOIN users u ON u.id=r.user_id
             WHERE r.digest=? AND r.expires_at>?''',(digest(body.code),now())).fetchone()
        if not r or r['username']!=body.username.lower() or not r['enabled']:
            raise HTTPException(400,'Recovery code invalid or expired')
        c.execute('UPDATE users SET password_hash=? WHERE id=?',(hashed,r['user_id']))
        c.execute('DELETE FROM recovery WHERE user_id=?',(r['user_id'],))
        c.execute('DELETE FROM sessions WHERE user_id=?',(r['user_id'],))
        audit(c,r['user_id'],'password_recovered',{})
        c.commit()
    return {'ok':True}


@app.post('/api/members/{uid}')
def change_member(uid:int,body:MemberChange,request:Request,x_csrf_token:str|None=Header(None)):
    require_mutation(request,x_csrf_token)
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        u=owner(request,c)
        target=c.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone()
        if not target: raise HTTPException(404,'Member not found')
        reference=f'admin:{u["id"]}:{body.request_key}'
        prior=c.execute("SELECT payload FROM audit WHERE action='member_change' AND json_extract(payload,'$.reference')=?",(reference,)).fetchone()
        payload={'member_id':uid,**body.model_dump(),'reference':reference}
        if prior:
            if json.loads(prior[0])!=payload: raise HTTPException(409,'Request key reused')
            return {'ok':True,'duplicate':True}
        if target['role']=='admin' and body.enabled is False: raise HTTPException(400,'Cannot disable sole owner')
        if body.adjustment_points:
            if balance(c,uid)+body.adjustment_points*100<0: raise HTTPException(400,'Adjustment exceeds balance')
            transfer(c,'issuance',f'member:{uid}',body.adjustment_points*100,'admin_adjustment',reference)
        if body.enabled is not None:
            c.execute('UPDATE users SET enabled=? WHERE id=?',(int(body.enabled),uid))
            if not body.enabled: c.execute('DELETE FROM sessions WHERE user_id=?',(uid,))
        audit(c,u['id'],'member_change',payload)
        c.commit()
    return {'ok':True,'duplicate':False}


@app.post('/api/rules')
def rules(body:Rules,request:Request,x_csrf_token:str|None=Header(None)):
    require_mutation(request,x_csrf_token)
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        u=owner(request,c)
        for key,value in [('max_stake',body.max_stake_points*100),('starting_balance',body.starting_points*100),('max_liability',body.max_liability_points*100)]:
            c.execute('UPDATE config SET value=? WHERE key=?',(value,key))
        audit(c,u['id'],'rules_changed',body.model_dump())
        c.commit()
    return {'ok':True}


def quote_reason(q,e,t):
    if not q['licensed']: return 'Provider usage authorization missing'
    if q['suspended']: return 'Market suspended'
    if e['state'] not in ('scheduled','live'): return 'Event closed, postponed or cancelled'
    if t>=q['closes_at'] or (not q['live'] and (e['state']!='scheduled' or t>=e['starts_at'])): return 'Market closed'
    if q['live'] and (os.environ.get('LH_LIVE_ODDS_AUTHORIZED')!='1' or e['state']!='live'): return 'Live odds not authorized or event not live'
    ttl=15 if q['live'] else 120
    if not 0<=t-q['source_at']<=ttl or not 0<=t-q['received_at']<=ttl or t>=q['expires_at']: return 'Odds expired or stale'
    if not 0<=t-e['source_at']<=60: return 'Event state stale'
    return None


@app.get('/api/quotes')
def quotes(request:Request):
    get_user(request)
    with db() as c:
        events=[dict(e) for e in c.execute('SELECT * FROM events ORDER BY starts_at DESC LIMIT 200')]
        offers=[]
        for e in events:
            e['details']=json.loads(e.pop('payload'))
            for row in c.execute('SELECT * FROM quotes WHERE event_id=?',(e['id'],)):
                q=dict(row); q['unavailable_reason']=quote_reason(q,e,now()); q['event']=e['matchup']; q['sport']=e['sport']; q['american_odds']=q['odds']; offers.append(q)
        return {'mode':'VERIFIED_FEEDS_ONLY','quotes':offers,'events':events,'server_time':now(),
          'markets':list(MARKETS),'sports':list(SPORTS),'unavailable_reason':'No authorized fresh odds feed configured' if not offers else None}


@app.post('/api/picks')
def place_pick(body:Pick,request:Request,x_csrf_token:str|None=Header(None)):
    require_mutation(request,x_csrf_token)
    stake=body.stake_points*100
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        u=get_user(request,c)
        prev=c.execute('SELECT * FROM picks WHERE user_id=? AND request_key=?',(u['id'],body.request_key)).fetchone()
        if prev:
            if prev['quote_id']!=body.quote_id or prev['stake']!=stake: raise HTTPException(409,'Request key reused for different wager')
            return {'pick_id':prev['id'],'status':prev['status'],'duplicate':True}
        q=c.execute('SELECT * FROM quotes WHERE id=?',(body.quote_id,)).fetchone()
        if not q: raise HTTPException(400,'Market unavailable')
        e=c.execute('SELECT * FROM events WHERE id=?',(q['event_id'],)).fetchone()
        reason=quote_reason(q,e,now())
        if reason: raise HTTPException(409,reason)
        limits=dict(c.execute('SELECT key,value FROM config').fetchall())
        if stake>limits['max_stake']: raise HTTPException(400,'League stake limit exceeded')
        if balance(c,u['id'])<stake: raise HTTPException(400,'Insufficient virtual balance')
        odds=q['odds']; payout=stake+(stake*odds//100 if odds>0 else stake*100//-odds)
        liability=c.execute("SELECT COALESCE(SUM(potential_return),0) FROM picks WHERE status='pending'").fetchone()[0]
        if liability+payout>limits['max_liability']: raise HTTPException(409,'House liability limit reached')
        snapshot={**dict(q),'sport':e['sport'],'matchup':e['matchup'],'starts_at':e['starts_at'],'rules_version':1}
        pid=c.execute('''INSERT INTO picks(user_id,quote_id,event_name,selection,odds,stake,potential_return,request_key,created_at,snapshot,event_id)
          VALUES(?,?,?,?,?,?,?,?,?,?,?)''',(u['id'],q['id'],e['matchup'],q['selection'],odds,stake,payout,body.request_key,now(),json.dumps(snapshot,sort_keys=True),e['id'])).lastrowid
        transfer(c,f'member:{u["id"]}','house',stake,'accepted_stake',str(pid))
        audit(c,u['id'],'wager_accepted',{'pick_id':pid,'snapshot':snapshot,'stake':stake})
        c.commit()
    return {'pick_id':pid,'status':'pending','duplicate':False}


def pick_json(r):
    return {**dict(r),'event':r['event_name'],'stake_points':r['stake']/100,'potential_return_points':r['potential_return']/100,
            'snapshot':json.loads(r['snapshot']) if r['snapshot'] else None}


@app.get('/api/picks')
def my_picks(request:Request):
    u=get_user(request)
    with db() as c:
        return [pick_json(r) for r in c.execute('SELECT * FROM picks WHERE user_id=? ORDER BY id DESC',(u['id'],))]


@app.get('/api/leaderboard')
def leaderboard(request:Request):
    get_user(request)
    with db() as c:
        rows=[{'username':u['username'],'balance_points':balance(c,u['id'])/100,
               'net_points':c.execute("SELECT COALESCE(SUM(COALESCE((SELECT payout FROM settlements s WHERE s.pick_id=p.id ORDER BY version DESC LIMIT 1),0)-p.stake),0) FROM picks p WHERE p.user_id=? AND p.status!='pending'",(u['id'],)).fetchone()[0]/100} for u in c.execute('SELECT * FROM users WHERE enabled=1')]
    return sorted(rows,key=lambda r:r['net_points'],reverse=True)


@app.get('/api/members')
def members(request:Request):
    owner(request)
    with db() as c:
        return [{**dict(r),'balance_points':balance(c,r['id'])/100} for r in c.execute('SELECT id,username,role,enabled,created_at FROM users')]


@app.get('/api/admin')
def admin_report(request:Request):
    owner(request)
    with db() as c:
        limits=dict(c.execute('SELECT key,value FROM config').fetchall())
        house=c.execute("SELECT COALESCE(SUM(delta),0) FROM postings WHERE account='house'").fetchone()[0]
        pending=c.execute("SELECT COALESCE(SUM(stake),0),COALESCE(SUM(potential_return),0) FROM picks WHERE status='pending'").fetchone()
        invariant=c.execute('SELECT COALESCE(SUM(delta),0) FROM postings').fetchone()[0]
        return {'house_cash_points':house/100,'house_realized_pnl_points':(house-pending[0])/100,
                'outstanding_return_points':pending[1]/100,'outstanding_profit_points':(pending[1]-pending[0])/100,
                'ledger_sum':invariant,'rules':limits,'picks':[pick_json(r) for r in c.execute('SELECT * FROM picks ORDER BY id DESC')],
                'audit':[dict(r) for r in c.execute('SELECT * FROM audit ORDER BY id DESC LIMIT 200')]}


def grade(snapshot,result):
    """Versioned league rules: final including OT; first half excludes later periods.
    Postponements void immediately. Cancelled/abandoned events void all open markets.
    Props require a provider's verified final stat and participation; missing data stays pending.
    """
    state=result['state']
    if state in ('cancelled','postponed','abandoned'): return 'void'
    if state!='final': return None
    market=snapshot['market']; period=snapshot['period']; side=snapshot['side']; subject=snapshot['subject']
    scores=result.get('first_half' if period=='first_half' else 'scores')
    if market=='player_prop':
        stat=result.get('props',{}).get(subject)
        if stat is None: return None
        if stat.get('participated') is False: return 'void'
        if stat.get('participated') is not True or not isinstance(stat.get('value'),(int,float)): return None
        value=stat['value']-snapshot['line']
    else:
        if not scores or not all(isinstance(scores.get(k),(int,float)) for k in ('home','away')): return None
        home,away=scores['home'],scores['away']
        if market=='moneyline' or (market=='first_half' and snapshot['line'] is None):
            diff=(home-away)*(1 if side=='home' else -1)
            return 'win' if diff>0 else 'loss' if diff<0 else 'push'
        if market=='spread' or (market=='first_half' and side in ('home','away')):
            diff=((home-away) if side=='home' else (away-home))+snapshot['line']
            return 'win' if diff>0 else 'loss' if diff<0 else 'push'
        value=(scores[subject] if market=='team_total' else home+away)-snapshot['line']
    diff=value*(1 if side=='over' else -1)
    return 'win' if diff>0 else 'loss' if diff<0 else 'push'


def ingest_result(event_id,version,result,source,source_at):
    """Private worker entry point. Only verified official results belong here; never HTTP/admin grades."""
    if not source.startswith('https://') or not 0<=now()-source_at<=300: raise ValueError('Fresh official provenance required')
    if result.get('state') not in ('final','postponed','cancelled','abandoned'): raise ValueError('Not a terminal official result')
    encoded=json.dumps(result,sort_keys=True,allow_nan=False)
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        existing=c.execute('SELECT * FROM results WHERE event_id=? AND version=?',(event_id,version)).fetchone()
        if existing:
            if existing['payload']!=encoded or existing['source']!=source: raise ValueError('Result version collision')
            return
        last=c.execute('SELECT MAX(version) FROM results WHERE event_id=?',(event_id,)).fetchone()[0]
        if version<1 or (last is not None and version<=last): raise ValueError('Result version must increase')
        if not c.execute('SELECT 1 FROM events WHERE id=?',(event_id,)).fetchone(): raise ValueError('Unknown event')
        c.execute('INSERT INTO results VALUES(?,?,?,?,?,?)',(event_id,version,encoded,source,source_at,now()))
        c.execute('UPDATE events SET state=?,source_at=? WHERE id=?',(result['state'],source_at,event_id))
        c.execute('UPDATE quotes SET suspended=1 WHERE event_id=?',(event_id,))
        for p in c.execute('SELECT * FROM picks WHERE event_id=?',(event_id,)).fetchall():
            if not p['snapshot']: continue
            status=grade(json.loads(p['snapshot']),result)
            if status is None:
                if p['result_version']:
                    raise ValueError('Correction lacks data required to reproduce an existing settlement')
                continue
            payout=p['potential_return'] if status=='win' else p['stake'] if status in ('push','void') else 0
            old=c.execute('SELECT payout FROM settlements WHERE pick_id=? ORDER BY version DESC LIMIT 1',(p['id'],)).fetchone()
            delta=payout-(old['payout'] if old else 0)
            # Corrections can create a recorded member debt; acceptance blocks spending it.
            transfer(c,'house',f'member:{p["user_id"]}',delta,'correction' if old else 'settlement',f'{p["id"]}:{version}')
            c.execute('INSERT INTO settlements(pick_id,version,status,payout,source,created_at) VALUES(?,?,?,?,?,?)',(p['id'],version,status,payout,source,now()))
            c.execute('UPDATE picks SET status=?,result_version=? WHERE id=?',(status,version,p['id']))
            audit(c,None,'settled',{'pick_id':p['id'],'version':version,'status':status,'delta':delta,'source':source})
        c.commit()


@app.get('/',response_class=HTMLResponse)
def home():
    return (Path(__file__).parent/'index.html').read_text()


@app.get('/assets/{name}')
def assets(name:str):
    allowed={'app.js':'application/javascript','style.css':'text/css','manifest.webmanifest':'application/manifest+json','icon.svg':'image/svg+xml'}
    allowed.update({f'icon-{size}.png':'image/png' for size in (180,192,512)})
    if name not in allowed: raise HTTPException(404)
    return FileResponse(Path(__file__).parent/name,media_type=allowed[name])


@app.get('/healthz')
def health():
    with db() as c: c.execute('SELECT 1').fetchone()
    return {'ok':True,'virtual_only':True}


if __name__=='__main__':
    import getpass
    bootstrap_admin(input('Sole owner username: '),getpass.getpass('Password (12+ characters): '))
    print('Owner initialized. Configure HTTPS origin and persistent disk before starting the service.')
