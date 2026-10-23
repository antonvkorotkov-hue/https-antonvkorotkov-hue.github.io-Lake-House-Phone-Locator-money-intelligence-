import importlib
import json
import sys
from pathlib import Path
from unittest.mock import patch
import httpx
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def feeds(tmp_path,monkeypatch):
    monkeypatch.setenv('LH_LEAGUE_DB',str(tmp_path/'feeds.sqlite3'));monkeypatch.setenv('LH_DEV_INSECURE_COOKIE','1')
    monkeypatch.delenv('LH_APP_ORIGIN',raising=False)
    monkeypatch.delenv('LHP_ODDS_API_KEY',raising=False);monkeypatch.delenv('THE_ODDS_API_KEY',raising=False)
    for n in ['sportsbook_service.app','sportsbook_service.feeds','sportsbook_service.official_results']:sys.modules.pop(n,None)
    import sportsbook_service
    for n in ['app','feeds','official_results']:
        if hasattr(sportsbook_service,n):delattr(sportsbook_service,n)
    f=importlib.import_module('sportsbook_service.feeds');return f


def event(m):
    return {'id':'1','date':__import__('datetime').datetime.fromtimestamp(m.now()+3600,__import__('datetime').timezone.utc).isoformat(),
      'status':{'type':{'state':'pre','name':'STATUS_SCHEDULED','detail':'Scheduled'}},
      'competitions':[{'competitors':[{'homeAway':'home','score':'0','team':{'displayName':'Home'}},{'homeAway':'away','score':'0','team':{'displayName':'Away'}}]}]}


def test_ingest_quotes_and_provider_failure_suspends(feeds,monkeypatch):
    f=feeds;m=f.service;monkeypatch.setenv('LHP_ODDS_API_KEY','test-not-a-secret');monkeypatch.setenv('LH_PREGAME_ODDS_AUTHORIZED','1')
    e=event(m);time=__import__('datetime').datetime.fromtimestamp(m.now(),__import__('datetime').timezone.utc).isoformat()
    offer={'sport':'nfl','event_id':'1','book_key':'draftkings','provider':'Test Book','source_updated_at':time,'markets':{'h2h':[{'name':'Home','price':-125,'point':None}]}}
    def get(client,url):return httpx.Response(200,json={'events':[e]},request=httpx.Request('GET',url))
    with patch('httpx.Client.get',get),patch.object(f,'collect',return_value={'quotes':[offer],'errors':[]}):
        f.refresh()
    with m.db() as c:assert c.execute('SELECT COUNT(*) FROM quotes WHERE suspended=0').fetchone()[0]==1
    with patch('httpx.Client.get',get),patch.object(f,'collect',return_value={'quotes':[],'errors':['test unavailable']}):
        f.refresh()
    with m.db() as c:assert c.execute('SELECT COUNT(*) FROM quotes WHERE suspended=0').fetchone()[0]==0


def test_official_result_crosscheck(feeds):
    m=feeds.service;official=importlib.import_module('sportsbook_service.official_results');t=m.now()
    with m.db() as c:
        c.execute('INSERT INTO events VALUES(?,?,?,?,?,?,?,?)',('mlb:1','mlb','Away @ Home',t,'final','https://site.api.espn.com/test',t,json.dumps({'teams':{'home':'Home','away':'Away'},'scores':{'home':'5','away':'2'}})))
    date=__import__('datetime').datetime.fromtimestamp(t,__import__('datetime').timezone.utc).isoformat()
    game={'gamePk':123,'gameDate':date,'teams':{'home':{'team':{'name':'Home'},'score':5},'away':{'team':{'name':'Away'},'score':2}},'status':{'abstractGameState':'Final','detailedState':'Final'}}
    def handle(request):return httpx.Response(200,json={'dates':[{'games':[game]}]})
    with httpx.Client(transport=httpx.MockTransport(handle)) as client:
        assert official.settle_mlb(client)==1
        assert official.settle_mlb(client)==0
        game['teams']['home']['score']=6  # conflicting sources cannot create a correction
        assert official.settle_mlb(client)==0
    with m.db() as c:assert c.execute('SELECT COUNT(*) FROM results').fetchone()[0]==1
