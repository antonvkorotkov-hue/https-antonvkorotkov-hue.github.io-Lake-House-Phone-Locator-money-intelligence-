"""Scheduled private snapshots. Off-host encrypted replication is a host obligation."""
import datetime as dt
import os
import time
from pathlib import Path
from .ops import backup


def run():
    directory=Path(os.environ.get('LH_BACKUP_DIR','/backups'))
    directory.mkdir(parents=True,exist_ok=True,mode=0o700)
    interval=max(3600,int(os.environ.get('LH_BACKUP_INTERVAL_SECONDS','86400')))
    while True:
        stamp=dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        try:
            backup(directory/f'league-{stamp}.sqlite3')
            print('Private database snapshot complete',flush=True)
        except Exception as e:
            print('Snapshot failed: '+type(e).__name__,flush=True)
        time.sleep(interval)


if __name__=='__main__':
    run()
