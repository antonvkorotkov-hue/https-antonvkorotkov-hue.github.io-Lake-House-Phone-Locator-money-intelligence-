import io,json,os,runpy,tempfile,unittest,urllib.error
from pathlib import Path
from unittest.mock import patch
SCRIPT=Path(__file__).with_name('publish_pages.py').resolve()
class Response:
    def __init__(self,data):self.data=data
    def __enter__(self):return io.BytesIO(self.data)
    def __exit__(self,*args):pass
class PublishTest(unittest.TestCase):
    def test_existing_builder_and_checksums(self):
        prior=os.getcwd();calls=[]
        with tempfile.TemporaryDirectory() as folder:
            os.chdir(folder)
            try:
                for name in ['index.html','visual.js','visual.css','analytics.js','analytics.css','intelligence.js','intelligence.css','charts.js','charts.css','research.js','research.css','scoreboards.json','public-trades.json','sportsbook-splits.json','licensed-odds.json','verification.html']:Path(name).write_bytes(b'verified')
                def request(req,**kw):
                    url=req if isinstance(req,str) else req.full_url
                    method='GET' if isinstance(req,str) else req.get_method();calls.append((method,url))
                    if url.startswith('https://example.test/'):return Response(b'verified')
                    if url.endswith('/pages'):data={'build_type':'legacy','html_url':'https://example.test/'}
                    elif url.endswith('/pages/builds'):data={'url':'https://api.github.com/repos/test/app/pages/builds/1'}
                    else:raise AssertionError('Unexpected build-status dependency: '+url)
                    return Response(json.dumps(data).encode())
                with patch.dict(os.environ,{'GITHUB_REPOSITORY':'test/app','GH_TOKEN':'test'}),patch('urllib.request.urlopen',request),patch('time.sleep'):runpy.run_path(str(SCRIPT))
                self.assertIn(('POST','https://api.github.com/repos/test/app/pages/builds'),calls)
                self.assertFalse(any('/deployments' in url for _,url in calls),'Never create competing Pages deployments')
                self.assertEqual(sum(url.startswith('https://example.test/')for _,url in calls),16)
            finally:os.chdir(prior)
if __name__=='__main__':unittest.main()
