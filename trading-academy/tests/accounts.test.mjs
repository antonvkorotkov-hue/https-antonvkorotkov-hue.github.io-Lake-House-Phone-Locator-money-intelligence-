import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdtemp,mkdir,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
// Inject an in-memory SQLite implementation of D1 while testing the actual route modules.
// No test account or secret is sent to a hosted service.
class D1 {
 constructor(){this.sqlite=new DatabaseSync(':memory:');this.sqlite.exec('PRAGMA foreign_keys=ON')}
 prepare(sql){let args=[];const statement=this.sqlite.prepare(sql);const prepared={bind(...values){args=values;return prepared},async first(){return statement.all(...args)[0]||null},async all(){return {results:statement.all(...args)}},async run(){return {success:true,meta:statement.run(...args)}},execute(){return {results:statement.all(...args),success:true}}};return prepared}
 async batch(statements){this.sqlite.exec('BEGIN');try{const results=statements.map(x=>x.execute());this.sqlite.exec('COMMIT');return results}catch(e){this.sqlite.exec('ROLLBACK');throw e}}
}
test('account and order APIs: sessions, recovery, persistent fills and replay safety',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'lh-account-test-'));const db=new D1();globalThis.__tradingTestDb=db;globalThis.__tradingTestEnv={DB:db,MARKETDATA_API_KEY:'test-only',MARKETDATA_LICENSE_CONFIRMED:'true',MARKETDATA_REALTIME_CONFIRMED:'true',OWNER_EMAIL:'owner@example.test',CREDENTIAL_ENCRYPTION_KEY:'11'.repeat(32)};const originalFetch=globalThis.fetch;
 try{
  for(const f of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort()) db.sqlite.exec(await readFile('drizzle/'+f,'utf8'));
  const files=['lib/accounts/crypto.ts','lib/accounts/server.ts','app/api/account/route.ts','app/api/watchlist/route.ts','app/api/activity/route.ts','app/api/status/route.ts','app/api/orders/route.ts','app/api/portfolio/route.ts','app/api/owner/marketdata/route.ts','app/api/news/route.ts','app/api/options/route.ts','lib/trading/config.ts'];
  for(const f of files){let source=await readFile(f,'utf8');source=source.replace("import { env } from 'cloudflare:workers';",'const env=globalThis.__tradingTestEnv;').replace("import {env} from 'cloudflare:workers';",'const env=globalThis.__tradingTestEnv;').replaceAll('import.meta.env.DEV','false');let output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;output=output.replace(/from (['"])(\.[^'"]+)\1/g,(_a,q,p)=>`from ${q}${p.endsWith('.mjs')?p:p+'.mjs'}${q}`);const dest=path.join(root,f.replace(/\.ts$/,'.mjs'));await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,output)}
  await mkdir(path.join(root,'lib/news'),{recursive:true});await writeFile(path.join(root,'lib/news/official-feeds.mjs'),await readFile('lib/news/official-feeds.mjs'));
  for(const f of ['engine.mjs','provider.mjs','persistence.mjs','credentials.mjs','market-read.mjs','options-read.mjs']){await mkdir(path.join(root,'lib/trading'),{recursive:true});await writeFile(path.join(root,'lib/trading',f),await readFile('lib/trading/'+f))}
  const account=await import(pathToFileURL(path.join(root,'app/api/account/route.mjs')).href),watchlist=await import(pathToFileURL(path.join(root,'app/api/watchlist/route.mjs')).href),activity=await import(pathToFileURL(path.join(root,'app/api/activity/route.mjs')).href);
  const origin='https://trading.test';let ip=1;
  const request=(cookie,body,method='GET',foreign=false,ownerFlag=false)=>new Request(origin+'/api/account',{method,headers:{'Content-Type':'application/json','Origin':foreign?'https://elsewhere.test':origin,'cf-connecting-ip':`192.0.2.${ip}`,...(ownerFlag?{'oai-authenticated-user-id':'test-owner','oai-authenticated-user-email':ownerFlag===true?'owner@example.test':'other@example.test'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await account.GET(request(''))).status,401);
  let response=await account.POST(request('',{action:'create',displayName:'A'},'POST'));assert.equal(response.status,201);assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);let aCookie=response.headers.get('set-cookie').split(';')[0],a=await response.json();assert.equal(a.cashCents,10000000);assert.equal('sessionToken' in a,false);assert.match(a.recoveryCode,/^[0-9a-f]{64}$/);
  assert.equal((await account.GET(request(aCookie))).status,200);
  assert.equal((await watchlist.POST(request(aCookie,{action:'add',symbol:'AAPL'},'POST'))).status,200);
  await watchlist.POST(request(aCookie,{action:'add',symbol:'AAPL'},'POST'));
  assert.deepEqual((await (await watchlist.GET(request(aCookie))).json()).symbols,['AAPL']);
  response=await account.POST(request('',{action:'create',displayName:'B'},'POST'));const bCookie=response.headers.get('set-cookie').split(';')[0],bRecord=await response.json();assert.equal(response.status,201);
  assert.deepEqual((await (await watchlist.GET(request(bCookie))).json()).symbols,[]);
  let ledger=await (await activity.GET(request(aCookie))).json();assert.equal(ledger.reconciled,true);assert.equal(ledger.entries.length,1);assert.equal(ledger.entries[0].cashDeltaCents,10000000);
  assert.equal((await activity.GET(request(''))).status,401);
  assert.equal((await account.POST(request(aCookie,{action:'rename',displayName:'A renamed'},'POST'))).status,200);
  assert.equal((await (await account.GET(request(bCookie))).json()).displayName,'B');
  response=await account.POST(request('',{action:'recover',recoveryCode:a.recoveryCode},'POST'));assert.equal(response.status,200);const recoveredCookie=response.headers.get('set-cookie').split(';')[0], recovered=await response.json();assert.notEqual(recovered.recoveryCode,a.recoveryCode);
  assert.equal((await account.GET(request(aCookie))).status,401);
  assert.deepEqual((await (await watchlist.GET(request(recoveredCookie))).json()).symbols,['AAPL']);
  assert.equal((await account.POST(request('',{action:'recover',recoveryCode:a.recoveryCode},'POST'))).status,401);
  assert.equal((await account.POST(request('',{action:'create',displayName:'C'},'POST',true))).status,403);
  assert.equal((await account.DELETE(request(recoveredCookie,undefined,'DELETE'))).status,200);
  assert.equal((await account.GET(request(recoveredCookie))).status,401);
  assert.equal((await account.GET(request(bCookie))).status,200);
  ip=2;for(let i=0;i<10;i++) await account.POST(request('',{action:'recover',recoveryCode:'invalid'},'POST'));
  assert.equal((await account.POST(request('',{action:'recover',recoveryCode:'invalid'},'POST'))).status,429);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM accounts').get().n,2);
  const orders=await import(pathToFileURL(path.join(root,'app/api/orders/route.mjs')).href),portfolio=await import(pathToFileURL(path.join(root,'app/api/portfolio/route.mjs')).href);
  let stale=false;
  globalThis.fetch=async url=>Response.json(url.includes('/reference/')?{results:{ticker:'AAPL',active:true,market:'stocks',locale:'us',type:'CS',currency_name:'usd',primary_exchange:'XNAS',name:'Test fixture'}}:url.includes('/marketstatus/')?{serverTime:new Date().toISOString(),exchanges:{nyse:'open',nasdaq:'open'}}:{results:[{bid_price:100,ask_price:100.01,sip_timestamp:(Date.now()-(stale?60000:100))*1e6}]});
  assert.equal((await orders.POST(request('',{action:'preview',symbol:'AAPL',side:'buy',quantityMicros:2000000},'POST'))).status,401);
  let previewResponse=await orders.POST(request(bCookie,{action:'preview',symbol:'AAPL',side:'buy',quantityMicros:2000000},'POST'));assert.equal(previewResponse.status,200);let preview=await previewResponse.json();
  let confirmed=await orders.POST(request(bCookie,{action:'confirm',previewId:preview.previewId},'POST'));assert.equal(confirmed.status,201);let replay=await orders.POST(request(bCookie,{action:'confirm',previewId:preview.previewId},'POST'));assert.equal(replay.status,200);assert.equal((await replay.json()).replayed,true);
  assert.equal((await (await portfolio.GET(request(bCookie))).json()).positions[0].quantityMicros,2000000);
  assert.equal((await (await activity.GET(request(bCookie))).json()).reconciled,true);
  previewResponse=await orders.POST(request(bCookie,{action:'preview',symbol:'AAPL',side:'sell',quantityMicros:1000000},'POST'));assert.equal(previewResponse.status,200);preview=await previewResponse.json();confirmed=await orders.POST(request(bCookie,{action:'confirm',previewId:preview.previewId},'POST'));assert.equal(confirmed.status,201);
  const holding=(await (await portfolio.GET(request(bCookie))).json()).positions[0];assert.equal(holding.quantityMicros,1000000);assert.equal(holding.costCents,10001);assert.equal(holding.realizedCents,-1);
  assert.equal((await orders.POST(request(bCookie,{action:'preview',symbol:'AAPL',side:'sell',quantityMicros:2000000},'POST'))).status,400);
  stale=true;assert.equal((await orders.POST(request(bCookie,{action:'preview',symbol:'AAPL',side:'buy',quantityMicros:1000000},'POST'))).status,409);
  globalThis.__tradingTestEnv.MARKETDATA_API_KEY=undefined;assert.equal((await orders.POST(request(bCookie,{action:'preview',symbol:'AAPL',side:'buy',quantityMicros:1000000},'POST'))).status,503);
  assert.equal((await (await activity.GET(request(bCookie))).json()).reconciled,true);
  const ownerRoute=await import(pathToFileURL(path.join(root,'app/api/owner/marketdata/route.mjs')).href);
  assert.equal((await ownerRoute.GET(request(''))).status,401);
  assert.equal((await ownerRoute.GET(request('',undefined,'GET',false,'other'))).status,401);
  assert.equal((await ownerRoute.POST(request(bCookie,{apiKey:'test-owner-key',licensed:true,realtime:true},'POST'))).status,403);
  assert.equal((await ownerRoute.GET(request('',undefined,'GET',false,true))).status,200);
  let setup=await ownerRoute.POST(request('',{apiKey:'test-owner-key',licensed:true,realtime:true},'POST',false,true));assert.equal(setup.status,200);
  assert.equal(db.sqlite.prepare('SELECT payload FROM settings WHERE id=?').get('marketdata').payload.includes('test-owner-key'),false);
  const savedConfig=await (await import(pathToFileURL(path.join(root,'lib/trading/config.mjs')).href)).marketConfig();assert.equal(savedConfig.apiKey,'test-owner-key');
  assert.equal((await (await ownerRoute.GET(request('',undefined,'GET',false,true))).json()).apiKey,undefined);
  ip=3;
  const bRestore=await account.POST(request('',{action:'recover',recoveryCode:bRecord.recoveryCode},'POST'));assert.equal(bRestore.status,200);const restoredB=bRestore.headers.get('set-cookie').split(';')[0];
  assert.equal((await account.GET(request(bCookie))).status,401);
  assert.equal((await (await orders.GET(request(restoredB))).json()).orders.length,2);
  const filtered=new Request(origin+'/api/orders?side=buy',request(restoredB));assert.equal((await (await orders.GET(filtered)).json()).orders.length,1);
  assert.equal((await (await orders.GET(new Request(origin+'/api/orders?side=sell',request(restoredB)))).json()).orders.length,1);
  const aRestore=await account.POST(request('',{action:'recover',recoveryCode:recovered.recoveryCode},'POST'));const restoredA=aRestore.headers.get('set-cookie').split(';')[0];assert.equal((await (await orders.GET(request(restoredA))).json()).orders.length,0);
  assert.equal((await (await portfolio.GET(request(restoredB))).json()).positions[0].quantityMicros,1000000);
  const newsRoute=await import(pathToFileURL(path.join(root,'app/api/news/route.mjs')).href);let newsFetches=0;
  globalThis.fetch=async(url,options)=>{newsFetches++;assert.equal(options.headers.Authorization,undefined);const host=new URL(url).hostname;return new Response('<rss><channel><item><title>Test official release</title><link>https://'+host+'/news/test-release</link><pubDate>Tue, 27 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>')};
  let news=await (await newsRoute.GET(request(''))).json();assert.equal(news.stories.length,2);assert.equal(newsFetches,2);const initialRefresh=news.fetchedAt;assert.equal((await (await newsRoute.GET(request(''))).json()).cached,true);assert.equal(newsFetches,2);
  db.sqlite.prepare('UPDATE settings SET updated_at=0 WHERE id=?').run('official-news');globalThis.fetch=async()=>{throw Error('Test source outage')};news=await (await newsRoute.GET(request(''))).json();assert.equal(news.stories.length,2);assert.equal(news.fetchedAt,initialRefresh);assert.equal(news.warnings.length,3);


 }finally{globalThis.fetch=originalFetch;delete globalThis.__tradingTestEnv;delete globalThis.__tradingTestDb;db.sqlite.close();await rm(root,{recursive:true,force:true})}
});
