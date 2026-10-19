"""Check collection fidelity, deduplication and failed-source freshness without network."""
import datetime as dt
import contextlib
import io
import json
import os
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).with_name('collect_public.py').resolve()
class Response:
    def __init__(self, data): self.data = data
    def __enter__(self): return io.StringIO(json.dumps(self.data))
    def __exit__(self, *args): pass

class CollectorTest(unittest.TestCase):
    def test_fidelity_and_failure(self):
        original = os.getcwd()
        with tempfile.TemporaryDirectory() as folder:
            os.chdir(folder)
            try:
                stamp=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(hours=1)).isoformat()
                old = {'collected_at':stamp,'markets':[{'ticker':'OLD','series':'KXNFLGAME','trades':[{'id':'old','time':stamp,'side':'yes','contracts':2,'premium_usd':1}]}]}
                Path('public-trades.json').write_text(json.dumps(old))
                def respond(req, **kwargs):
                    if '/events?' in req.full_url:
                        series=req.full_url.split('series_ticker=')[1].split('&')[0]
                        return Response({'events':[{'title':'Game','markets':[{'ticker':series+'-26OCT19WASSF-SF','title':'Winner'}]}]})
                    return Response({'trades':[{'trade_id':'1','created_time':stamp,'taker_side':'yes','count_fp':'20','yes_price_dollars':'0.4'},{'trade_id':'1','created_time':stamp,'taker_side':'yes','count_fp':'20','yes_price_dollars':'0.4'},{'trade_id':'bad','taker_side':'unknown','count':4}]})
                with patch('urllib.request.urlopen',respond),patch('time.sleep'):
                    namespace=runpy.run_path(str(SCRIPT))
                result=json.loads(Path('public-trades.json').read_text())
                self.assertEqual(len(result['markets']),len(namespace['SERIES'])+1)
                self.assertEqual(result['markets'][0]['trades'][0]['premium_usd'],8)
                self.assertEqual(len(result['markets'][0]['trades']),1)
                self.assertEqual(next(m for m in result['markets'] if m['ticker']=='OLD')['collected_at'],old['collected_at'])
                prior={m['ticker']:m['collected_at'] for m in result['markets']}
                with patch('urllib.request.urlopen',side_effect=OSError('offline')),patch('time.sleep'):
                    runpy.run_path(str(SCRIPT))
                failed=json.loads(Path('public-trades.json').read_text())
                self.assertEqual(prior,{m['ticker']:m['collected_at'] for m in failed['markets']})
                self.assertEqual(len(failed['errors']),len(namespace['SERIES']))
            finally: os.chdir(original)

if __name__ == '__main__': unittest.main()
