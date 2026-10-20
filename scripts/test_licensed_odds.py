"""Deterministic provider-match, timeliness, and market tests (no API calls)."""
import datetime as dt
import unittest
from collect_licensed_odds import collect,match
now=dt.datetime.now(dt.timezone.utc)
stamp=lambda n:(now+dt.timedelta(seconds=n)).isoformat()
home='San Francisco 49ers';away='Washington Commanders'
event={'id':'correct','date':stamp(3600),'competitions':[{'competitors':[{'homeAway':'home','team':{'displayName':home}},{'homeAway':'away','team':{'displayName':away}}]}]}
offer={'home_team':home,'away_team':away,'commence_time':stamp(3600),'bookmakers':[{'key':'draftkings','title':'DraftKings','last_update':stamp(-40),'markets':[{'key':'h2h','outcomes':[{'name':home,'price':-180},{'name':away,'price':150}]},{'key':'spreads','outcomes':[{'name':home,'price':-110,'point':-3.5}]}]}]}
class Tests(unittest.TestCase):
 def test_exact_match(self):
  self.assertEqual(match(offer,[event]),'correct')
  self.assertIsNone(match(offer,[event,event]))
  self.assertIsNone(match(dict(offer,away_team='Different Team'),[event]))
 def test_quote(self):
  data=collect('never-sent',{'sports':{'nfl':{'events':[event]}}},lambda url:[offer])
  self.assertEqual(len(data['quotes']),1)
  self.assertEqual(data['quotes'][0]['book_key'],'draftkings')
  self.assertEqual(data['quotes'][0]['markets']['spreads'][0]['point'],-3.5)
  self.assertNotIn('never-sent',repr(data))
 def test_stale(self):
  bad=dict(offer,bookmakers=[dict(offer['bookmakers'][0],last_update=stamp(-900))])
  data=collect('key',{'sports':{'nfl':{'events':[event]}}},lambda url:[bad])
  self.assertEqual(data['quotes'],[])
if __name__=='__main__':unittest.main()
