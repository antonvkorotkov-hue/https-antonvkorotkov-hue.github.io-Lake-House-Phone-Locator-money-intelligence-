(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number.isFinite(Number(v))?'$'+Math.round(Number(v)).toLocaleString():'—';
const formatOdds=v=>v==null||v===''?'Unavailable':(Number(v)>0?'+':'')+String(v);
const sportPaths={nfl:'football/nfl',college:'football/college-football',nba:'basketball/nba',mlb:'baseball/mlb'};
let generation=0;
const state={sport:'nfl',selected:'',market:'winner',events:[],markets:[],collected:null,scoreLoaded:null,tradeError:'',collectorErrors:[],scoreError:'',report:null,reportEvent:'',scoresCache:{},quoteHistory:{},scoreSnapshot:null,tab:'games'};
const root=document.createElement('section');root.id='lh-v2';root.className='lh-v2-root';
root.innerHTML='<div class="lh-v2-head"><div><span class="lh-v2-eyebrow">LAKE HOUSE GAME CENTER</span><h1 id="lh-v2-page-title">Games</h1></div><button id="lh-v2-refresh" type="button" aria-label="Refresh current sports data">↻ Refresh</button></div><div class="lh-v2-sports" role="group" aria-label="Sports"><button data-lh-sport="nfl" aria-pressed="true">NFL</button><button data-lh-sport="college">College Football</button><button data-lh-sport="nba">NBA</button><button data-lh-sport="mlb">MLB</button></div><label class="lh-v2-selector-label" for="lh-v2-event">Selected matchup</label><select id="lh-v2-event" aria-label="Selected matchup"><option>Loading games…</option></select><div id="lh-v2-status" class="lh-v2-status" role="status"></div><div id="lh-v2-games" class="lh-v2-screen"></div><div id="lh-v2-trades" class="lh-v2-screen"></div><div id="lh-v2-scores" class="lh-v2-screen"></div><div id="lh-v2-more" class="lh-v2-screen"><article class="lh-v2-panel"><h2>Sources and limitations</h2><div id="lh-v2-source-status"></div><p>ESPN supplies public game scores and selected statistics and published quotes. Kalshi supplies public, sampled exchange trades. These are not a live feed of DraftKings wager amounts or private sportsbook transactions.</p><p>Unavailable odds, team totals, player props, injuries, and betting percentages are never estimated.</p></article></div>';
const insertion=$('lhVisualHero')||$('gameMoney')||$('scoreboardSection');if(!insertion)return;
insertion.parentNode.insertBefore(root,insertion);
document.body.classList.add('lh-v2');
const leagueTicker={nfl:['KXNFL'],college:['KXNCAAF','KXCFB'],nba:['KXNBA'],mlb:['KXMLB']};
const marketLabel={winner:'Winner / moneyline',spread:'Alternative winning margins (not sportsbook spread)',total:'Exchange total thresholds (not O/U odds)',team:'Team total O/U',half:'First-half markets',props:'Player props'};
function leagueFor(m){return (leagueTicker[state.sport]||[]).some(prefix=>String(m.series||'').startsWith(prefix))}
function shortName(event){return event?.shortName||event?.name||event?.id||'Matchup'}
function participants(event){const teams=event?.competitions?.[0]?.competitors||[];return {away:teams.find(t=>t.homeAway==='away')||teams[0],home:teams.find(t=>t.homeAway==='home')||teams[1]}}
function selectedEvent(){return state.events.find(e=>'e:'+e.id===state.selected)||null}
function selectedMarketKey(){return state.selected.startsWith('m:')?state.selected.slice(2):''}
function tickerGame(m){return String(m.ticker||'').split('-')[1]||''}
function selectedMarkets(){
 const key=selectedMarketKey();if(key)return availableMarkets().filter(m=>tickerGame(m)===key);
 return marketsForEvent(selectedEvent());
}
function marketsForEvent(ev){
 if(!ev)return [];
 const pair=participants(ev),a=pair.away?.team?.abbreviation||'',h=pair.home?.team?.abbreviation||'';
 const aliases=x=>x==='WSH'||x==='WAS'?['WSH','WAS']:x==='JAX'||x==='JAC'?['JAX','JAC']:x==='LV'?['LV','LVR']:x==='LAR'?['LAR','LA']: [x];
 const day=new Date(ev.date);if(!a||!h||!Number.isFinite(day.getTime()))return [];
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'2-digit',month:'short',day:'2-digit'}).formatToParts(day);
 const part=k=>parts.find(p=>p.type===k).value;const dateKey=part('year')+part('month').toUpperCase()+part('day');
 return availableMarkets().filter(m=>{const key=tickerGame(m);return aliases(a).some(x=>aliases(h).some(y=>key===dateKey+x+y||key===dateKey+y+x))});
}
function availableMarkets(){return state.markets.filter(leagueFor)}
function groupMarketGames(){const map=new Map();for(const m of availableMarkets()){const key=tickerGame(m);if(!map.has(key))map.set(key,[]);map.get(key).push(m)}return map}
function selection(){
 const ev=selectedEvent();if(ev)return {event:ev,title:shortName(ev)};
 const m=selectedMarkets()[0];return {event:null,title:(m?.event||selectedMarketKey()||'Choose a game').split(':')[0]};
}
function logo(t){const src=t?.team?.logo;return src&&/^https:\/\//.test(src)?'<img class="lh-v2-teamlogo" src="'+esc(src)+'" alt="" loading="lazy">':'<span class="lh-v2-placeholder">🏈</span>'}
function hero(){
 const {event,title}=selection();if(!event&&!state.selected)return '<article class="lh-v2-panel"><h2>No games available</h2><p>No scoreboard games or matching exchange markets were returned. Try Refresh or another sport.</p></article>';if(!event)return '<article class="lh-v2-hero"><div class="lh-v2-league">'+esc(state.sport.toUpperCase())+'</div><h2>'+esc(title)+'</h2><p>Exchange activity available. No matching ESPN scoreboard game verified for this selection.</p></article>';
 const {away,home}=participants(event),status=event.status?.type?.detail||event.status?.type?.description||'Status unavailable';
 return '<article class="lh-v2-hero"><div class="lh-v2-league">'+esc(state.sport.toUpperCase())+' · '+esc(status)+'</div><div class="lh-v2-match"><div class="lh-v2-team">'+logo(away)+'<strong>'+esc(away?.team?.abbreviation||'Away')+'</strong><small>'+esc(away?.team?.shortDisplayName||away?.team?.displayName||'')+'</small><b>'+esc(away?.score??'—')+'</b></div><div class="lh-v2-mid"><strong>@</strong><small>'+esc(event.date?new Date(event.date).toLocaleString():'Time unavailable')+'</small></div><div class="lh-v2-team">'+logo(home)+'<strong>'+esc(home?.team?.abbreviation||'Home')+'</strong><small>'+esc(home?.team?.shortDisplayName||home?.team?.displayName||'')+'</small><b>'+esc(home?.score??'—')+'</b></div></div><div class="lh-v2-credit">ESPN scoreboard · fetched '+esc(state.scoreLoaded?new Date(state.scoreLoaded).toLocaleTimeString():'not yet')+'</div></article>';
}
function marketTabs(){return '<div class="lh-v2-market-tabs" role="group" aria-label="Market category">'+Object.entries(marketLabel).map(([key,label])=>'<button type="button" data-lh-market="'+key+'" aria-pressed="'+(state.market===key)+'">'+esc(key==='winner'?'Moneyline':key==='spread'?'Spread':key==='total'?'Total':key==='team'?'Team total':key==='half'?'1st half':'Props')+'</button>').join('')+'</div>'}
function relevantSeries(m){const ser=String(m.series||'');return state.market==='winner'?(ser.includes('GAME')):state.market==='spread'?(ser.includes('SPREAD')):state.market==='total'?(ser.includes('TOTAL')):false}
function tradesForMarkets(ms){return ms.flatMap(m=>(m.trades||[]).map(t=>({t,m}))).filter(x=>Number.isFinite(Number(x.t.premium_usd))&&Number(x.t.premium_usd)>=0)}
function spark(ms){
 const candidates=ms.map(m=>({m,items:(m.trades||[]).filter(t=>Date.parse(t.time)&&Number(t.contracts)>0&&Number.isFinite(Number(t.premium_usd))).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time))})).sort((a,b)=>b.items.length-a.items.length);
 const best=candidates[0];
 if(!best||best.items.length<2)return '<div class="lh-v2-nochart">Not enough recorded trades to show price movement. No trend inferred.</div>';
 const items=best.items;
 const timeLabel=t=>new Date(t).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 const pct=t=>{const count=Number(t.contracts),premium=Number(t.premium_usd),p=premium/count;return Math.min(100,Math.max(0,(t.side==='no'?1-p:p)*100))};
 const start=Date.parse(items[0].time),end=Date.parse(items[items.length-1].time);
 const buckets=Array.from({length:18},()=>({premium:0,weighted:0,contracts:0,trades:0}));
 for(const t of items){
  const ts=Date.parse(t.time),i=Math.min(17,Math.floor(18*(ts-start)/Math.max(1,end-start+1)));
  const c=Number(t.contracts);buckets[i].premium+=Number(t.premium_usd);
  buckets[i].weighted+=pct(t)*c;buckets[i].contracts+=c;buckets[i].trades++;
 }
 const active=buckets.map((d,i)=>({...d,i,price:d.contracts?d.weighted/d.contracts:null})).filter(x=>x.trades);
 if(active.length<2)return '<div class="lh-v2-nochart">All sampled transactions fall in one interval. Not enough timed observations to show a price trend.</div>';
 const x=i=>54+i*35,y=p=>174-(p*1.35);
 const points=active.map(d=>x(d.i).toFixed(1)+','+y(d.price).toFixed(1)).join(' ');
 const dots=active.map(d=>'<circle cx="'+x(d.i)+'" cy="'+y(d.price).toFixed(1)+'" r="4" fill="#40d7ff"><title>'+esc('Bucket '+(d.i+1)+': '+d.price.toFixed(1)+'% implied YES price from sampled trades')+'</title></circle>').join('');
 const grid=[0,25,50,75,100].map(v=>'<line x1="52" y1="'+y(v)+'" x2="655" y2="'+y(v)+'" stroke="#30516a" stroke-dasharray="3 5"/><text x="44" y="'+(y(v)+4)+'" text-anchor="end" fill="#afcde2" font-size="16">'+v+'%</text>').join('');
 const max=Math.max(1,...buckets.map(d=>d.premium));
 const bars=buckets.map((d,i)=>'<rect x="'+(54+i*35)+'" y="'+(147-118*d.premium/max).toFixed(1)+'" width="24" height="'+(118*d.premium/max).toFixed(1)+'" rx="3" fill="#39acfa"><title>'+esc('Bucket '+(i+1)+': $'+d.premium.toFixed(2)+' sampled premium from '+d.trades+' trades')+'</title></rect>').join('');
 const first=active[0].price,last=active[active.length-1].price,delta=last-first;
 return '<div class="lh-v2-chart-explain"><strong>'+esc(best.m.market||best.m.ticker)+'</strong><small>Most-sampled market only · '+items.length+' trades · sampled Kalshi transaction-derived YES prices, not sportsbook lines</small></div>'+
 '<div class="lh-v2-chart-explain"><strong>First interval average '+first.toFixed(1)+'% → last interval average '+last.toFixed(1)+'%</strong><small>Change '+(delta>=0?'+':'')+delta.toFixed(1)+' percentage points · not a forecast</small></div>'+
 '<h3 class="lh-v2-chart-title">Implied YES price over sampled time (0–100%)</h3>'+
 '<svg class="lh-v2-line" viewBox="0 0 700 208" role="img" aria-label="Sampled implied YES price by time, with a zero to 100 percent vertical axis">'+grid+'<polyline points="'+points+'" fill="none" stroke="#40d7ff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>'+dots+'<text x="54" y="200" fill="#afcde2" font-size="16">'+esc(timeLabel(start))+'</text><text x="655" y="200" text-anchor="end" fill="#afcde2" font-size="16">'+esc(timeLabel(end))+'</text></svg>'+
 '<h3 class="lh-v2-chart-title">Sampled premium per time interval ($; NOT total handle)</h3>'+
 '<svg class="lh-v2-line" viewBox="0 0 700 182" role="img" aria-label="Observed Kalshi trade premium in 18 chronological intervals in dollars"><line x1="52" x2="655" y1="147" y2="147" stroke="#afcde2"/><text x="50" y="20" text-anchor="end" fill="#afcde2" font-size="16">'+esc(money(max))+'</text><text x="50" y="148" text-anchor="end" fill="#afcde2" font-size="16">$0</text>'+bars+'<text x="54" y="174" fill="#afcde2" font-size="16">'+esc(timeLabel(start))+'</text><text x="655" y="174" text-anchor="end" fill="#afcde2" font-size="16">'+esc(timeLabel(end))+'</text></svg>'+
 '<p class="lh-v2-note">Exchange YES price is calculated from observed contract premium divided by contracts (NO-side trades are inverted). Samples are incomplete; gaps are not zero volume. Each chart describes only the named market, not all sportsbook bets.</p>';
}
function tradeStats(ms){
 const t=tradesForMarkets(ms),sum=t.reduce((n,x)=>n+Number(x.t.premium_usd),0);
 return '<div class="lh-v2-stats"><div><small>Trades</small><strong>'+t.length.toLocaleString()+'</strong></div><div><small>Sampled premium</small><strong>'+money(sum)+'</strong></div><div><small>Contracts traded</small><strong>'+t.reduce((n,x)=>n+Number(x.t.contracts||0),0).toLocaleString()+'</strong></div></div>';
}
function priceBoard(){
 const ev=selectedEvent(),quote=ev?.competitions?.[0]?.odds?.[0],pair=participants(ev);
 const h=quote?.moneyline?.home?.close?.odds??quote?.homeTeamOdds?.moneyLine,a=quote?.moneyline?.away?.close?.odds??quote?.awayTeamOdds?.moneyLine;
 const line=(market,side)=>{const q=quote?.[market]?.[side]?.close;return q?[q.line,q.odds].filter(x=>x!=null).join(' @ '):null};
 const open=quote?.moneyline;const opening=open?.home?.open?.odds!=null||open?.away?.open?.odds!=null?'Source open: '+formatOdds(open?.away?.open?.odds)+' / '+formatOdds(open?.home?.open?.odds):'Opening quotes not supplied';
 const total=quote?.overUnder;const present=total!==undefined&&total!==null&&total!=='';
 const cards=[
 ['Moneyline',h!=null||a!=null?esc(pair.away?.team?.abbreviation||'Away')+' '+formatOdds(a)+' / '+esc(pair.home?.team?.abbreviation||'Home')+' '+formatOdds(h):'Not published',opening],
 ['Spread / run line',line('pointSpread','away')||line('pointSpread','home')?(pair.away?.team?.abbreviation||'Away')+' '+(line('pointSpread','away')||'Unavailable')+' / '+(pair.home?.team?.abbreviation||'Home')+' '+(line('pointSpread','home')||'Unavailable'):quote?.details||'Not published','ESPN close/latest field; not guaranteed live'],
 ['Game over / under',line('total','over')||line('total','under')?'Over '+(line('total','over')||'Unavailable')+' / Under '+(line('total','under')||'Unavailable'):present?'O/U '+total:'Not published','ESPN close/latest field; source observation'],
 ['Team totals','Not published','Over / Under for each team'],
 ['First half','Not published','Spread and points'],
 ['Player props','Not published','Player lines and prices']
 ];
 return '<article class="lh-v2-panel"><div class="lh-v2-title"><h2>Market board</h2><small>'+esc(quote?.provider?.name||'No verified book quote')+'</small></div><div class="lh-v2-odds">'+cards.map(c=>'<div class="lh-v2-odd"><small>'+esc(c[0])+'</small><strong>'+esc(c[1])+'</strong><span>'+esc(c[2])+'</span></div>').join('')+'</div><p class="lh-v2-note">ESPN published odds when included; retrieved '+esc(state.scoreLoaded?new Date(state.scoreLoaded).toLocaleTimeString():'not yet')+'. Prices and availability are not guaranteed current.</p></article>';
}
function tradePanel(){
 const all=selectedMarkets(),subset=all.filter(relevantSeries);
 const stamps=all.map(m=>Date.parse(m.collected_at||state.collected)).filter(Number.isFinite);
 const collected=stamps.length?new Date(Math.min(...stamps)):null,stale=!collected||Date.now()-collected.getTime()>1800000;
 if(['team','half','props'].includes(state.market)){
  return '<article class="lh-v2-panel lh-v2-unavailable"><h2>'+esc(marketLabel[state.market])+'</h2><p>No verified feed is configured for this market. Prices, volume and betting splits are unavailable; this is not zero activity.</p><p>Use Moneyline, Spread or Total for the separately labeled sportsbook quotes and exchange observations that are available.</p></article>';
 }

 return '<article class="lh-v2-panel"><div class="lh-v2-title"><h2>'+esc(marketLabel[state.market])+'</h2><small>'+(stale?'STALE SNAPSHOT':'Kalshi public trades')+'</small></div>'+(subset.length?tradeStats(subset)+'<h3 class="lh-v2-chart-title">Recorded trade premium by time interval</h3>'+spark(subset):'<div class="lh-v2-nochart">No recorded '+esc(marketLabel[state.market].toLowerCase())+' contracts for this matchup in the current sample.</div>')+'<p class="lh-v2-note">Snapshot: '+esc(collected?collected.toLocaleString():'Unavailable')+(stale?' · STALE':'')+'. '+esc(state.tradeError||'Sampled Kalshi exchange premium, not sportsbook betting handle. Spread contracts are winning margins and totals are individual thresholds.')+'</p></article>';
}
function analysis(){
 const ms=selectedMarkets(),num=tradesForMarkets(ms).length,quote=selectedEvent()?.competitions?.[0]?.odds?.[0];
 let text='For this matchup: '+num+' sampled exchange transactions'+(quote?' and a published game quote.':'. No published sportsbook quote for this game.');
 text+=' Without verified team totals, current injury status, market price history and betting splits, no priced edge can be confirmed.';
 return '<article class="lh-v2-insight"><h2>✦ MARIA INSIGHT</h2><p>'+esc(text)+'</p><small>Evidence based · No guaranteed pick</small></article>';
}
function statsPanel(){
 const report=state.report;if(report?.error)return '<article class="lh-v2-panel"><h2>Team comparison</h2><p>Report unavailable: '+esc(report.error)+'. Use Refresh to retry.</p></article>';if(!report&&!selectedEvent())return '<article class="lh-v2-panel"><h2>Team comparison</h2><p>Select a verified scoreboard game to view statistics.</p></article>';if(!report)return '<article class="lh-v2-panel"><h2>Team comparison</h2><p>Loading verified team and player statistics…</p></article>';
 const teams=report.boxscore?.teams||[];
 let bars='';
 if(teams.length===2){for(const a of (teams[0].statistics||[]).slice(0,20)){
  const b=(teams[1].statistics||[]).find(x=>x.name===a.name||x.label===a.label);
  const x=Number(a.displayValue),y=Number(b?.displayValue);
  if(!b||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x+y===0)continue;
  bars+='<div class="lh-v2-compare-row"><div class="lh-v2-compare-label">'+esc(teams[0].team?.abbreviation||'Team 1')+' / '+esc(teams[1].team?.abbreviation||'Team 2')+' · '+esc(a.label||a.name)+' <small>'+esc(a.displayValue)+' / '+esc(b.displayValue)+'</small></div><div class="lh-v2-compare-track"><span style="width:'+(100*x/(x+y)).toFixed(1)+'%"></span><i style="width:'+(100*y/(x+y)).toFixed(1)+'%"></i></div></div>';
 }}
 const leaders=(report.leaders||[]).flatMap(x=>(x.leaders||[]).slice(0,3).map(g=>{const p=g.leaders?.[0];return p?'<div class="lh-v2-leader"><small>'+esc(g.displayName||g.name)+'</small><strong>'+esc(p.athlete?.displayName||'Unknown')+'</strong><span>'+esc(p.displayValue||'—')+'</span></div>':''})).filter(Boolean).slice(0,6).join('');
 return '<article class="lh-v2-panel"><h2>Team comparison</h2>'+(bars||'<p>ESPN did not supply comparable numeric team statistics for this event.</p>')+'</article><article class="lh-v2-panel"><h2>Player leaders</h2><div class="lh-v2-leaders">'+(leaders||'<p>No verified player leaders in the report.</p>')+'</div></article>';
}
function injuryPanel(){
 const groups=state.report?.injuries||[];
 const rows=groups.flatMap(g=>(g.injuries||[]).map(i=>'<li>'+esc(g.team?.displayName||'')+' · '+esc(i.athlete?.displayName||'Player')+' · '+esc(i.status||i.type?.description||'Status not supplied')+'</li>'));
 return '<article class="lh-v2-panel"><h2>Injuries & availability</h2>'+(rows.length?'<ul>'+rows.join('')+'</ul><p>ESPN game report; not a confirmed active roster.</p>':'<p>No verified injury list was supplied for this game. This does not mean every player is healthy or active.</p>')+'</article>';
}
function scorePanel(){
 const ev=selectedEvent();const eventText=ev?'Report: '+shortName(ev):'Choose a scoreboard game';
 return hero()+'<div class="lh-v2-context">'+esc(eventText)+'</div>'+statsPanel()+injuryPanel()+priceBoard()+analysis();
}
function renderPicker(){
 const el=$('lh-v2-event'),prior=state.selected;el.replaceChildren();
 for(const ev of state.events){const opt=document.createElement('option');opt.value='e:'+ev.id;opt.textContent=shortName(ev)+' · '+(ev.status?.type?.shortDetail||ev.status?.type?.description||'Scheduled');el.append(opt)}
 const group=groupMarketGames();
 for(const [key,ms] of group){if(state.events.some(e=>marketsForEvent(e).some(m=>tickerGame(m)===key)))continue;const opt=document.createElement('option');opt.value='m:'+key;opt.textContent=(ms[0].event||key).split(':')[0]+' · Exchange only';el.append(opt)}
 if([...el.options].some(o=>o.value===prior))state.selected=prior;
 else state.selected=el.options[0]?.value||'';
 el.value=state.selected;
}
function render(){
 state.tab=document.body.dataset.tab||'games';
 $('lh-v2-page-title').textContent=state.tab==='money'?'Trades':state.tab==='scores'?'Scores':state.tab==='more'?'More':'Games';
 $('lh-v2-status').textContent=(state.scoreError?'ESPN: '+state.scoreError+' · ':'')+(state.tradeError?'Trades: '+state.tradeError:'');
 document.querySelectorAll('[data-lh-sport]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lhSport===state.sport)));
 $('lh-v2-games').innerHTML=hero()+marketTabs()+quoteMovement()+tradePanel()+priceBoard()+statsPanel()+analysis();
 $('lh-v2-trades').innerHTML=hero()+marketTabs()+quoteMovement()+tradePanel()+analysis();
 $('lh-v2-scores').innerHTML=scorePanel();
 const diagnostics=$('lh-v2-source-status');if(diagnostics)diagnostics.innerHTML='<p>Scoreboard: '+esc(state.scoreLoaded?new Date(state.scoreLoaded).toLocaleString():'Unavailable')+'</p><p>Exchange snapshot: '+esc(state.collected?new Date(state.collected).toLocaleString():'Unavailable')+'</p><p>Browser refresh: every minute while visible. Scheduled collection: requested every 10 minutes; GitHub may delay runs.</p>'+((state.collectorErrors.length||state.scoreSnapshot?.errors?.length)?'<ul>'+[...state.collectorErrors,...(state.scoreSnapshot?.errors||[])].map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>':'<p>No errors reported by the loaded collector snapshots.</p>');
}
async function loadTrade(){
 try{const res=await fetch('./public-trades.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error('HTTP '+res.status);const j=await res.json();state.markets=j.markets||[];state.collected=j.collected_at;state.collectorErrors=j.errors||[];state.tradeError=j.errors?.length?'Collector reports '+j.errors.length+' errors':''}catch(e){state.tradeError=e.message}
}
async function loadScores(force=false,token=generation){
 const sport=state.sport;
 if(!force&&state.scoresCache[sport]&&Date.now()-state.scoresCache[sport].time<60000){const c=state.scoresCache[sport];state.events=c.events;state.scoreLoaded=c.time;state.scoreError=c.warning||'';return}
 try{
  const res=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+sportPaths[sport]+'/scoreboard',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw Error('HTTP '+res.status);
  const j=await res.json();if(token!==generation)return;
  state.events=j.events||[];state.scoreLoaded=Date.now();state.scoreError='';
 }catch(e){
  if(token!==generation)return;
  const saved=state.scoreSnapshot?.sports?.[sport];
  state.events=saved?.events||[];state.scoreLoaded=saved?.collected_at?Date.parse(saved.collected_at):null;
  state.scoreError=saved?'Direct feed unavailable; showing scheduled snapshot from '+new Date(state.scoreLoaded).toLocaleString():e.message;
 }
 if(token!==generation)return;
 state.scoresCache[sport]={events:state.events,time:state.scoreLoaded||0,warning:state.scoreError};
}
async function loadHistory(){
 try{const r=await fetch('./scoreboards.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)return;const j=await r.json();state.scoreSnapshot=j;state.quoteHistory=j.history||{}}catch(e){/* Direct ESPN remains usable. */}
}
function quoteMovement(){
 const ev=selectedEvent();if(!ev)return '';
 const provider=ev.competitions?.[0]?.odds?.[0]?.provider?.name;
 const keys=Object.keys(state.quoteHistory).filter(k=>k.startsWith(state.sport+':'+ev.id+':'));
 const key=keys.find(k=>k===state.sport+':'+ev.id+':'+provider)||keys[0];
 const points=key?state.quoteHistory[key]:[];
 const fields={winner:[['away_moneyline','Away moneyline'],['home_moneyline','Home moneyline']],spread:[['home_spread_line','Home spread / run line']],total:[['total','Game total']]};
 if(!fields[state.market])return '';
 let html='<article class="lh-v2-panel"><h2>Recorded sportsbook quote movement</h2><p>Scheduled ESPN observations · '+esc(key?.split(':').slice(2).join(':')||'no provider history')+'. First observed quote is not necessarily the opening line.</p>';
 for(const [field,label] of fields[state.market]){
 const rows=points.filter(p=>p[field]!=null&&p[field]!==''&&Number.isFinite(Number(p[field]))&&Number.isFinite(Date.parse(p.time)));
 if(rows.length<2){html+='<p>'+esc(label)+': Waiting for two verified observations. No movement inferred.</p>';continue}
 const vals=rows.map(p=>Number(p[field]));let lo=Math.min(...vals),hi=Math.max(...vals);const unchanged=lo===hi;if(unchanged){const pad=Math.max(1,Math.abs(lo)*0.02);lo-=pad;hi+=pad}const span=hi-lo,start=Date.parse(rows[0].time),end=Date.parse(rows.at(-1).time);
 const coordinates=rows.map(p=>(50+600*(Date.parse(p.time)-start)/Math.max(1,end-start))+','+(130-100*(Number(p[field])-lo)/span)).join(' ');
 html+='<h3>'+esc(label)+' · '+esc(vals[0])+' → '+esc(vals.at(-1))+'</h3><p>'+rows.length+' observations'+(unchanged?' · No change observed.':'.')+'</p><svg class="lh-v2-line" viewBox="0 0 700 175" role="img" aria-label="'+esc(label)+' recorded quotes over time"><text x="5" y="30" fill="#afcde2">'+esc(Number(hi.toFixed(2)))+'</text><text x="5" y="130" fill="#afcde2">'+esc(Number(lo.toFixed(2)))+'</text><polyline points="'+coordinates+'" fill="none" stroke="#40d7ff" stroke-width="3"/><text x="50" y="165" fill="#afcde2" font-size="16">'+esc(new Date(start).toLocaleString())+'</text><text x="650" y="165" text-anchor="end" fill="#afcde2" font-size="16">'+esc(new Date(end).toLocaleString())+'</text></svg>';
 }
 return html+'<p class="lh-v2-note">Observations may be delayed. Gaps are not continuous live tracking; changes do not prove large wagers.</p></article>';
}
async function loadReport(){
 const token=generation,sport=state.sport,selectionKey=state.selected;
 const ev=selectedEvent();if(!ev){state.report=null;state.reportEvent='';return}
 if(state.reportEvent===ev.id)return;
 state.report=null;state.reportEvent='';
 if(state.tab==='scores')render();
 try{const res=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+sportPaths[sport]+'/summary?event='+encodeURIComponent(ev.id),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error('HTTP '+res.status);const report=await res.json();if(token!==generation||selectionKey!==state.selected)return;state.report=report;state.reportEvent=ev.id}catch(e){if(token!==generation||selectionKey!==state.selected)return;state.report={error:e.message}}render();
}
async function refresh(force=false){
 const token=++generation;
 $('lh-v2-status').textContent='Refreshing verified sources…';
 await loadHistory();if(token!==generation)return;await Promise.all([loadScores(force,token),loadTrade()]);if(token!==generation)return;renderPicker();render();
 if(force)state.reportEvent='';if(selectedEvent())await loadReport();
}
root.addEventListener('click',async e=>{
 const sport=e.target.closest('[data-lh-sport]');if(sport){state.sport=sport.dataset.lhSport;state.selected='';state.report=null;state.reportEvent='';await refresh(false);return}
 const market=e.target.closest('[data-lh-market]');if(market){state.market=market.dataset.lhMarket;render();return}
});
$('lh-v2-event').addEventListener('change',async e=>{state.selected=e.target.value;state.report=null;state.reportEvent='';render();if(selectedEvent())await loadReport()});
$('lh-v2-refresh').addEventListener('click',()=>refresh(true));
document.querySelectorAll('.mobile-bottom button').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.screen;document.body.dataset.tab=state.tab;document.querySelectorAll('.mobile-bottom button').forEach(x=>{x.setAttribute('aria-pressed',String(x===b));if(x===b)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});render();if(state.tab==='scores')loadReport()}));
refresh(false);
setInterval(()=>{if(document.visibilityState==='visible')refresh(true)},60000);
})();