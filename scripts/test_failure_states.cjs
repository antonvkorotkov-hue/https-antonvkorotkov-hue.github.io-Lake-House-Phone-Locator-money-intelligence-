const fs=require('node:fs');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const event={id:'qa-event',shortName:'AWY @ HME',date:'2026-10-19T23:00:00Z',status:{type:{state:'pre',detail:'Scheduled'}},competitions:[{competitors:[{homeAway:'away',team:{id:'1',abbreviation:'AWY',displayName:'Away Team'},score:'0'},{homeAway:'home',team:{id:'2',abbreviation:'HME',displayName:'Home Team'},score:'0'}],odds:[{provider:{name:'Current Provider'},moneyline:{home:{close:{odds:'-110'}},away:{close:{odds:'+100'}}}}]}]};
async function start(fetcher){
 const dom=new JSDOM('<!doctype html><body data-tab="games"><div id="lhVisualHero"></div><nav class="mobile-bottom"><button data-screen="games">Games</button><button data-screen="money">Trades</button><button data-screen="scores">Scores</button><button data-screen="more">More</button></nav></body>',{url:'https://example.org/',runScripts:'outside-only'});
 dom.window.AbortSignal=AbortSignal;dom.window.fetch=fetcher;
 for(const module of ['analytics.js','charts.js','research.js','intelligence.js'])if(fs.existsSync(module))dom.window.eval(fs.readFileSync(module,'utf8'));
 dom.window.eval(fs.readFileSync('visual.js','utf8'));await delay(100);return dom;
}
const json=data=>({ok:true,json:async()=>data});
(async()=>{
 // A failure does not masquerade as a healthy roster or zero betting activity.
 const failed=await start(async url=>{
  if(String(url).includes('scoreboards.json'))return json({sports:{nfl:{events:[event],collected_at:'2026-10-18T21:00:00Z'}},history:{}});
  if(String(url).includes('public-trades.json'))throw Error('Trade service offline');
  if(String(url).includes('/summary?'))throw Error('Summary offline');
  throw Error('Scoreboard offline');
 });
 let text=failed.window.document.getElementById('lh-v2-games').textContent;
 assert.match(failed.window.document.getElementById('lh-v2-status').textContent,/scheduled snapshot/);
 assert.match(text,/Summary offline|report unavailable/i);
 assert(!/all players healthy|0% handle|0% tickets/i.test(text));
 assert.equal(failed.window.document.querySelectorAll('#lh-v2-event option').length,1,'Dated fallback preserves selection');failed.window.close();
 const reportFallback=await start(async url=>{
  if(String(url).includes('scoreboards.json'))return json({sports:{},history:{},reports:{'nfl:qa-event':{collected_at:'2026-10-18T21:00:00Z',source:'ESPN scheduled summary',report:{header:{id:'qa-event'},gameInfo:{venue:{fullName:'Archived Verified Stadium'}},boxscore:{teams:[]}}}}});
  if(String(url).includes('public-trades.json'))return json({markets:[],errors:[]});
  if(String(url).includes('/summary?'))throw Error('Summary offline');
  return json({events:[event]});
 });
 text=reportFallback.window.document.getElementById('lh-v2-games').textContent;
 assert.match(text,/Archived Verified Stadium/);assert.match(text,/dated scheduled fallback/);assert.match(text,/STALE/i,'Archived report age is visible');reportFallback.window.close();
 // Another provider's recorded history cannot stand in for the displayed provider.
 const provider=await start(async url=>{
  if(String(url).includes('scoreboards.json'))return json({sports:{},history:{'nfl:qa-event:Other Provider':[{provider:'Other Provider',time:'2026-10-19T20:00:00Z',home_moneyline:-200},{provider:'Other Provider',time:'2026-10-19T21:00:00Z',home_moneyline:-300}]}});
  if(String(url).includes('public-trades.json'))return json({markets:[],errors:[]});
  if(String(url).includes('/summary?'))return json({header:{id:'qa-event'},boxscore:{teams:[]}});
  return json({events:[event]});
 });
 text=provider.window.document.getElementById('lh-v2-games').textContent;
 assert(!text.includes('Other Provider'),'Provider-isolated quote history');
 assert(!text.includes('-200 → -300'),'No misleading cross-provider line movement');provider.window.close();
 // An old exchange response cannot silently overwrite a later successful refresh.
 let tradeRequest=0;
 const race=await start(async url=>{
  if(String(url).includes('scoreboards.json'))return json({sports:{},history:{}});
  if(String(url).includes('public-trades.json')){
   const n=++tradeRequest;if(n===2)await delay(150);
   const trades=Array.from({length:n===2?2:1},(_,i)=>({id:'race-'+n+'-'+i,time:'2026-10-19T20:00:00Z',side:'yes',contracts:2,premium_usd:1}));
   return json({collected_at:'2026-10-19T21:00:00Z',markets:[{series:'KXNFLGAME',ticker:'KXNFLGAME-26OCT19AWYHME-HME',market:'Home wins',trades}],errors:[]});
  }
  if(String(url).includes('/summary?'))return json({header:{id:'qa-event'},boxscore:{teams:[]}});
  return json({events:[event]});
 });
 race.window.document.getElementById('lh-v2-refresh').click();await delay(10);race.window.document.getElementById('lh-v2-refresh').click();await delay(250);race.window.document.querySelector('#lh-v2-games [data-lh-market="winner"]').click();
 assert.equal(race.window.document.querySelector('#lh-v2-games .lh-v2-stats strong').textContent,'1','Latest exchange refresh wins even after an earlier response finishes');race.window.close();
 // Summary freshness expires independently of a manual forced refresh.
 let summaryRequests=0;
 const ttl=await start(async url=>{
  if(String(url).includes('scoreboards.json'))return json({sports:{},history:{}});
  if(String(url).includes('public-trades.json'))return json({markets:[],errors:[]});
  if(String(url).includes('/summary?')){summaryRequests++;return json({header:{id:'qa-event'},boxscore:{teams:[]}});}
  return json({events:[event]});
 });
 assert.equal(summaryRequests,1,'Initial summary fetched');
 ttl.window.document.querySelector('[data-screen="scores"]').click();await delay(30);assert.equal(summaryRequests,1,'Fresh summary cache avoids redundant requests');
 const actualNow=ttl.window.Date.now;ttl.window.Date.now=()=>actualNow()+61000;
 ttl.window.document.querySelector('[data-screen="scores"]').click();await delay(50);assert.equal(summaryRequests,2,'Older-than-minute summary refreshes without forcing or changing game');ttl.window.close();
 const crossCheckBase={status:'PASS',checked_at:new Date().toISOString(),espn_start:event.date,official_start:event.date,start_difference_minutes:0,source:'https://statsapi.mlb.com/api/v1/schedule'};
 for(const check of [crossCheckBase,{...crossCheckBase,status:'CONFLICT',start_difference_minutes:8,reason:'Official schedule differs by 8 minutes'},{...crossCheckBase,status:'CONFLICT',stale:true,error:'Official source offline'},{...crossCheckBase,checked_at:'invalid-time',official_start:'invalid-time'}]){
  const checked=await start(async url=>{
   if(String(url).includes('scoreboards.json'))return json({sports:{},history:{},independent:{'mlb:qa-event':check}});
   if(String(url).includes('public-trades.json'))return json({markets:[],errors:[]});
   if(String(url).includes('/summary?'))return json({header:{id:'qa-event'},boxscore:{teams:[]}});
   return json({events:[event]});
  });
  assert(!checked.window.document.getElementById('lh-v2-games').textContent.includes('Independent schedule cross-check'),'MLB cross-check never leaks to NFL');
  checked.window.document.querySelector('[data-lh-sport="mlb"]').click();await delay(50);
  const panel=[...checked.window.document.querySelectorAll('#lh-v2-games article')].find(p=>p.querySelector('h2')?.textContent==='Independent schedule cross-check');assert(panel,'Matched MLB official schedule panel appears');assert(panel.textContent.includes(check.status));
  if(check.status==='CONFLICT')assert(panel.textContent.includes(check.error||check.reason));
  if(check.stale||check.checked_at==='invalid-time')assert(panel.textContent.includes('STALE'));
  assert(!panel.textContent.includes('Invalid Date'),'Invalid official time is not rendered as a date');checked.window.close();
 }
 // No games / markets is an explicit empty state, never a blank page.
 const empty=await start(async url=>json(String(url).includes('public-trades.json')?{markets:[],errors:[]}:String(url).includes('scoreboards.json')?{sports:{},history:{}}:{events:[]}));
 text=empty.window.document.getElementById('lh-v2-games').textContent;
 assert.match(text,/No games available/);assert.match(text,/No matching/);empty.window.close();
 console.log('PASS: scoreboard failure fallback; summary/trade failure transparency; provider-isolated history; explicit empty states.');
})().catch(e=>{console.error(e);process.exit(1)});
