const fs=require('node:fs');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
// Deterministic structural fixture from the inspected public preview; independent of future feed rows.
const split={provider:'DraftKings via VSiN public preview fixture',source_url:'https://data.vsin.com/draftkings/betting-splits/',observed_at:'2026-10-19T21:42:22Z',source_updated_at:null,sport:'mlb',event_id:'qa-split-game',mapping_status:'matched',away:{team:'Cleveland Guardians',spread:{line:'+1.5',handle_pct:58,ticket_pct:25},moneyline:{line:'+130',handle_pct:28,ticket_pct:23}},home:{team:'Tampa Bay Rays',spread:{line:'-1.5',handle_pct:42,ticket_pct:75},moneyline:{line:'-158',handle_pct:72,ticket_pct:77}},total_limitation:'Public rows do not explicitly identify over/under sides; total split percentages omitted.',coverage:'Limited public preview fixture'};
const event={id:String(split.event_id),shortName:'CLE @ TB',date:'2026-10-19T23:00:00Z',status:{type:{state:'pre',detail:'Scheduled'}},competitions:[{competitors:[{homeAway:'away',team:{id:'1',abbreviation:'CLE',displayName:split.away.team}},{homeAway:'home',team:{id:'2',abbreviation:'TB',displayName:split.home.team}}]}]};
const dom=new JSDOM('<!doctype html><body data-tab="games"><div id="lhVisualHero"></div><nav class="mobile-bottom"><button data-screen="games">Games</button><button data-screen="money">Trades</button><button data-screen="scores">Scores</button><button data-screen="more">More</button></nav></body>',{url:'https://example.org/',runScripts:'outside-only'});
const w=dom.window;w.AbortSignal=AbortSignal;let failSplits=false;
const json=data=>({ok:true,json:async()=>data});
w.fetch=async url=>{
 const u=String(url);if(u.includes('sportsbook-splits.json')){if(failSplits)throw Error('Split service offline');return json({entries:[split],errors:[]});}
 if(u.includes('scoreboards.json'))return json({sports:{},history:{}});
 if(u.includes('public-trades.json'))return json({markets:[],errors:[]});
 if(u.includes('/summary?'))return json({header:{id:new URL(u).searchParams.get('event')},boxscore:{teams:[]}});
 return json({events:[event,{...event,id:'unmatched-other-game'}]});
};
for(const module of ['analytics.js','charts.js','research.js','intelligence.js','visual.js'])w.eval(fs.readFileSync(module,'utf8'));
const screen=()=>w.document.getElementById('lh-v2-games');
(async()=>{
 await delay(100);assert.equal(screen().querySelectorAll('.lh-split-table').length,0,'MLB preview cannot appear on NFL');
 w.document.querySelector('[data-lh-sport="mlb"]').click();await delay(100);
 let text=screen().textContent;
 for(const expected of [split.provider,'Dollar handle share','Ticket share','publication/update time: not supplied','28%','23%','5.0 percentage points','72%','77%','-5.0 percentage points'])assert(text.includes(expected),'Split fidelity '+expected);
 assert(text.includes('Actual total dollar handle and ticket counts are not supplied'));
 screen().querySelector('[data-lh-market="spread"]').click();text=screen().textContent;assert(text.includes('58%'));assert(text.includes('25%'));assert(text.includes('33.0 percentage points'));
 screen().querySelector('[data-lh-market="total"]').click();assert.equal(screen().querySelectorAll('.lh-split-table').length,0,'Ambiguous O/U percentages never assigned');assert(screen().textContent.includes('do not explicitly identify over/under'));
 const picker=w.document.getElementById('lh-v2-event');picker.value='e:unmatched-other-game';picker.dispatchEvent(new w.Event('change',{bubbles:true}));await delay(50);screen().querySelector('[data-lh-market="winner"]').click();assert.equal(screen().querySelectorAll('.lh-split-table').length,0,'Different matchup does not inherit splits');
 picker.value='e:'+event.id;picker.dispatchEvent(new w.Event('change',{bubbles:true}));await delay(50);failSplits=true;w.document.getElementById('lh-v2-refresh').click();await delay(100);assert(screen().textContent.includes('Split service offline'),'Failed refresh remains visible beside retained dated split observation');
 w.close();console.log('PASS: verified MLB split percentages/differences/provider/publication warning, league/game isolation, ambiguous totals omitted and failed-refresh warning.');
})().catch(e=>{console.error(e);w.close();process.exit(1)});
