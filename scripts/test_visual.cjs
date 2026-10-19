setTimeout(()=>{console.error('Visual QA timed out');process.exit(2)},10000).unref();
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');

(async()=>{
const dom=new JSDOM('<!doctype html><html><body data-tab="games"><header>Lake House Picks</header><div id="lhVisualHero"></div><nav class="mobile-bottom"><button data-screen="games">Games</button><button data-screen="money">Trades</button><button data-screen="scores">Scores</button><button data-screen="more">More</button></nav></body></html>',{url:'https://example.org/',runScripts:'outside-only'});
const w=dom.window;
const event={id:'1',shortName:'WSH @ SF',date:'2026-10-19T20:15:00Z',status:{type:{detail:'Scheduled',shortDetail:'8:15 PM'}},competitions:[{competitors:[{homeAway:'away',score:'0',team:{abbreviation:'WSH',shortDisplayName:'Commanders',logo:'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png'}},{homeAway:'home',score:'0',team:{abbreviation:'SF',shortDisplayName:'49ers',logo:'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png'}}],odds:[{provider:{name:'Verified Test Book'},details:'SF -6.5',overUnder:47.5,homeTeamOdds:{moneyLine:-250},awayTeamOdds:{moneyLine:210}}]}]};
event.competitions[0].odds[0].moneyline={home:{close:{odds:'-280'},open:{odds:'-250'}},away:{close:{odds:'+230'},open:{odds:'+210'}}};
event.competitions[0].odds[0].pointSpread={home:{close:{line:'-6.5',odds:'-110'}},away:{close:{line:'+6.5',odds:'-110'}}};
const market={series:'KXNFLGAME',event:'Washington at San Francisco',ticker:'KXNFLGAME-26OCT19WASSF-SF',trades:[{id:'a',time:'2026-10-19T03:00:00Z',premium_usd:10,contracts:20,side:'yes'},{id:'b',time:'2026-10-19T03:01:00Z',premium_usd:12,contracts:20,side:'yes'}]};
const json={markets:[market],collected_at:new Date().toISOString(),errors:[]};
w.AbortSignal=AbortSignal;
w.fetch=async url=>{
const address=String(url);
let data;if(address.includes('scoreboards.json'))data={sports:{},history:{}};else if(address.includes('public-trades.json'))data=json;
else if(address.includes('/summary?'))data={boxscore:{teams:[{team:{abbreviation:'WSH'},statistics:[{name:'totalYards',label:'Total yards',displayValue:'300'}]},{team:{abbreviation:'SF'},statistics:[{name:'totalYards',label:'Total yards',displayValue:'350'}]}]},leaders:[]};
else if(address.includes('/scoreboard'))data={events:[event]};
else throw new Error('Unexpected request: '+address);
return {ok:true,json:async()=>data};
};
const original=fs.readFileSync('visual.js','utf8');
w.eval(original);
await new Promise(resolve=>setTimeout(resolve,150));
const q=id=>w.document.getElementById(id);
assert.ok(q('lh-v2'),'Visual app mounts');
assert.ok(q('lh-v2-games').querySelector('.lh-v2-hero'),'Games hero renders');
assert.ok(q('lh-v2-games').textContent.includes('SF -6.5'),'Published spread displayed');
assert.ok(q('lh-v2-games').textContent.includes('+230'),'Nested ESPN moneyline is rendered');
assert.ok(q('lh-v2-games').textContent.includes('Not published'),'Missing markets visibly unavailable');
assert.ok(q('lh-v2-games').querySelector('svg.lh-v2-line'),'Real-trade SVG renders');
assert.ok(q('lh-v2-games').textContent.includes('Team comparison'),'Team stats render');
assert.ok(q('lh-v2-trades').querySelector('svg.lh-v2-line'),'Trades screen renders a verified trade chart');
assert.ok(q('lh-v2-scores').textContent.includes('Player leaders'),'Scores screen renders');
q('lh-v2-event').dispatchEvent(new w.Event('change',{bubbles:true}));
w.document.body.dataset.tab='money';
w.document.querySelector('[data-screen="money"]').click();
assert.ok(q('lh-v2-page-title').textContent==='Trades','Tab switching updates page title');
const buttons=w.document.querySelectorAll('[data-lh-market]');
buttons[1].click();
assert.ok(q('lh-v2-trades').textContent.includes('Spread'),'Market selector updates Trades screen');
const sport=w.document.querySelector('[data-lh-sport="nba"]');sport.click();
await new Promise(resolve=>setTimeout(resolve,150));
assert.equal(sport.getAttribute('aria-pressed'),'true','Sport button updates');
// Slow earlier league requests must not overwrite a later league selection.
const originalFetch=w.fetch;
w.fetch=async url=>{
 if(String(url).includes('/nba/scoreboard')){await new Promise(r=>setTimeout(r,200));return {ok:true,json:async()=>({events:[{...event,id:'nba-race',shortName:'NBA RACE'}]})}}
 if(String(url).includes('/mlb/scoreboard'))return {ok:true,json:async()=>({events:[{...event,id:'mlb-race',shortName:'MLB RACE'}]})};
 return originalFetch(url);
};
w.document.querySelector('[data-lh-sport="nba"]').click();
w.document.querySelector('[data-lh-sport="mlb"]').click();
await new Promise(r=>setTimeout(r,300));
assert.ok(q('lh-v2-event').textContent.includes('MLB RACE'),'Latest league response wins');
assert.ok(!q('lh-v2-event').textContent.includes('NBA RACE'),'Earlier league cannot overwrite');
w.fetch=originalFetch;
// Same teams on another date must never supply the selected game's chart.
json.markets=[{...market,ticker:'KXNFLGAME-26OCT18WASSF-SF'}];
w.document.querySelector('[data-lh-sport="nfl"]').click();
await new Promise(resolve=>setTimeout(resolve,150));
assert.ok(!q('lh-v2-games').querySelector('svg.lh-v2-line'),'Reject trades from a different game date');
// Null and absent observations remain unavailable, never zero prices.
assert.ok(q('lh-v2-games').textContent.includes('Not published'));
w.close();
console.log('PASS: game cards, odds, missing markets, trade graph, team stats, score view, tabs, sports.');
})().catch(e=>{console.error(e);process.exit(1)});