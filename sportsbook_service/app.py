"""Development-only invitation-based virtual sportsbook API. No money or prizes."""
import hashlib
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from argon2 import PasswordHasher
from fastapi import FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

DB_PATH = os.environ.get("LH_LEAGUE_DB", str(Path(__file__).parent / "league.sqlite3"))
COOKIE_SECURE = os.environ.get("LH_DEV_INSECURE_COOKIE") != "1"
ph = PasswordHasher()
app = FastAPI(title="Lake House free-play API", docs_url=None, redoc_url=None)
# These are explicit example markets, not live games or actionable sportsbook prices.
DEMO_QUOTES = {
    "demo-home": {"event": "Demonstration only: Philadelphia vs Dallas", "selection": "Philadelphia win", "american_odds": -125},
    "demo-away": {"event": "Demonstration only: Philadelphia vs Dallas", "selection": "Dallas win", "american_odds": 110},
}
STARTING_POINTS = 100000  # stored in hundredths of a virtual point


@contextmanager
def db():
    connection = sqlite3.connect(DB_PATH, timeout=15, isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout=15000")
    connection.execute("PRAGMA foreign_keys=ON")
    try:
        yield connection
    finally:
        connection.close()


def setup():
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin','member')), balance INTEGER NOT NULL CHECK(balance>=0),
          created_at INTEGER NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS only_one_admin ON users(role) WHERE role='admin';
        CREATE TABLE IF NOT EXISTS invites (
          digest TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, used_by INTEGER REFERENCES users(id));
        CREATE TABLE IF NOT EXISTS sessions (
          digest TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
          expires_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS picks (
          id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
          quote_id TEXT NOT NULL, event_name TEXT NOT NULL, selection TEXT NOT NULL,
          odds INTEGER NOT NULL, stake INTEGER NOT NULL CHECK(stake>0),
          potential_return INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
          request_key TEXT NOT NULL, created_at INTEGER NOT NULL,
          UNIQUE(user_id,request_key));
        CREATE TABLE IF NOT EXISTS ledger (
          id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), delta INTEGER NOT NULL,
          kind TEXT NOT NULL, reference TEXT NOT NULL, created_at INTEGER NOT NULL);
        """)


setup()


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=12, max_length=128)


class Join(Credentials):
    invite: str


class Pick(BaseModel):
    quote_id: str
    stake_points: int = Field(ge=1, le=10000)
    request_key: str = Field(min_length=12, max_length=80)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def get_user(request: Request):
    token = request.cookies.get("lh_session", "")
    if not token:
        raise HTTPException(401, "Login required")
    with db() as c:
        row = c.execute("""SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
                        WHERE s.digest=? AND s.expires_at>?""", (digest(token), int(time.time()))).fetchone()
    if not row:
        raise HTTPException(401, "Session expired")
    return dict(row)


def require_mutation(request: Request, csrf: str | None):
    cookie = request.cookies.get("lh_csrf", "")
    if not cookie or not csrf or not secrets.compare_digest(cookie, csrf):
        raise HTTPException(403, "CSRF token required")
    origin = request.headers.get("origin")
    expected = os.environ.get("LH_APP_ORIGIN", "")
    if expected and origin != expected:
        raise HTTPException(403, "Origin mismatch")


def new_session(c, response, user_id):
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    c.execute("INSERT INTO sessions VALUES(?,?,?)", (digest(token), user_id, int(time.time()) + 86400))
    response.set_cookie("lh_session", token, httponly=True, secure=COOKIE_SECURE,
                        samesite="strict", max_age=86400, path="/")
    response.set_cookie("lh_csrf", csrf, httponly=False, secure=COOKIE_SECURE,
                        samesite="strict", max_age=86400, path="/")


def bootstrap_admin(username: str, password: str):
    """Run from private host CLI. Never expose as an HTTP endpoint."""
    creds = Credentials(username=username, password=password)
    with db() as c:
        c.execute("BEGIN IMMEDIATE")
        if c.execute("SELECT 1 FROM users WHERE role='admin'").fetchone():
            c.rollback()
            raise ValueError("Administrator already exists")
        now = int(time.time())
        c.execute("INSERT INTO users(username,password_hash,role,balance,created_at) VALUES(?,?,'admin',?,?)",
                  (creds.username.lower(), ph.hash(creds.password), STARTING_POINTS, now))
        user_id = c.execute("SELECT last_insert_rowid()").fetchone()[0]
        c.execute("INSERT INTO ledger(user_id,delta,kind,reference,created_at) VALUES(?,?,?,?,?)",
                  (user_id, STARTING_POINTS, "initial_grant", "admin-bootstrap", now))
        c.commit()


@app.post("/api/login")
def login(body: Credentials, response: Response):
    with db() as c:
        user = c.execute("SELECT * FROM users WHERE username=?", (body.username.lower(),)).fetchone()
        if not user:
            raise HTTPException(401, "Invalid credentials")
        try:
            ph.verify(user["password_hash"], body.password)
        except Exception:
            raise HTTPException(401, "Invalid credentials")
        new_session(c, response, user["id"])
    return {"ok": True}


@app.get("/api/me")
def me(request: Request):
    u = get_user(request)
    return {"username": u["username"], "role": u["role"], "balance_points": u["balance"] / 100}


@app.post("/api/invites")
def invite(request: Request, x_csrf_token: str | None = Header(None)):
    require_mutation(request, x_csrf_token)
    u = get_user(request)
    if u["role"] != "admin":
        raise HTTPException(403, "Admin only")
    code = secrets.token_urlsafe(24)
    with db() as c:
        c.execute("INSERT INTO invites VALUES(?,?,NULL)", (digest(code), int(time.time()) + 86400))
    return {"invitation_code": code, "expires_in_seconds": 86400}


@app.post("/api/join")
def join(body: Join, response: Response):
    with db() as c:
        c.execute("BEGIN IMMEDIATE")
        invitation = c.execute("SELECT * FROM invites WHERE digest=?", (digest(body.invite),)).fetchone()
        if not invitation or invitation["used_by"] is not None or invitation["expires_at"] <= time.time():
            c.rollback()
            raise HTTPException(400, "Invitation invalid or expired")
        now = int(time.time())
        try:
            c.execute("INSERT INTO users(username,password_hash,role,balance,created_at) VALUES(?,?,'member',?,?)",
                      (body.username.lower(), ph.hash(body.password), STARTING_POINTS, now))
        except sqlite3.IntegrityError:
            c.rollback()
            raise HTTPException(409, "Username unavailable")
        uid = c.execute("SELECT last_insert_rowid()").fetchone()[0]
        c.execute("UPDATE invites SET used_by=? WHERE digest=?", (uid, digest(body.invite)))
        c.execute("INSERT INTO ledger(user_id,delta,kind,reference,created_at) VALUES(?,?,?,?,?)",
                  (uid, STARTING_POINTS, "initial_grant", "invitation", now))
        new_session(c, response, uid)
        c.commit()
    return {"ok": True}


@app.get("/api/quotes")
def quotes(request: Request):
    get_user(request)
    return {"mode": "DEMO_NOT_LIVE", "quotes": [{"id": k, **v} for k, v in DEMO_QUOTES.items()]}


@app.post("/api/picks")
def place_pick(body: Pick, request: Request, x_csrf_token: str | None = Header(None)):
    require_mutation(request, x_csrf_token)
    user = get_user(request)
    quote = DEMO_QUOTES.get(body.quote_id)
    if not quote:
        raise HTTPException(400, "Unknown demo market")
    stake = body.stake_points * 100
    odds = quote["american_odds"]
    profit = (stake * odds // 100) if odds > 0 else (stake * 100 // (-odds))
    total_return = stake + profit
    with db() as c:
        c.execute("BEGIN IMMEDIATE")
        prev = c.execute("SELECT * FROM picks WHERE user_id=? AND request_key=?",
                         (user["id"], body.request_key)).fetchone()
        if prev:
            c.commit()
            if prev["quote_id"] != body.quote_id or prev["stake"] != stake:
                raise HTTPException(409, "Idempotency key reused for different pick")
            return {"pick_id": prev["id"], "status": prev["status"], "duplicate": True}
        current = c.execute("SELECT balance FROM users WHERE id=?", (user["id"],)).fetchone()[0]
        if current < stake:
            c.rollback()
            raise HTTPException(400, "Insufficient virtual points")
        now = int(time.time())
        c.execute("UPDATE users SET balance=balance-? WHERE id=?", (stake, user["id"]))
        c.execute("""INSERT INTO picks(user_id,quote_id,event_name,selection,odds,stake,potential_return,
                     request_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)""",
                  (user["id"], body.quote_id, quote["event"], quote["selection"], odds, stake,
                   total_return, body.request_key, now))
        pid = c.execute("SELECT last_insert_rowid()").fetchone()[0]
        c.execute("INSERT INTO ledger(user_id,delta,kind,reference,created_at) VALUES(?,?,?,?,?)",
                  (user["id"], -stake, "stake_reserved", str(pid), now))
        c.commit()
    return {"pick_id": pid, "status": "pending", "duplicate": False}


@app.get("/api/picks")
def my_picks(request: Request):
    u = get_user(request)
    with db() as c:
        rows = c.execute("""SELECT id,event_name,selection,odds,stake,potential_return,status,created_at
                             FROM picks WHERE user_id=? ORDER BY id DESC LIMIT 100""", (u["id"],)).fetchall()
    return [{"id": r["id"], "event": r["event_name"], "selection": r["selection"],
             "odds": r["odds"], "stake_points": r["stake"] / 100,
             "potential_return_points": r["potential_return"] / 100,
             "status": r["status"], "created_at": r["created_at"]} for r in rows]


if __name__ == "__main__":
    import getpass
    username = input("Admin username: ")
    password = getpass.getpass("Admin password (12+ chars): ")
    bootstrap_admin(username, password)
    print("Administrator created. Configure HTTPS and LH_APP_ORIGIN before public exposure.")


@app.get("/", response_class=HTMLResponse)
def home():
    """Serve the private league client from the API origin (never from public JSON)."""
    return (Path(__file__).parent / "index.html").read_text(encoding="utf-8")


@app.post("/api/logout")
def logout(request: Request, response: Response, x_csrf_token: str | None = Header(None)):
    require_mutation(request, x_csrf_token)
    token = request.cookies.get("lh_session", "")
    if token:
        with db() as c:
            c.execute("DELETE FROM sessions WHERE digest=?", (digest(token),))
    response.delete_cookie("lh_session", path="/")
    response.delete_cookie("lh_csrf", path="/")
    return {"ok": True}


@app.get("/api/leaderboard")
def leaderboard(request: Request):
    get_user(request)
    with db() as c:
        rows = c.execute("SELECT username, balance FROM users ORDER BY balance DESC, username LIMIT 200").fetchall()
    return [{"username": r["username"], "balance_points": r["balance"] / 100} for r in rows]


@app.get("/api/members")
def members(request: Request):
    u = get_user(request)
    if u["role"] != "admin":
        raise HTTPException(403, "Admin only")
    with db() as c:
        rows = c.execute("SELECT username,role,created_at FROM users ORDER BY id").fetchall()
    return [dict(r) for r in rows]
