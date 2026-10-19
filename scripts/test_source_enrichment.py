import unittest
from collect_scores import bounded_report, independent_mlb
class EnrichmentTest(unittest.TestCase):
    def test_limits_and_metadata(self):
        raw={'header':{'id':'42'},'plays':list(range(200)),'scoringPlays':list(range(90)),'drives':{'previous':list(range(50))},'rosters':[{'team':{'id':'1'}}],'videos':['omit'],'lastFiveGames':[{'result':'W'}]}
        result=bounded_report(raw,'42')
        self.assertEqual(len(result['plays']),100);self.assertEqual(result['plays'][0],100)
        self.assertEqual(len(result['scoringPlays']),80);self.assertEqual(len(result['drives']['previous']),30)
        self.assertNotIn('videos',result);self.assertEqual(len(raw['drives']['previous']),50)
        self.assertEqual(result['coverage']['field_status']['rosters'],'available')
        self.assertEqual(result['coverage']['field_status']['injuries'],'not published in this summary')
    def test_wrong_event_rejected(self):
        with self.assertRaises(ValueError):bounded_report({'header':{'id':'other'}},'42')
    def test_missing_not_zero(self):
        result=bounded_report({},'42');self.assertNotIn('rosters',result)
        self.assertEqual(result['coverage']['event_id'],'42')
class IndependentMLBTest(unittest.TestCase):
    def setUp(self):
        self.event={'id':'42','date':'2026-10-20T00:00Z','competitions':[{'competitors':[{'homeAway':'home','team':{'displayName':'Tampa Bay Rays'}},{'homeAway':'away','team':{'displayName':'Cleveland Guardians'}}]}]}
        self.game={'gamePk':9,'gameDate':'2026-10-20T00:08Z','teams':{'home':{'team':{'name':'Tampa Bay Rays'}},'away':{'team':{'name':'Cleveland Guardians'}}}}
        self.payload={'sports':{'mlb':{'events':[self.event]}}}
    def response(self,games):return {'dates':[{'date':'2026-10-19','games':games}]}
    def test_exact_match_retains_discrepancy(self):
        independent_mlb(self.payload,lambda url:self.response([self.game]))
        result=self.payload['independent']['mlb:42']
        self.assertEqual(result['matchup_status'],'PASS');self.assertEqual(result['status'],'CONFLICT');self.assertEqual(result['start_difference_minutes'],8)
        self.assertEqual(self.event['date'],'2026-10-20T00:00Z')
    def test_wrong_teams_rejected(self):
        self.game['teams']['away']['team']['name']='Different Team'
        independent_mlb(self.payload,lambda url:self.response([self.game]))
        self.assertEqual(self.payload['independent']['mlb:42']['status'],'BLOCKED')
    def test_doubleheader_ambiguous(self):
        independent_mlb(self.payload,lambda url:self.response([self.game,self.game]))
        self.assertIsNone(self.payload['independent']['mlb:42']['official_game_id'])
    def test_failure_keeps_success_timestamp(self):
        independent_mlb(self.payload,lambda url:self.response([self.game]))
        before=self.payload['independent']['mlb:42']['checked_at']
        def fail(url):raise OSError('offline')
        independent_mlb(self.payload,fail)
        self.assertEqual(self.payload['independent']['mlb:42']['checked_at'],before)
        self.assertTrue(self.payload['independent']['mlb:42']['stale'])
if __name__=='__main__':unittest.main()
