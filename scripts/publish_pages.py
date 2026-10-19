"""Use the repository's existing branch-based Pages publisher, then verify its output."""
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.request

API = 'https://api.github.com/repos/' + os.environ['GITHUB_REPOSITORY']

def api(path, method='GET'):
    req = urllib.request.Request(API + path, method=method,
        headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'], 'Accept':'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28'})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)

site = api('/pages')
if site.get('build_type') != 'legacy':
    raise RuntimeError('Expected existing branch-based Pages publishing; configuration changed')
base = site['html_url'].rstrip('/') + '/'
# Requests a normal branch build; no competing custom Pages deployment is created.
api('/pages/builds', 'POST')
# Served file hashes are the deployment gate; legacy build records may lag or
# return 404 while GitHub routes the request through its managed Actions job.

for name in ['index.html','visual.js','visual.css','scoreboards.json','public-trades.json']:
    expected = hashlib.sha256(Path(name).read_bytes()).hexdigest()
    for attempt in range(8):
        try:
            with urllib.request.urlopen(base+name+'?verify='+str(time.time_ns()),timeout=30) as response:
                actual = hashlib.sha256(response.read()).hexdigest()
        except urllib.error.HTTPError as exc:
            if exc.code not in (404, 502, 503) or attempt == 7:
                raise
            time.sleep(10)
            continue
        if actual == expected:
            print('Verified served asset:', name)
            break
        # If data changed during verification, use its current committed version.
        # Never silently accept changed application code.
        if name.endswith('.json'):
            content = api('/contents/'+name)
            if content.get('encoding') == 'base64':
                import base64
                expected = hashlib.sha256(base64.b64decode(content['content'])).hexdigest()
            elif content.get('git_url'):
                import base64
                blob = api(content['git_url'].split(API)[-1])
                expected = hashlib.sha256(base64.b64decode(blob['content'])).hexdigest()
        if attempt == 7:
            raise RuntimeError('Served asset differs from committed data/application: '+name)
        time.sleep(10)
print('Published and verified:',base)
