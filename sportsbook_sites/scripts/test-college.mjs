import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {api,now,quoteReason} from '../lib/sportsbook.mjs';
import {offers,espnEvents,eventMatches,collegeLeagues,refresh,publicMarkets,american} from '../lib/sportsbook-feeds.mjs';

// Provider-shaped fixtures, never inserted into production or presented as real odds.
const sqlite=new DatabaseSync(':memory:');
for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+f,'utf8'));
function prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){return sqlite.prepare(sql).run(...args)}}}
const db={prepare,async batch(commands){sqlite.exec('BEGIN IMMEDIATE');try{const result=[];for(const c of commands)result.push(await c.run());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const env={DB:db,ODDS_API_IO_KEY:'fixture-key',SB_ODDS_AUTHORIZED:'1',SB_SETUP_SECRET:'fixture-setup'};
const start=new Date((now()+7200)*1000).toISOString();
const board={events:[{id:'college-fixture',date:start,status:{type:{state:'pre',detail:'Scheduled'}},competitions:[{competitors:[{homeAway:'home',team:{displayName:'Penn State Nittany Lions',shortDisplayName:'Penn State',location:'Penn State',abbreviation:'PSU'},score:'0'},{homeAway:'away',team:{displayName:'Ohio State Buckeyes',shortDisplayName:'Ohio State',location:'Ohio State',abbreviation:'OSU'},score:'0'}]}]}]};
const event=espnEvents(board,'college','fixture://espn')[0];
const provider={id:42,home:'Penn St.',away:'Ohio State',date:start,status:'pending'};
assert(eventMatches(provider,event));assert(!eventMatches({...provider,home:'Ohio State',away:'Penn State'},event));
assert(!eventMatches({...provider,date:new Date((event.starts_at+181)*1000).toISOString()},event));
assert(!eventMatches({...provider,home:'Michigan'},event));
assert.deepEqual(collegeLeagues([{name:'USA - NCAA',slug:'verified-ncaa'},{name:'USA NFL',slug:'usa-nfl'}]),['verified-ncaa']);
assert.throws(()=>collegeLeagues([{name:'USA NFL',slug:'usa-nfl'}]),/no college/);
const unchangedAt=new Date((now()-3600)*1000).toISOString();
const snapshot=()=>({...provider,bookmakers:{DraftKings:[
 {name:'ML',updatedAt:unchangedAt,odds:[{home:'1.90',away:'2.10'}]},
 {name:'Spread',updatedAt:unchangedAt,odds:[{hdp:-3.5,home:'1.91',away:'1.91'}]},
 {name:'Totals',updatedAt:unchangedAt,odds:[{max:48.5,over:'1.95',under:'1.85'}]}
]}});
assert.equal(offers(snapshot(),event,env).length,6);assert.equal(american('100.00'),9900);const capped=snapshot();capped.bookmakers.DraftKings[0].odds[0].max=500;assert.equal(offers(capped,event,env).find(q=>q.market==='moneyline').line,null);
const parsed=offers(snapshot(),event,env);assert.equal(parsed.find(q=>q.market==='spread'&&q.side==='away').line,'3.5');
for(const [mutate,reason] of [
 [m=>delete m.updatedAt,'timestamp missing'],
 [m=>m.updatedAt=new Date((now()+10)*1000).toISOString(),'future'],
 [m=>m.suspended=true,'suspended'],
 [m=>m.odds[0].suspended=true,'suspended']
]){const p=snapshot(),reasons={};p.bookmakers.DraftKings.forEach(mutate);assert.equal(offers(p,event,env,reasons).length,0);assert(Object.keys(reasons).some(k=>k.includes(reason)));}
const live={...event,state:'live'};let reasons={};assert.equal(offers(snapshot(),live,env,reasons).length,0);assert(Object.keys(reasons).some(k=>k.includes('authorization')));
assert.equal(offers(snapshot(),live,{...env,SB_LIVE_ODDS_AUTHORIZED:'1'}).length,6);
const unchangedLive=offers(snapshot(),live,{...env,SB_LIVE_ODDS_AUTHORIZED:'1'});assert.equal(unchangedLive.length,6);assert.equal(unchangedLive[0].source_at,Math.floor(Date.parse(unchangedAt)/1000));assert(unchangedLive[0].expires_at<=now()+15);assert.match(quoteReason({...unchangedLive[0],received_at:now()-16},live),/expired/);
let mode='fresh',requests=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async input=>{
 const u=new URL(input);requests.push(u);
 if(u.hostname.includes('espn')){
  if(u.pathname.endsWith('/summary'))return Response.json({});
  assert.equal(u.searchParams.get('groups'),'80');assert.equal(u.searchParams.get('limit'),'1000');return Response.json(board);
 }
 if(u.pathname.endsWith('/leagues'))return Response.json([{name:'USA NCAA',slug:'verified-ncaa'}]);
 if(u.pathname.endsWith('/events')){assert.equal(u.searchParams.get('league'),'verified-ncaa');return Response.json([provider]);}
 if(u.pathname.endsWith('/odds/multi')){
  if(mode==='outage')return new Response('upstream unavailable',{status:429,headers:{'x-ratelimit-limit':'100','x-ratelimit-remaining':'0','x-ratelimit-reset':new Date((now()+300)*1000).toISOString()}});
  if(mode==='missing')return Response.json([]);
  const s=snapshot();if(mode==='suspended')s.bookmakers.DraftKings.forEach(m=>m.suspended=true);
  return Response.json([s]);
 }
 throw Error('Unexpected test URL '+u.pathname);
};
await refresh(env,'college');assert.equal(sqlite.prepare('SELECT count(*) n FROM sb_quotes WHERE suspended=0').get().n,6);
let diagnostic=JSON.parse(sqlite.prepare('SELECT payload FROM sb_feed_diagnostics').get().payload);assert.deepEqual(diagnostic.leagues,['verified-ncaa']);assert.equal(diagnostic.matched_events,1);assert.equal(diagnostic.quotes,6);
const originalQuote=sqlite.prepare('SELECT * FROM sb_quotes LIMIT 1').get();sqlite.prepare('UPDATE sb_quotes SET received_at=?,expires_at=?').run(now()-200,now()-1);sqlite.prepare("UPDATE sb_config SET value=0 WHERE key='feed_refresh_college'").run();await refresh(env,'college');const reconfirmed=sqlite.prepare('SELECT * FROM sb_quotes WHERE id=?').get(originalQuote.id);assert.equal(reconfirmed.source_at,originalQuote.source_at);assert(reconfirmed.expires_at>now());assert(reconfirmed.received_at>now()-2);
const publicFeed=await publicMarkets(env,'college');assert.equal(publicFeed.quotes.length,6);assert.equal(publicFeed.events.length,1);assert(publicFeed.quotes.every(q=>q.event_id===publicFeed.events[0].id));assert(publicFeed.quotes.every(q=>!('user_id' in q)&&!('request_key' in q)));
const count=requests.length;await refresh(env,'college');assert.equal(requests.length,count,'ten-second shared refresh lease');
let ip=0;
async function call(path,body,auth={}){const headers={Origin:'https://fixture.test','cf-connecting-ip':String(++ip)};if(auth.cookie)headers.Cookie=auth.cookie;if(auth.bearer)headers.Authorization='Bearer '+auth.bearer;if(auth.csrf)headers['X-CSRF-Token']=auth.csrf;if(path==='setup')headers['X-Setup-Secret']=env.SB_SETUP_SECRET;return api(new Request('https://fixture.test/api/sportsbook/'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}),env)}
function auth(r){const cs=r.headers.getSetCookie();return {cookie:cs.map(v=>v.split(';')[0]).join('; '),csrf:cs.find(v=>v.startsWith('lh_csrf=')).split(';')[0].slice(8)}}
assert.equal((await call('setup',{username:'fixtureowner',password:'fixture-owner-password'})).status,200);
const owner=auth(await call('login',{username:'fixtureowner',password:'fixture-owner-password'}));
const invitation=await (await call('invites',{starting_points:1000},owner)).json();
const joined=await call('join',{username:'fixturefriend',password:'fixture-friend-password',invite:invitation.invitation_code});const session=await joined.json();const friend={bearer:session.session_token,csrf:session.csrf_token};assert.match(friend.bearer,/^[A-Za-z0-9_-]{43}$/);assert.equal((await call('me',undefined,JSON.parse(JSON.stringify(friend)))).status,200);
const feed=await (await call('quotes?sport=college',undefined,friend)).json();assert.equal(feed.quotes.length,6);assert.equal(feed.events.length,1);assert.equal(feed.diagnostics[0].matched_events,1);
const quote=feed.quotes.find(q=>q.market==='spread'&&q.side==='home');assert.equal(quote.unavailable_reason,null);
const body={quote_id:quote.id,stake_points:25,request_key:'college-fixture-retry'};assert.equal((await call('picks',body,{bearer:friend.bearer})).status,403);assert.equal((await call('me',undefined,{bearer:'invalid-token'})).status,401);assert.equal((await (await call('quotes?sport=college&market=spread',undefined,friend)).json()).quotes.length,2);
env.SB_ODDS_AUTHORIZED='0';assert.equal((await call('picks',body,friend)).status,409);env.SB_ODDS_AUTHORIZED='1';
const accepted=await (await call('picks',body,friend)).json();assert(accepted.pick_id);
assert.equal((await (await call('picks',body,friend)).json()).duplicate,true);
assert.equal((await (await call('me',undefined,friend)).json()).balance_points,975);
const picks=await (await call('picks',undefined,friend)).json();assert.equal(picks.length,1);assert.equal(picks[0].selection,quote.selection);
const signedIn=await (await call('login',{username:'fixturefriend',password:'fixture-friend-password'})).json();const signedAgain={bearer:signedIn.session_token,csrf:signedIn.csrf_token};
assert.deepEqual(await (await call('picks',undefined,signedAgain)).json(),picks);assert.equal((await (await call('me',undefined,signedAgain)).json()).balance_points,975);
for(const next of ['suspended','missing','outage']){
 mode=next;sqlite.prepare("UPDATE sb_config SET value=0 WHERE key='feed_refresh_college'").run();await refresh(env,'college');
 diagnostic=JSON.parse(sqlite.prepare('SELECT payload FROM sb_feed_diagnostics').get().payload);
 if(next==='outage')assert.match(diagnostic.reason,/HTTP 429/);else assert.equal(sqlite.prepare('SELECT count(*) n FROM sb_quotes WHERE suspended=0').get().n,0);
 assert.equal((await call('picks',{...body,request_key:'college-blocked-'+next},friend)).status,409);
 assert.equal((await (await call('me',undefined,friend)).json()).balance_points,975);
}
const providerCalls=requests.filter(u=>u.hostname.includes('odds-api')).length;sqlite.prepare("UPDATE sb_config SET value=0 WHERE key='feed_refresh_college'").run();await refresh(env,'college');assert.equal(requests.filter(u=>u.hostname.includes('odds-api')).length,providerCalls,'shared provider backoff prevents upstream retries');assert((await publicMarkets(env,'college')).retry_at>now()+290,'honors ISO provider reset time');
sqlite.prepare('UPDATE sb_quotes SET suspended=0,expires_at=?').run(now()-1);
assert.equal((await call('picks',{...body,request_key:'college-expired-price'},friend)).status,409);
assert.match(quoteReason({...parsed[0],expires_at:now()-1},event),/expired/);
assert.equal((await (await call('picks',undefined,friend)).json()).length,1);
assert.equal(sqlite.prepare('SELECT sum(delta) n FROM sb_postings').get().n,0);
assert.equal((await call('logout',{},signedAgain)).status,200);assert.equal((await call('me',undefined,signedAgain)).status,401);globalThis.fetch=originalFetch;
console.log('PASS college feed integration: discovered league, ESPN scope, team aliases, exact two-team/time matching, all 3 markets, original last-change timestamps plus fresh snapshot confirmation, live authorization, 10s lease, suspension/removal and provider errors.');
console.log('PASS college account API: 25-point pick saved once, 1000 → 975, retry unchanged, history and new-session persistence, expired/suspended odds rejected; balanced ledger. Full no-cookie bearer/CSRF path including re-login and logout revocation passed. Fixture-only, not live provider/iPhone certification.');
