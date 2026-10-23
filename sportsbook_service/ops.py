"""Private host operations: consistent backup, verified restore, owner recovery.
Never expose these operations as public web routes.
"""
import argparse
import getpass
import os
import sqlite3
from pathlib import Path
from . import app


def backup(destination):
    path=Path(destination)
    if path.exists(): raise ValueError('Backup destination already exists')
    path.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
    try:
        with app.db() as source, sqlite3.connect(path) as target:
            source.backup(target)
            if target.execute('PRAGMA integrity_check').fetchone()[0]!='ok': raise ValueError('Backup integrity failure')
    except Exception:
        path.unlink(missing_ok=True);raise


def restore(source,destination):
    # Restore to a NEW path; operator switches LH_LEAGUE_DB only after verifying.
    if Path(destination).exists(): raise ValueError('Restore will not overwrite an existing database')
    uri=Path(source).resolve().as_uri()+'?mode=ro'
    with sqlite3.connect(uri,uri=True) as original:
        if original.execute('PRAGMA integrity_check').fetchone()[0]!='ok': raise ValueError('Corrupt backup')
        fd=os.open(destination,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
        with sqlite3.connect(destination) as target: original.backup(target)


def owner_password():
    password=getpass.getpass('New owner password (12+ chars): ')
    if len(password)<12 or len(password)>128: raise ValueError('Password length must be 12–128')
    with app.db() as c:
        c.execute('BEGIN IMMEDIATE')
        owner=c.execute("SELECT id FROM users WHERE role='admin'").fetchone()
        if not owner: raise ValueError('Initialize owner first')
        uid=owner['id'];c.execute('UPDATE users SET password_hash=? WHERE id=?',(app.ph.hash(password),uid))
        c.execute('DELETE FROM sessions WHERE user_id=?',(uid,));c.execute('DELETE FROM recovery WHERE user_id=?',(uid,))
        app.audit(c,uid,'owner_cli_password_reset',{});c.commit()


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('command',choices=['backup','restore','owner-password']);p.add_argument('paths',nargs='*');a=p.parse_args()
    if a.command=='backup' and len(a.paths)==1:backup(a.paths[0])
    elif a.command=='restore' and len(a.paths)==2:restore(*a.paths)
    elif a.command=='owner-password' and not a.paths:owner_password()
    else:p.error('backup DESTINATION | restore SOURCE NEW_DESTINATION | owner-password')
