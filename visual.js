(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number.isFinite(Number(v))?'$'+Math.round(Number(v)).toLocaleString():'—';
const formatOdds=v=>v==null||v===''?'Unavailable':(Number(v)>0?'+':'')+String(v);
const sportPaths={nfl:'football/nfl',college:'football/college-football',nba:'basketball/nba',mlb:'baseball/mlb'};
const state={sport:'nfl',selected:'',market:'winner',events:[],markets:[],collected:null,scoreLoaded:null,tradeError:'',scoreError:'',report:null,reportEvent:'',scoresCache:{},tab:'games'};
const root=document.createElement('section');root.id='lh-v2';root.className='lh-v2-root';
root.innerHTML='<div class="lh-v2-head"><div><span class="lh-v2-eyebrow">LAKE HOUSE GAME CENTER</span><h1 id="lh-v2-page-title">Games</h1></div><button id="lh-v2-refresh" type="button" aria-label="Refresh current sports data">↻ Refresh</button></div><div class="lh-v2-sports" role="group" aria-label="Sports"><button data-lh-sport="nfl" aria-pressed="true">NFL</button><button data-lh-sport="college">College</button><button data-lh-sport="nba">NBA</button><button data-lh-sport="mlb">MLB</button></div><label class="lh-v2-selector-label" for="lh-v2-event">Selected matchup</label><select id="lh-v2-event" aria-label="Selected matchup"><option>Loading games…</option></select><div id="lh-v2-status" class="lh-v2-status" role="status"></div><div id="lh-v2-games" class="lh-v2-screen"></div><div id="lh-v2-trades" class="lh-v2-screen"></div><div id="lh-v2-scores" class="lh-v2-screen"></div><div id="lh-v2-more" class="lh-v2-screen"><article class="lh-v2-panel"><h2>Sources and limitations</h2><p>ESPN supplies public game scores and selected statistics and published quotes. Kalshi supplies public, sampled exchange trades. These are not a live feed of DraftKings wager amounts or private sportsbook transactions.</p><p>Unavailable odds, team totals, player props, injuries, and betting percentages are never estimated.</p></article></div>';
const insertion=$('lhVisualHero')||$('gameMoney')||$('scoreboardSection');if(!insertion)return;
insertion.parentNode.insertBefore(root,insertion);
document.body.classList.add('lh-v2');
const leagueTicker={nfl:['KXNFL'],college:['KXCFB'],nba:['KXNBA'],mlb:['KXMLB']};
const marketLabel={winner:'Winner / moneyline',spread:'Alternative winning margins (not sportsbook spread)',total:'Exchange total thresholds (not O/U odds)',team:'Team total O/U',half:'First-half markets',props:'Player props'};
function leagueFor(m){return (leagueTicker[state.sport]||[]).some(prefix=>String(m.series||'').startsWith(prefix))}
function shortName(event){return event?.shortName||event?.name||event?.id||'Matchup'}
function participants(event){const teams=event?.competitions?.[0]?.competitors||[];return {away:teams.find(t=>t.homeAway==='away')||teams[0],home:teams.find(t=>t.homeAway==='home')||teams[1]}}
function selectedEvent(){return state.events.find(e=>'e:'+e.id===state.selected)||null}
function selectedMarketKey(){return state.selected.startsWith('m:')?state.selected.slice(2):''}
function tickerGame(m){return String(m.ticker||'').split('-')[1]||''}
function selectedMarkets(){
 const key=selectedMarketKey();if(key)return state.markets.filter(m=>tickerGame(m)===key);
 const ev=selectedEvent();if(!ev)return [];
 const pair=participants(ev),a=pair.away?.team?.abbreviation||'',h=pair.home?.team?.abbreviation||'';
 const aliases=x=>x==='WSH'||x==='WAS'?['WSH','WAS']:x==='JAX'||x==='JAC'?['JAX','JAC']:x==='LV'?['LV','LVR']:x==='LAR'?['LAR','LA']: [x];
 return state.markets.filter(m=>{const key=tickerGame(m);return aliases(a).some(x=>key.includes(x))&&aliases(h).some(x=>key.includes(x))});
}
function availableMarkets(){return state.markets.filter(leagueFor)}
function groupMarketGames(){const map=new Map();for(const m of availableMarkets()){const key=tickerGame(m);if(!map.has(key))map.set(key,[]);map.get(key).push(m)}return map}
function selection(){
 const ev=selectedEvent();if(ev)return {event:ev,title:shortName(ev)};
 const m=selectedMarkets()[0];return {event:null,title:(m?.event||selectedMarketKey()||'Choose a game').split(':')[0]};
}
function logo(t){const src=t?.team?.logo;return src&&/^https:\/\//.test(src)?'<img class="lh-v2-teamlogo" src="'+esc(src)+'" alt="" loading="lazy">':'<span class="lh-v2-placeholder">🏈</span>'}
function hero(){
 const {event,title}=selection();if(!event)return '<article class="lh-v2-hero"><div class="lh-v2-league">'+esc(state.sport.toUpperCase())+'</div><h2>'+esc(title)+'</h2><p>Exchange activity available. No matching ESPN scoreboard game verified for this selection.</p></article>';
 const {away,home}=participants(event),status=event.status?.type?.detail||event.status?.type?.description||'Status unavailable';
 return '<article class="lh-v2-hero"><div class="lh-v2-league">'+esc(state.sport.toUpperCase())+' · '+esc(status)+'</div><div class="lh-v2-match"><div class="lh-v2-team">'+logo(away)+'<strong>'+esc(away?.team?.abbreviation||'Away')+'</strong><small>'+esc(away?.team?.shortDisplayName||away?.team?.displayName||'')+'</small><b>'+esc(away?.score??'—')+'</b></div><div class="lh-v2-mid"><strong>@</strong><small>'+esc(event.date?new Date(event.date).toLocaleString():'Time unavailable')+'</small></div><div class="lh-v2-team">'+logo(home)+'<strong>'+esc(home?.team?.abbreviation||'Home')+'</strong><small>'+esc(home?.team?.shortDisplayName||home?.team?.displayName||'')+'</small><b>'+esc(home?.score??'—')+'</b></div></div><div class="lh-v2-credit">ESPN scoreboard · fetched '+esc(state.scoreLoaded?new Date(state.scoreLoaded).toLocaleTimeString():'not yet')+'</div></article>';
}
function marketTabs(){return '<div class="lh-v2-market-tabs" role="group" aria-label="Market category">'+Object.entries(marketLabel).map(([key,label])=>'<button type="button" data-lh-market="'+key+'" aria-pressed="'+(state.market===key)+'">'+esc(key==='winner'?'Moneyline':key==='spread'?'Spread':key==='total'?'Total':key==='team'?'Team total':key==='half'?'1st half':'Props')+'</button>').join('')+'</div>'}
function relevantSeries(m){const ser=String(m.series||'');return state.market==='winner'?(ser.includes('GAME')):state.market==='spread'?(ser.includes('SPREAD')):state.market==='total'?(ser.includes('TOTAL')):false}
function tradesForMarkets(ms){return ms.flatMap(m=>(m.trades||[]).map(t=>({t,m}))).filter(x=>Number.isFinite(Number(x.t.premium_usd))&&Number(x.t.premium_usd)>=0)}
function spark(ms){
 const trades=tradesForMarkets(ms).filter(x=>Number.isFinite(Date.parse(x.t.time))).sort((a,b)=>Date.parse(a.t.time)-Date.parse(b.t.time));
 if(trades.length<2)return '<div class="lh-v2-nochart">Not enough recorded exchange trades to chart the observed intervals.</div>';
 const start=Date.parse(trades[0].t.time),end=Date.parse(trades[trades.length-1].t.time),buckets=Array.from({length:18},()=>0);
 for(const x of trades){const n=Math.min(17,Math.floor(18*(Date.parse(x.t.time)-start)/Math.max(1,end-start+1)));buckets[n]+=Number(x.t.premium_usd)}
 const top=Math.max(1,...buckets);
 const bars=buckets.map((v,i)=>'<rect x="'+(20+i*38)+'" y="'+(181-148*v/top).toFixed(1)+'" width="26" height="'+(148*v/top).toFixed(1)+'" rx="3" fill="#34baf5"></rect>').join('');
 return '<svg class="lh-v2-line" viewBox="0 0 720 204" role="img" aria-label="Observed exchange trade premium in 18 chronological time intervals"><path d="M18 181H706M18 106H706M18 33H706" stroke="#264c66" stroke-width="1" fill="none"/>'+bars+'</svg><div class="lh-v2-axis"><span>'+esc(new Date(start).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}))+'</span><span>'+esc(new Date(end).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}))+'</span></div>';
}
function tradeStats(ms){
 const t=tradesForMarkets(ms),sum=t.reduce((n,x)=>n+Number(x.t.premium_usd),0);
 return '<div class="lh-v2-stats"><div><small>Trades</small><strong>'+t.length.toLocaleString()+'</strong></div><div><small>Sampled premium</small><strong>'+money(sum)+'</strong></div><div><small>Contracts</small><strong>'+ms.length+'</strong></div></div>';
}
function priceBoard(){
 const ev=selectedEvent(),quote=ev?.competitions?.[0]?.odds?.[0],pair=participants(ev);
 const h=quote?.homeTeamOdds?.moneyLine,a=quote?.awayTeamOdds?.moneyLine;
 const total=quote?.overUnder;const present=total!==undefined&&total!==null&&total!=='';
 const cards=[
 ['Moneyline',h!=null||a!=null?esc(pair.away?.team?.abbreviation||'Away')+' '+formatOdds(a)+' / '+esc(pair.home?.team?.abbreviation||'Home')+' '+formatOdds(h):'Not published','Two-sided price, when supplied'],
 ['Spread',quote?.details||'Not published','Both side prices unverified'],
 ['Game over / under',present?'O/U '+esc(total):'Not published','Over and Under prices unverified'],
 ['Team totals','Not published','Over / Under for each team'],
 ['First half','Not published','Spread and points'],
 ['Player props','Not published','Player lines and prices']
 ];
 return '<article class="lh-v2-panel"><div class="lh-v2-title"><h2>Market board</h2><small>'+esc(quote?.provider?.name||'No verified book quote')+'</small></div><div class="lh-v2-odds">'+cards.map(c=>'<div class="lh-v2-odd"><small>'+esc(c[0])+'</small><strong>'+esc(c[1])+'</strong><span>'+esc(c[2])+'</span></div>').join('')+'</div><p class="lh-v2-note">ESPN published odds when included; retrieved '+esc(state.scoreLoaded?new Date(state.scoreLoaded).toLocaleTimeString():'not yet')+'. Prices and availability are not guaranteed current.</p></article>';
}
function tradePanel(){
 const all=selectedMarkets(),subset=all.filter(relevantSeries);
 const collected=state.collected?new Date(state.collected):null,stale=!collected||Date.now()-collected.getTime()>1800000;
 if(['team','half','props'].includes(state.market)){
  const samples=tradesForMarkets(all),sum=samples.reduce((n,x)=>n+Number(x.t.premium_usd),0);
  const available=all.filter(m=>(m.trades||[]).length).map(m=>esc(m.market||m.ticker)).slice(0,4).join(' · ');
  return '<article class="lh-v2-panel lh-v2-unavailable"><div class="lh-v2-title"><h2>'+esc(marketLabel[state.market])+'</h2><small>BOOK ODDS NOT CONNECTED</small></div>'+
   '<p>No verified '+esc(marketLabel[state.market].toLowerCase())+' prices or trades are available. This is not a zero betting volume result.</p>'+
   '<h3 class="lh-v2-chart-title">Other observed exchange activity for this matchup</h3>'+
   (samples.length?tradeStats(all)+'<p>'+esc(available||'Exchange transactions')+'</p>'+spark(all):'<div class="lh-v2-nochart">No matching exchange transactions in the published snapshot.</div>')+
   '<p class="lh-v2-note">Snapshot: '+esc(collected?collected.toLocaleString():'Unavailable')+(stale?' · STALE':'')+'. The '+samples.length+' trades and '+money(sum)+' are sampled Kalshi contract premiums across other markets, NOT team-total action, sportsbook handle or DraftKings/FanDuel bets.</p></article>';
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
 const report=state.report;if(!report)return '<article class="lh-v2-panel"><h2>Team comparison</h2><p>Loading verified team and player statistics…</p></article>';
 const teams=report.boxscore?.teams||[];
 let bars='';
 if(teams.length===2){for(const a of (teams[0].statistics||[]).slice(0,20)){
  const b=(teams[1].statistics||[]).find(x=>x.name===a.name||x.label===a.label);
  const x=Number(a.displayValue),y=Number(b?.displayValue);
  if(!b||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x+y===0)continue;
  bars+='<div class="lh-v2-compare-row"><div class="lh-v2-compare-label">'+esc(a.label||a.name)+' <small>'+esc(a.displayValue)+' / '+esc(b.displayValue)+'</small></div><div class="lh-v2-compare-track"><span style="width:'+(100*x/(x+y)).toFixed(1)+'%"></span><i style="width:'+(100*y/(x+y)).toFixed(1)+'%"></i></div></div>';
 }}
 const leaders=(report.leaders||[]).flatMap(x=>(x.leaders||[]).slice(0,3).map(g=>{const p=g.leaders?.[0];return p?'<div class="lh-v2-leader"><small>'+esc(g.displayName||g.name)+'</small><strong>'+esc(p.athlete?.displayName||'Unknown')+'</strong><span>'+esc(p.displayValue||'—')+'</span></div>':''})).filter(Boolean).slice(0,6).join('');
 return '<article class="lh-v2-panel"><h2>Team comparison</h2>'+(bars||'<p>ESPN did not supply comparable numeric team statistics for this event.</p>')+'</article><article class="lh-v2-panel"><h2>Player leaders</h2><div class="lh-v2-leaders">'+(leaders||'<p>No verified player leaders in the report.</p>')+'</div></article>';
}
function scorePanel(){
 const ev=selectedEvent();const eventText=ev?'Report: '+shortName(ev):'Choose a scoreboard game';
 return hero()+'<div class="lh-v2-context">'+esc(eventText)+'</div>'+statsPanel()+'<article class="lh-v2-panel"><h2>Injuries & availability</h2><p>No independently verified injury/active list included in this dashboard. Check official game status before making decisions.</p></article>'+priceBoard()+analysis();
}
function renderPicker(){
 const el=$('lh-v2-event'),prior=state.selected;el.replaceChildren();
 for(const ev of state.events){const opt=document.createElement('option');opt.value='e:'+ev.id;opt.textContent=shortName(ev)+' · '+(ev.status?.type?.shortDetail||ev.status?.type?.description||'Scheduled');el.append(opt)}
 const group=groupMarketGames();
 for(const [key,ms] of group){if(state.events.some(e=>{const abbr=(e.competitions?.[0]?.competitors||[]).map(t=>t.team?.abbreviation||'');return abbr.every(a=>key.includes(a))}))continue;const opt=document.createElement('option');opt.value='m:'+key;opt.textContent=(ms[0].event||key).split(':')[0]+' · Exchange only';el.append(opt)}
 if([...el.options].some(o=>o.value===prior))state.selected=prior;
 else state.selected=el.options[0]?.value||'';
 el.value=state.selected;
}
function render(){
 state.tab=document.body.dataset.tab||'games';
 $('lh-v2-page-title').textContent=state.tab==='money'?'Trades':state.tab==='scores'?'Scores':state.tab==='more'?'More':'Games';
 $('lh-v2-status').textContent=(state.scoreError?'ESPN: '+state.scoreError+' · ':'')+(state.tradeError?'Trades: '+state.tradeError:'');
 document.querySelectorAll('[data-lh-sport]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lhSport===state.sport)));
 $('lh-v2-games').innerHTML=hero()+marketTabs()+tradePanel()+priceBoard()+statsPanel()+analysis();
 $('lh-v2-trades').innerHTML=hero()+marketTabs()+tradePanel()+analysis();
 $('lh-v2-scores').innerHTML=scorePanel();
}
async function loadTrade(){
 try{const res=await fetch('./public-trades.json?t='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);const j=await res.json();state.markets=j.markets||[];state.collected=j.collected_at;state.tradeError=j.errors?.length?'Collector reports '+j.errors.length+' errors':''}catch(e){state.tradeError=e.message}
}
async function loadScores(force=false){
 if(!force&&state.scoresCache[state.sport]){state.events=state.scoresCache[state.sport].events;state.scoreLoaded=state.scoresCache[state.sport].time;return}
 try{const res=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+sportPaths[state.sport]+'/scoreboard',{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);const j=await res.json();state.events=(j.events||[]).slice(0,40);state.scoreLoaded=Date.now();state.scoreError='';state.scoresCache[state.sport]={events:state.events,time:state.scoreLoaded}}catch(e){state.events=[];state.scoreError=e.message}
}
async function loadReport(){
 const ev=selectedEvent();if(!ev){state.report=null;state.reportEvent='';return}
 if(state.reportEvent===ev.id)return;
 state.report=null;state.reportEvent='';
 if(state.tab==='scores')render();
 try{const res=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+sportPaths[state.sport]+'/summary?event='+encodeURIComponent(ev.id),{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);state.report=await res.json();state.reportEvent=ev.id}catch(e){state.report=null}render();
}
async function refresh(force=false){
 $('lh-v2-status').textContent='Refreshing verified sources…';
 await Promise.all([loadScores(force),loadTrade()]);renderPicker();render();
 if(force)state.reportEvent='';if(selectedEvent())await loadReport();
}
root.addEventListener('click',async e=>{
 const sport=e.target.closest('[data-lh-sport]');if(sport){state.sport=sport.dataset.lhSport;state.selected='';state.report=null;state.reportEvent='';await refresh(false);return}
 const market=e.target.closest('[data-lh-market]');if(market){state.market=market.dataset.lhMarket;render();return}
});
$('lh-v2-event').addEventListener('change',async e=>{state.selected=e.target.value;state.report=null;state.reportEvent='';render();if((document.body.dataset.tab||'games')==='scores')await loadReport()});
$('lh-v2-refresh').addEventListener('click',()=>refresh(true));
document.querySelectorAll('.mobile-bottom button').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.screen;render();if(state.tab==='scores')loadReport()}));
refresh(false);
setInterval(()=>{if(document.visibilityState==='visible')refresh(true)},180000);
})();