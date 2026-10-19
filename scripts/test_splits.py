"""Verify public-preview parsing never attaches splits to wrong games."""
import unittest
from collect_splits import parse

def row(name,spread,ml,handle,tickets,spread_handle,spread_tickets):
    cells=['<button data-gamecode="20261019MLB00004"></button>',f'<a class="sp-team-link">{name}</a>',spread,spread_handle,spread_tickets,'7','88%','70%',ml,handle,tickets]
    return '<tr class="sp-row">'+''.join('<td>'+v+'</td>' for v in cells)+'</tr>'
# Minimal structural fixture matching the inspected public markup; no full page retained.
FIXTURE='<table><tr class="sp-source-dk"><a href="/mlb/games/?gamedate=2026-10-19"></a></tr>'+row('Cleveland Guardians','+1.5','+130','28%','23%','58%','25%')+row('Tampa Bay Rays','-1.5','-158','72%','77%','42%','75%')+'</table>'
EVENT={'id':'123','date':'2026-10-19T23:00Z','competitions':[{'competitors':[{'homeAway':'home','team':{'displayName':'Tampa Bay Rays'}},{'homeAway':'away','team':{'displayName':'Cleveland Guardians'}}]}]}
class SplitsTest(unittest.TestCase):
    def test_exact_mapping(self):
        result=parse(FIXTURE,{'sports':{'mlb':{'events':[EVENT]}}},'now')[0]
        self.assertEqual(result['event_id'],'123'); self.assertIsNone(result['source_updated_at'])
        self.assertEqual(result['away']['moneyline']['handle_minus_tickets_pp'],5)
        self.assertNotIn('total',result['away'])
    def test_wrong_date_unmatched(self):
        result=parse(FIXTURE.replace('gamedate=2026-10-19','gamedate=2025-10-19'),{'sports':{'mlb':{'events':[EVENT]}}},'now')
        self.assertEqual(result,[])
    def test_duplicate_events_unmatched(self):
        result=parse(FIXTURE,{'sports':{'mlb':{'events':[EVENT,EVENT]}}},'now')[0]
        self.assertIsNone(result['event_id'])
    def test_invalid_percentage(self):
        self.assertEqual(parse(FIXTURE.replace('58%','158%'),{},'now'),[])
    def test_different_game_codes_rejected(self):
        self.assertEqual(parse(FIXTURE.replace('20261019MLB00004','20261019MLB99999',1),{},'now'),[])
    def test_inconsistent_percentage_sums_rejected(self):
        self.assertEqual(parse(FIXTURE.replace('42%','52%'),{},'now'),[])
        self.assertEqual(parse(FIXTURE.replace('77%','60%'),{},'now'),[])
    def test_auth_or_marketing_shell_empty(self):self.assertEqual(parse('<title>Subscribe</title>',{},'now'),[])
if __name__=='__main__':unittest.main()
