(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v))?Number(v):null;
const money=v=>number(v)!==null?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(v)):'Unavailable';
const formatOdds=v=>v==null||v===''?'Unavailable':(Number(v)>0?'+':'')+String(v);
const sportPaths={nfl:'football/nfl',college:'football/college-football',nba:'basketball/nba',mlb:'baseball/mlb'};
let generation=0;
const state={sport:'nfl',selected:'',market:'winner',events:[],markets:[],collected:null,scoreLoaded:null,tradeError:'',collectorErrors:[],scoreError:'',report:null,reportEvent:'',scoresCache:{},quoteHistory:{},scoreSnapshot:null,historyError:'',reportLoaded:null,reportSource:'',reportError:'',provider:'',contract:'',sourceLoaded:0,splits:[],splitsError:'',splitsLoaded:0,splitsMeta:null,licensedOdds:[],licensedStatus:'not_configured',tab:'games'};
const root=document.createElement('section');root.id='lh-v2';root.className='lh-v2-root';
root.innerHTML='<div class="lh-v2-head"><div><span class="lh-v2-eyebrow">LAKE HOUSE GAME CENTER</span><h1 id="lh-v2-page-title">Games</h1></div><button id="lh-v2-refresh" type="button" aria-label="Refresh current sports data">↻ Refresh</button></div><div class="lh-v2-sports" role="group" aria-label="Sports"><button data-lh-sport="nfl" aria-pressed="true">NFL</button><button data-lh-sport="college">College Football</button><button data-lh-sport="nba">NBA</button><button data-lh-sport="mlb">MLB</button></div><label class="lh-v2-selector-label" for="lh-v2-event">Selected matchup</label><select id="lh-v2-event" aria-label="Selected matchup"><option>Loading games…</option></select><div id="lh-v2-status" class="lh-v2-status" role="status"></div><div id="lh-v2-games" class="lh-v2-screen"></div><div id="lh-v2-trades" class="lh-v2-screen"></div><div id="lh-v2-scores" class="lh-v2-screen"></div><div id="lh-v2-more" class="lh-v2-screen"><article class="lh-v2-panel"><h2>Sources and limitations</h2><div id="lh-v2-source-status"></div><p>ESPN supplies public game scores and selected statistics and published quotes. Kalshi supplies public, sampled exchange trades. These are not a live feed of DraftKings wager amounts or private sportsbook transactions.</p><p>Public exchange contracts are alternatives, not sportsbook quotes. Unavailable sportsbook prices and splits are never estimated.</p><p><a href="./verification.html" target="_blank" rel="noopener">Section-by-section acceptance report</a> · <a href="https://github.com/antonvkorotkov-hue/https-antonvkorotkov-hue.github.io-Lake-House-Phone-Locator-money-intelligence-/blob/main/PHASE2-SOURCES.md" target="_blank" rel="noopener">Independent game checks</a> · <a href="https://github.com/antonvkorotkov-hue/https-antonvkorotkov-hue.github.io-Lake-House-Phone-Locator-money-intelligence-/blob/main/SOURCE-AUDIT.md" target="_blank" rel="noopener">Source audit and coverage</a></p></article><div id="lh-v2-research"></div></div>';
const insertion=$('lhVisualHero')||$('gameMoney')||$('scoreboardSection');if(!insertion)return;
insertion.parentNode.insertBefore(root,insertion);
document.body.classList.add('lh-v2');
document.body.dataset.tab=document.body.dataset.tab||'games';
const leagueTicker={nfl:['KXNFL'],college:['KXNCAAF','KXCFB'],nba:['KXNBA'],mlb:['KXMLB']};
const marketLabel={winner:'Winner / moneyline',spread:'Alternative winning margins (not sportsbook spread)',total:'Exchange total thresholds (not O/U odds)',team:'Team total O/U',half:'First-half markets',props:'Player props'};
function leagueFor(m){return (leagueTicker[state.sport]||[]).some(prefix=>String(m.series||'').startsWith(prefix))}
function shortName(event){return event?.shortName||event?.name||event?.id||'Matchup'}
function participants(event){const teams=event?.competitions?.[0]?.competitors||[];return {away:teams.find(t=>t.homeAway==='away')||teams[0],home:teams.find(t=>t.homeAway==='home')||teams[1]}}
function selectedEvent(){return state.events.find(e=>'e:'+e.id===state.selected)||null}
function selectedMarketKey(){return state.selected.startsWith('m:')?state.selected.slice(2):''}
function tickerGame(m){return String(m.event_ticker||m.ticker||'').split('-')[1]||''}
function selectedMarkets(){
 const key=selectedMarketKey();if(key)return availableMarkets().filter(m=>tickerGame(m)===key);
 return marketsForEvent(selectedEvent());
}
function marketsForEvent(ev){
 if(!ev)return [];
 const pair=participants(ev),a=pair.away?.team?.abbreviation||'',h=pair.home?.team?.abbreviation||'';
 const leagueAliases={nba:{NY:['NY','NYK'],SA:['SA','SAS'],GS:['GS','GSW'],NO:['NO','NOP'],UTAH:['UTAH','UTA']},college:{MOST:['MOST','MOSU'],MTSU:['MTSU','MTU']}};
 const aliases=x=>leagueAliases[state.sport]?.[x]||(x==='WSH'||x==='WAS'?['WSH','WAS']:x==='JAX'||x==='JAC'?['JAX','JAC']:x==='LV'?['LV','LVR']:x==='LAR'?['LAR','LA']: [x]);
 const day=new Date(ev.date);if(!a||!h||!Number.isFinite(day.getTime()))return [];
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'2-digit',month:'short',day:'2-digit'}).formatToParts(day);
 const part=k=>parts.find(p=>p.type===k).value;const dateKey=part('year')+part('month').toUpperCase()+part('day');
 const sameDatePair=state.events.filter(e=>{const pair=participants(e);const teams=[pair.away?.team?.abbreviation,pair.home?.team?.abbreviation];if(!teams.includes(a)||!teams.includes(h))return false;const d=new Date(e.date);return Number.isFinite(d.getTime())&&new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)===new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(day)});
 if(sameDatePair.length!==1)return [];
 return availableMarkets().filter(m=>{const key=tickerGame(m);if(!key.startsWith(dateKey))return false;const tail=key.slice(dateKey.length);const timed=/^\d{4}(?=[A-Z])/.test(tail);if(timed&&sameDatePair.length!==1)return false;const pair=timed?tail.slice(4):tail;return aliases(a).some(x=>aliases(h).some(y=>pair===x+y||pair===y+x))});
}
function availableMarkets(){return state.markets.filter(leagueFor)}
function groupMarketGames(){const map=new Map();for(const m of availableMarkets()){const key=tickerGame(m);if(!map.has(key))map.set(key,[]);map.get(key).push(m)}return map}
function selection(){
 const ev=selectedEvent();if(ev)return {event:ev,title:shortName(ev)};
 const m=selectedMarkets()[0];return {event:null,title:(m?.event||selectedMarketKey()||'Choose a game').split(':')[0]};
}
function logo(t){const src=t?.team?.logo||t?.team?.logos?.[0]?.href;return src&&/^https:\/\//.test(src)?'<img class="lh-v2-teamlogo" src="'+esc(src)+'" alt="" loading="lazy">':'<span class="lh-v2-placeholder">'+(state.sport==='nba'?'🏀':state.sport==='mlb'?'⚾':'🏈')+'</span>'}
function independentPanel(){
 const ev=selectedEvent(),entry=ev&&state.scoreSnapshot?.independent?.[state.sport+':'+ev.id];if(!entry)return '';
 const checked=Date.parse(entry.checked_at),official=Date.parse(entry.official_start),espn=Date.parse(ev.date),age=Date.now()-checked,stale=entry.stale===true||!Number.isFinite(checked)||age<0||age>1800000||entry.espn_start&&Date.parse(entry.espn_start)!==Date.parse(ev.date);
 return '<article class="lh-v2-panel"><h2>Independent schedule cross-check</h2><p>'+esc(entry.status||'Unavailable')+(stale?' · STALE / invalid check time':'')+' · '+esc(entry.error||entry.reason||'Matchup checked against the official league schedule; this does not validate bookmaker prices or active lineups.')+'</p>'+(entry.official_start?'<p>Official league start: '+esc(Number.isFinite(official)?new Date(official).toLocaleString():'Unavailable / invalid source timestamp')+' · ESPN start: '+esc(Number.isFinite(espn)?new Date(espn).toLocaleString():'Unavailable')+'. '+(number(entry.start_difference_minutes)!==null?'Difference: '+esc(entry.start_difference_minutes)+' minutes.':'')+'</p>':'')+'<p>Checked '+esc(Number.isFinite(checked)?new Date(checked).toLocaleString():'time unavailable')+(String(entry.source||'').startsWith('https://')?' · <a href="'+esc(entry.source)+'" target="_blank" rel="noopener">Official source</a>':'')+'</p></article>';
}
function hero(){
 const {event,title}=selection();if(!event&&!state.selected)return '<article class="lh-v2-panel"><h2>No games available</h2><p>No scoreboard games or matching exchange markets were returned. Try Refresh or another sport.</p></article>';if(!event)return '<article class="lh-v2-hero"><div class="lh-v2-league">'+esc(state.sport.toUpperCase())+'</div><h2>'+esc(title)+'</h2><p>Exchange activity available. No matching ESPN scoreboard game verified for this selection.</p></article>';
 const {away,home}=participants(event),status=event.status?.type?.detail||event.status?.type?.description||'Status unavailable';
 return '<article class="lh-v2-hero"><div class="lh-v2-league">'+esc(state.sport.toUpperCase())+' · '+esc(status)+'</div><div class="lh-v2-match"><div class="lh-v2-team">'+logo(away)+'<strong>'+esc(away?.team?.abbreviation||'Away')+'</strong><small>'+esc(away?.team?.shortDisplayName||away?.team?.displayName||'')+'</small><b>'+esc(event.status?.type?.state==='pre'||event.status?.type?.description==='Scheduled'||event.status?.type?.detail==='Scheduled'?'—':away?.score??'—')+'</b></div><div class="lh-v2-mid"><strong>@</strong><small>'+esc(event.date?new Date(event.date).toLocaleString():'Time unavailable')+'</small></div><div class="lh-v2-team">'+logo(home)+'<strong>'+esc(home?.team?.abbreviation||'Home')+'</strong><small>'+esc(home?.team?.shortDisplayName||home?.team?.displayName||'')+'</small><b>'+esc(event.status?.type?.state==='pre'||event.status?.type?.description==='Scheduled'||event.status?.type?.detail==='Scheduled'?'—':home?.score??'—')+'</b></div></div><div class="lh-v2-credit">ESPN scoreboard · fetched '+esc(state.scoreLoaded?new Date(state.scoreLoaded).toLocaleTimeString():'not yet')+'</div></article>';
}
function marketTabs(){return '<div class="lh-v2-market-tabs" role="group" aria-label="Market category">'+Object.entries(marketLabel).map(([key,label])=>'<button type="button" data-lh-market="'+key+'" aria-pressed="'+(state.market===key)+'">'+esc(key==='winner'?'Moneyline':key==='spread'?'Spread':key==='total'?'Total':key==='team'?'Team total':key==='half'?(state.sport==='mlb'?'First 5':'1st half'):'Props')+'</button>').join('')+'</div>'}
function category(m){if(m.category)return m.category;const ser=String(m.series||'');return ser.includes('TEAMTOTAL')?'team':/1H|HALF/.test(ser)?'half':ser.endsWith('GAME')?'winner':ser.endsWith('SPREAD')?'spread':ser.endsWith('TOTAL')?'total':'props'}
function relevantSeries(m){return category(m)===state.market}
function tradesForMarkets(ms){return ms.flatMap(m=>(m.trades||[]).map(t=>({t,m}))).filter(x=>number(x.t.premium_usd)!==null&&number(x.t.contracts)!==null&&Number(x.t.contracts)>0&&Number(x.t.premium_usd)>=0&&Number(x.t.premium_usd)<=Number(x.t.contracts)&&['yes','no'].includes(x.t.side)&&Number.isFinite(Date.parse(x.t.time)))}
function spark(ms){
 const chosen=ms.find(m=>m.ticker===state.contract)||ms.slice().sort((a,b)=>(b.trades?.length||0)-(a.trades?.length||0))[0];
 if(!chosen)return '<p>No matching exchange contracts in the sampled collection.</p>';
 const items=tradesForMarkets([chosen]).map(x=>x.t);
 if(!window.LHCharts)return '<p>Chart module unavailable. Refresh to retry.</p>';
 return window.LHCharts.price({title:'Observed YES contract price · '+(chosen.market||chosen.ticker),points:items.map(t=>({time:t.time,value:100*(t.side==='no'?1-Number(t.premium_usd)/Number(t.contracts):Number(t.premium_usd)/Number(t.contracts))})),unit:'percent',source:'Kalshi sampled public transactions · '+chosen.ticker,observedLabel:'Sampled transaction-derived price; not sportsbook probability or opening odds'})+window.LHCharts.activity({title:'Sampled transaction activity · '+(chosen.market||chosen.ticker),points:items.map(t=>({time:t.time,premium:Number(t.premium_usd),contracts:Number(t.contracts)})),source:'Kalshi public trades · incomplete sample; not sportsbook handle'});
}
function tradeStats(ms){
 const t=tradesForMarkets(ms),sum=t.reduce((n,x)=>n+Number(x.t.premium_usd),0);if(!t.length)return '<p>No validated sampled transactions returned. Premium and contract counts are unobserved, not verified zero market volume.</p>';
 return '<div class="lh-v2-stats"><div><small>Sampled trades</small><strong>'+t.length.toLocaleString()+'</strong></div><div><small>Sampled premium</small><strong>'+money(sum)+'</strong></div><div><small>Sampled contracts</small><strong>'+t.reduce((n,x)=>n+Number(x.t.contracts||0),0).toLocaleString()+'</strong></div></div>';
}
function quote(){const qs=selectedEvent()?.competitions?.[0]?.odds||[];return qs.find(q=>String(q.provider?.id||q.provider?.name)===state.provider)||qs[0]||null}
function providerPicker(owner){const qs=selectedEvent()?.competitions?.[0]?.odds||[];if(qs.length<2)return '';return '<label for="lh-v2-provider-'+esc(owner)+'">Published sportsbook provider</label><select id="lh-v2-provider-'+esc(owner)+'" data-lh-provider>'+qs.map(q=>{const key=String(q.provider?.id||q.provider?.name);return '<option value="'+esc(key)+'"'+(quote()===q?' selected':'')+'>'+esc(q.provider?.name||'Unknown provider')+'</option>'}).join('')+'</select>'}
function openingNote(q,market,sides){return sides.map(side=>{const o=q?.[market]?.[side]?.open;return o?side+' '+[o.line,o.odds].filter(v=>v!=null&&v!=='').join(' @ '):side+' unavailable'}).join(' / ')}
function licensedBoard(ev){
 const candidates=state.licensedOdds.filter(q=>q.sport===state.sport&&String(q.event_id)===String(ev?.id)&&['draftkings','fanduel'].includes(q.book_key)&&Number.isFinite(Date.parse(q.source_updated_at))&&Date.now()-Date.parse(q.source_updated_at)>=0&&Date.now()-Date.parse(q.source_updated_at)<=300000);
 if(!candidates.length)return '';
 return '<article class="lh-v2-panel"><h2>Source-timestamped sportsbook prices</h2>'+candidates.map(q=>'<div class="lh-v2-odd"><strong>'+esc(q.provider)+'</strong><small>Provider updated '+esc(new Date(q.source_updated_at).toLocaleString())+'</small>'+['h2h','spreads','totals'].map(k=>'<p><b>'+esc(k==='h2h'?'Moneyline':k==='spreads'?'Spread':'Total')+':</b> '+esc((q.markets?.[k]||[]).map(o=>o.name+' '+(o.point===null?'':o.point+' @ ')+formatOdds(o.price)).join(' / ')||'Unavailable')+'</p>').join('')+'</div>').join('')+'<p class="lh-v2-note">Licensed third-party odds snapshot. Source update time shown; not a guarantee of executable offers. Markets not supplied remain unavailable.</p></article>';
}
function priceBoard(owner){
 const ev=selectedEvent(),q=quote(),pair=participants(ev),a=pair.away?.team?.abbreviation||'Away',h=pair.home?.team?.abbreviation||'Home';
 const ml=side=>q?.moneyline?.[side]?.close?.odds??q?.[side+'TeamOdds']?.moneyLine;
 const line=(market,side)=>{const item=q?.[market]?.[side]?.close;return item?[item.line,item.odds].filter(x=>x!=null&&x!=='').join(' @ '):'Unavailable'};
 const cards=[['Moneyline',ml('away')!=null||ml('home')!=null?a+' '+formatOdds(ml('away'))+' / '+h+' '+formatOdds(ml('home')):'Not published',openingNote(q,'moneyline',['away','home'])],['Spread / run line',q?.pointSpread?a+' '+line('pointSpread','away')+' / '+h+' '+line('pointSpread','home'):state.sport==='mlb'?'Not published':q?.details||'Not published',openingNote(q,'pointSpread',['away','home'])],['Game total',q?.total?'Over '+line('total','over')+' / Under '+line('total','under'):number(q?.overUnder)!==null?'O/U '+q.overUnder:'Not published',openingNote(q,'total',['over','under'])],['Team totals','Not published','No verified sportsbook feed configured'],['First half','Not published','No verified sportsbook feed configured'],['Player props','Not published','No verified sportsbook feed configured']];
 if(!q&&licensedBoard(ev))return licensedBoard(ev);
 if(!q)return '<article class="lh-v2-panel"><h2>Sportsbook prices</h2><p class="lh-v2-status"><strong>LIVE ODDS UNAVAILABLE</strong> — no verified game-matched sportsbook quote was returned. Scoreboard refresh time is not a sportsbook quote timestamp.</p><p>Moneyline, spread, total, first half, team totals and player props cannot be priced from this source right now. Check an actual sportsbook for executable offers; do not reuse historical prices as current.</p></article>';
 return licensedBoard(ev)+'<article class="lh-v2-panel"><h2>ESPN-published sportsbook quote board</h2>'+providerPicker(owner)+'<p>'+esc(q?.provider?.name||'No verified book quote')+' · ESPN published close/latest fields, observed '+esc(state.scoreLoaded?new Date(state.scoreLoaded).toLocaleString():'time unavailable')+'</p><div class="lh-v2-odds">'+cards.map(c=>'<div class="lh-v2-odd"><small>'+esc(c[0])+'</small><strong>'+esc(c[1])+'</strong><span>Source open: '+esc(c[2])+'</span></div>').join('')+'</div><p class="lh-v2-note">Source opening timestamps are not supplied. Close/latest fields are observations, not guaranteed live or executable offers. Exchange alternatives are shown separately below.</p></article>';
}
function tradePanel(owner){
 const all=selectedMarkets(),subset=all.filter(relevantSeries);const selected=subset.find(m=>m.ticker===state.contract)||subset.slice().sort((a,b)=>(b.trades?.length||0)-(a.trades?.length||0))[0];
 const collected=selected?.collected_at||state.collected;const age=Date.parse(collected);const stale=!Number.isFinite(age)||Date.now()-age>1800000;
 const rawPrice=v=>number(v)!==null&&number(v)>0&&number(v)<1?money(Number(v))+' per YES contract':'No interior quote verified';
 const quotes=selected?'<p>YES bid: '+esc(rawPrice(selected.yes_bid_dollars))+' · YES ask: '+esc(rawPrice(selected.yes_ask_dollars))+' · Last reported: '+esc(rawPrice(selected.last_price_dollars))+'</p><p class="lh-v2-note">Market quote observation: '+esc(selected.quote_observed_at?new Date(selected.quote_observed_at).toLocaleString():'timestamp not supplied for this sample')+'. Quotes are separate from the sampled trade history and are not guaranteed executable.</p>':'';
 const picker=subset.length?'<label for="lh-v2-contract-'+esc(owner)+'">Exchange contract / exact outcome</label><select id="lh-v2-contract-'+esc(owner)+'" data-lh-contract>'+subset.map(m=>'<option value="'+esc(m.ticker)+'"'+(m===selected?' selected':'')+'>'+esc(m.market||m.ticker)+(m.yes_sub_title?' · '+esc(m.yes_sub_title):'')+'</option>').join('')+'</select>':'';
 return '<article class="lh-v2-panel"><h2>Exchange alternative · '+esc({winner:'Winner',spread:'Winning margin',total:'Game total threshold',team:'Team total threshold',half:state.sport==='mlb'?'First five innings contract':'First-half contract',props:'Player contract'}[state.market])+'</h2><p>Kalshi public exchange · '+(stale?'STALE / unavailable collection time':'timestamped sample')+'</p>'+picker+quotes+(selected?tradeStats([selected])+spark([selected]):'<p>No matching '+esc(state.market==='half'&&state.sport==='mlb'?'first-five-innings':marketLabel[state.market])+' exchange observations in this bounded snapshot. This does not mean zero market activity.</p>')+'<p class="lh-v2-note">Collection: '+esc(collected?new Date(collected).toLocaleString():'Unavailable')+'. Exchange contracts differ from sportsbook lines. Premium is contracts × traded outcome price, never sportsbook dollar handle or ticket share.</p></article>';
}
function splitPanel(){
 const ev=selectedEvent(),entry=ev?state.splits.find(x=>x.mapping_status==='matched'&&x.sport===state.sport&&String(x.event_id)===String(ev.id)):null;
 let html='<article class="lh-v2-panel"><h2>Sportsbook money / ticket splits</h2>'+(state.splitsError?'<p class="lh-v2-status">'+esc(state.splitsError)+'</p>':'');
 if(!entry)return html+'<p>No verified matched public split entry for this selection in the limited preview. Full-game total and team-total splits, private wager amounts and individual wager timestamps are not available from the configured sources.</p>'+(state.splitsError?'<p>'+esc(state.splitsError)+'</p>':'')+'</article>';
 const observed=Date.parse(entry.observed_at),stale=!Number.isFinite(observed)||Date.now()-observed>1800000;
 const url=String(entry.source_url||'');
 html+='<p>'+esc(entry.provider)+' · Page retrieved '+esc(Number.isFinite(observed)?new Date(observed).toLocaleString():'time unavailable')+(stale?' · STALE observation':'')+'</p><p>Source publication/update time: '+esc(entry.source_updated_at||'not supplied; percentages may be delayed')+'. Do not assume these splits are contemporaneous with current odds.</p>';
 const key=state.market==='winner'?'moneyline':state.market==='spread'?'spread':null;
 if(key){html+='<div class="lh-c-scroll"><table class="lh-split-table"><caption>Published '+esc(key)+' percentages · 0–100% scale</caption><thead><tr><th>Side / quote</th><th>Dollar handle share</th><th>Ticket share</th><th>Handle − tickets</th></tr></thead><tbody>';
 for(const side of ['away','home']){const team=entry[side],q=team?.[key];const handle=number(q?.handle_pct),tickets=number(q?.ticket_pct);if(!team||handle===null||tickets===null||handle<0||handle>100||tickets<0||tickets>100)continue;html+='<tr><th>'+esc(team.team)+' '+esc(q.line||'')+'</th><td>'+handle+'%</td><td>'+tickets+'%</td><td>'+(handle-tickets).toFixed(1)+' percentage points</td></tr>';}
 html+='</tbody></table></div><p>Actual total dollar handle and ticket counts are not supplied. Percentages describe the publisher’s reported sample, not all sportsbooks. A handle/ticket disagreement does not identify sharp action, individual large wagers or an independent betting edge.</p>';
 }else html+='<p>'+esc(entry.total_limitation||'No verified percentages for the selected market.')+'</p>';
 html+='<p>'+esc(entry.coverage||'Limited public preview')+'</p>'+(url.startsWith('https://')?'<p><a href="'+esc(url)+'" target="_blank" rel="noopener">Open the published source</a></p>':'');return html+'</article>';
}
async function loadSplits(token=generation,force=false){if(!force&&state.splitsLoaded&&Date.now()-state.splitsLoaded<120000)return;try{const r=await fetch('./sportsbook-splits.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(token!==generation)return;if(!Array.isArray(j.entries))throw Error('Invalid split snapshot');state.splits=j.entries;state.splitsMeta=j;state.splitsError=(j.errors||[]).join(' · ');state.splitsLoaded=Date.now()}catch(e){if(token===generation)state.splitsError='Public split preview unavailable: '+e.message}}
function analysis(compact=false){if(!compact&&window.LHIntelligence)return window.LHIntelligence.render(state.report,selectedEvent(),state.sport,{fetchedAt:state.reportLoaded,scoreFetchedAt:state.scoreLoaded,source:state.reportSource,error:state.reportError,quote:quote(),quoteObservedAt:state.scoreLoaded,quoteSourceTime:null,history:state.quoteHistory[state.sport+':'+selectedEvent()?.id+':'+quote()?.provider?.name]||[]});const count=tradesForMarkets(selectedMarkets()).length;return '<article class="lh-v2-insight"><h2>✦ MARIA · EVIDENCE STATUS</h2><p>'+count+' validated sampled exchange transactions for this selection. '+(quote()?'A provider-attributed ESPN game quote is available. ':'No verified sportsbook game quote supplied. ')+'Observed prices and game statistics are evidence, not a forecast. Unavailable sportsbook splits cannot establish an edge or prove a late large wager.</p></article>'}
function analyticsPanel(){const warning=(state.reportError?'<p class="lh-v2-status">'+esc(state.reportError)+'</p>':'')+(state.reportLoaded&&Date.now()-state.reportLoaded>1800000?'<p class="lh-v2-status">STALE report: '+esc(new Date(state.reportLoaded).toLocaleString())+'</p>':'');if(window.LHAnalytics)return warning+window.LHAnalytics.render(state.report,selectedEvent(),state.sport,{fetchedAt:state.reportLoaded,source:state.reportSource,error:state.reportError});return statsPanel()+injuryPanel()}
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
 return hero()+independentPanel()+analysis()+'<div class="lh-v2-context">'+esc(eventText)+'</div>'+analyticsPanel()+priceBoard('scores');
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
 $('lh-v2-status').textContent=(state.scoreError?'ESPN: '+state.scoreError+' · ':'')+(state.historyError?state.historyError+' · ':'')+(state.tradeError?'Trades: '+state.tradeError:'');
 document.querySelectorAll('[data-lh-sport]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lhSport===state.sport)));
 $('lh-v2-games').innerHTML=hero()+independentPanel()+analysis()+marketTabs()+priceBoard('games')+'<details class="lh-v2-extra"><summary>Line movement, public betting splits & exchange activity</summary>'+quoteMovement()+splitPanel()+tradePanel('games')+'</details>'+'<details class="lh-v2-report-detail"><summary>Explore source statistics, players and availability</summary>'+analyticsPanel()+'</details>';
 $('lh-v2-trades').innerHTML=hero()+marketTabs()+quoteMovement()+splitPanel()+tradePanel('trades')+analysis(true);
 $('lh-v2-scores').innerHTML=scorePanel();
 if(typeof research!=='undefined'&&research)research.refreshContext();
 const diagnostics=$('lh-v2-source-status');if(diagnostics)diagnostics.innerHTML='<p>Scoreboard: '+esc(state.scoreLoaded?new Date(state.scoreLoaded).toLocaleString():'Unavailable')+'</p><p>Exchange snapshot: '+esc(state.collected?new Date(state.collected).toLocaleString():'Unavailable')+'</p><p>Browser refresh: every minute while visible. Scheduled collection: requested every 10 minutes; GitHub may delay runs.</p>'+'<p>Matched public split entries: '+state.splits.length+'. '+esc(state.splitsError||'Limited public preview; publisher update time may be unknown.')+'</p>'+((state.collectorErrors.length||state.scoreSnapshot?.errors?.length||state.scoreSnapshot?.report_errors?.length)?'<ul>'+[...state.collectorErrors,...(state.scoreSnapshot?.errors||[]),...(state.scoreSnapshot?.report_errors||[])].map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>':'<p>No source errors reported in the loaded snapshots. Coverage is bounded; absence is not proof of no market activity.</p>');
}
async function loadTrade(token=generation,force=false){
 if(!force&&state.sourceLoaded&&Date.now()-state.sourceLoaded<120000)return;
 try{const res=await fetch('./public-trades.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error('HTTP '+res.status);const j=await res.json();if(token!==generation)return;if(!Array.isArray(j.markets))throw Error('Invalid trade snapshot');state.markets=j.markets;state.sourceLoaded=Date.now();state.collected=j.collected_at;state.collectorErrors=j.errors||[];state.tradeError=j.errors?.length?'Collector reports '+j.errors.length+' errors':''}catch(e){if(token===generation)state.tradeError=e.message}
}
async function loadScores(force=false,token=generation){
 const sport=state.sport;
 if(!force&&state.scoresCache[sport]&&Date.now()-state.scoresCache[sport].time<60000){const c=state.scoresCache[sport];state.events=c.events;state.scoreLoaded=c.time;state.scoreError=c.warning||'';return}
 try{
  const res=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+sportPaths[sport]+'/scoreboard'+(sport==='college'?'?groups=80&limit=1000':'?limit=1000'),{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw Error('HTTP '+res.status);
  const j=await res.json();if(token!==generation)return;
  if(!Array.isArray(j.events))throw Error('Invalid scoreboard payload');state.events=j.events;state.scoreLoaded=Date.now();state.scoreError='';
 }catch(e){
  if(token!==generation)return;
  const saved=state.scoreSnapshot?.sports?.[sport];
  state.events=saved?.events||[];state.scoreLoaded=saved?.collected_at?Date.parse(saved.collected_at):null;
  state.scoreError=saved?'Direct feed unavailable; showing scheduled snapshot from '+new Date(state.scoreLoaded).toLocaleString():e.message;
 }
 if(token!==generation)return;
 state.scoresCache[sport]={events:state.events,time:state.scoreLoaded||0,warning:state.scoreError};
}
async function loadHistory(token=generation,force=false){
 if(!force&&state.scoreSnapshot&&Date.now()-(state.historyLoaded||0)<120000)return;
 try{const r=await fetch('./scoreboards.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(token!==generation)return;state.scoreSnapshot=j;state.quoteHistory=j.history||{};state.historyLoaded=Date.now();state.historyError=''}catch(e){if(token===generation)state.historyError='Scheduled snapshots unavailable: '+e.message}
}
function movementDigest(points,field,label,unit,opening){
 const observed=[...new Map(points.filter(p=>number(p[field])!==null&&Number.isFinite(Date.parse(p.time))&&Date.parse(p.time)<=Date.now()).map(p=>[p.time,p])).values()].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 if(!observed.length)return '<p>'+esc(label)+': no valid timestamped prices supplied.</p>';
 const first=observed[0],last=observed[observed.length-1],start=number(opening);const difference=(a,b)=>{const d=number(b)-number(a);return (d>0?'+':'')+Number(d.toFixed(2))+' '+unit};
 const changed=observed.filter((p,i)=>i>0&&number(p[field])!==number(observed[i-1][field]));const lastChange=changed[changed.length-1];
 return '<p><strong>'+esc(label)+'</strong> · '+(start===null?'Opening unavailable':'Published opening '+esc(start)+' → latest '+esc(last[field])+' ('+esc(difference(start,last[field]))+'); opening time unknown')+'. First observed '+esc(first[field])+' at '+esc(new Date(first.time).toLocaleString())+'; latest observation '+esc(last[field])+' at '+esc(new Date(last.time).toLocaleString())+'. '+(lastChange?'Last observed change at '+esc(new Date(lastChange.time).toLocaleTimeString())+'.':'No change across the available observations; intervening moves may be missed.')+'</p>';
}
function quoteMovement(){
 const ev=selectedEvent(),q=quote();if(!ev)return '';const provider=q?.provider?.name;const key=state.sport+':'+ev.id+':'+provider;
 const points=(state.quoteHistory[key]||[]).slice();
 if(q&&state.scoreLoaded){const current={time:new Date(state.scoreLoaded).toISOString(),away_moneyline:q.moneyline?.away?.close?.odds??q.awayTeamOdds?.moneyLine,home_moneyline:q.moneyline?.home?.close?.odds??q.homeTeamOdds?.moneyLine,home_spread_line:q.pointSpread?.home?.close?.line,total:q.overUnder??(typeof q.total?.over?.close?.line==='string'?q.total.over.close.line.replace(/^[ou]/i,''):q.total?.over?.close?.line)};points.push(current)}
 const fields={winner:[['away_moneyline','Away moneyline','American odds',q?.moneyline?.away?.open?.odds],['home_moneyline','Home moneyline','American odds',q?.moneyline?.home?.open?.odds]],spread:[['home_spread_line','Home spread / run line',state.sport==='mlb'?'runs':'points',q?.pointSpread?.home?.open?.line]],total:[['total','Game total',state.sport==='mlb'?'runs':'points',typeof q?.total?.over?.open?.line==='string'?q.total.over.open.line.replace(/^[ou]/i,''):q?.total?.over?.open?.line]]};
 if(!fields[state.market])return '<article class="lh-v2-panel"><h2>Sportsbook '+esc(marketLabel[state.market])+'</h2><p>No verified automated sportsbook feed for this market. See the separately labeled exchange alternative and game-scoped research tools in More.</p><p>Ticket and dollar-handle percentages: unavailable from the configured verified automated sources.</p></article>';
 let html='<article class="lh-v2-panel"><h2>What changed in the selected market?</h2><p>'+esc(provider||'No verified provider')+' · ESPN; observation times are retrieval times, not sportsbook update or wager times.</p><div class="lh-v2-move-digest">'+fields[state.market].map(([field,label,unit,open])=>movementDigest(points,field,label,unit,open)).join('')+'</div><p class="lh-v2-note">American-odds changes are raw quote differences, not probability percentage points. First observed is not necessarily market open.</p>';
 if(!window.LHCharts)return html+'<p>Charts unavailable. Refresh to retry.</p></article>';
 for(const [field,label,unit,open] of fields[state.market])html+=window.LHCharts.price({title:'How did '+label.toLowerCase()+' move?',points:points.map(p=>({time:p.time,value:number(p[field])})),unit,source:'ESPN published quotes · '+(provider||'provider unavailable'),opening:number(open)!==null?{value:number(open)}:null,observedLabel:'Timestamped observations; close/latest fields may be delayed'});
 const kickoff=Date.parse(ev.date),now=Date.now();const recent=points.filter(p=>Date.parse(p.time)>=now-900000&&Date.parse(p.time)<=now);
 for(const [field,label,unit] of fields[state.market]){const timed=[...new Map(recent.filter(p=>number(p[field])!==null).map(p=>[p.time,p])).values()].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));html+='<p class="lh-v2-note">'+esc(label)+' · latest 15-minute observations: '+(timed.length>=2?esc(timed[0][field])+' at '+esc(new Date(timed[0].time).toLocaleTimeString())+' → '+esc(timed[timed.length-1][field])+' at '+esc(new Date(timed[timed.length-1].time).toLocaleTimeString())+' ('+esc(unit)+')':'insufficient distinct timed observations to quantify movement')+'.</p>'}
 html+='<p class="lh-v2-note">Last 15 minutes: '+recent.length+' recorded quote observations'+(Number.isFinite(kickoff)&&now<kickoff?' · '+Math.ceil((kickoff-now)/60000)+' minutes until scheduled start':'')+'. Gaps are unobserved periods. A line change does not prove a particular wager.</p><p>Public split coverage, when verified, is shown in its own source-attributed panel. Missing percentages remain unavailable. Kalshi premium is never a substitute.</p>';
 return html+'</article>';
}
async function loadReport(){
 const token=generation,sport=state.sport,selectionKey=state.selected,ev=selectedEvent();if(!ev){state.report=null;state.reportEvent='';return}
 if(state.reportEvent===ev.id&&state.reportLoaded&&Date.now()-state.reportLoaded<60000)return;state.report=null;state.reportEvent='';state.reportLoaded=null;state.reportSource='';state.reportError='';render();
 const url='https://site.api.espn.com/apis/site/v2/sports/'+sportPaths[sport]+'/summary?event='+encodeURIComponent(ev.id);
 try{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(token!==generation||selectionKey!==state.selected)return;if(j.header?.id&&String(j.header.id)!==String(ev.id))throw Error('Summary event identity mismatch');state.report=j;state.reportLoaded=Date.now();state.reportSource=url;state.reportEvent=ev.id}
 catch(e){if(token!==generation||selectionKey!==state.selected)return;const saved=state.scoreSnapshot?.reports?.[sport+':'+ev.id];state.reportError='Direct report unavailable: '+e.message;if(saved?.report&&(!saved.report.header?.id||String(saved.report.header.id)===String(ev.id))){state.report=saved.report;state.reportLoaded=Date.parse(saved.collected_at);state.reportSource=saved.source;state.reportEvent=ev.id;state.reportError+=' · Showing dated scheduled fallback'}else state.report={error:state.reportError}}
 render();
}
async function loadLicensedOdds(token){
 try{
  const r=await fetch('./licensed-odds.json?ts='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const j=await r.json();if(token!==generation)return;
  state.licensedStatus=j.status||'unavailable';state.licensedOdds=Array.isArray(j.quotes)?j.quotes:[];
 }catch(e){if(token===generation){state.licensedOdds=[];state.licensedStatus='unavailable';}}
}
async function refresh(force=false){
 const token=++generation;
 $('lh-v2-status').textContent='Refreshing verified sources…';
 await Promise.all([loadHistory(token,force),loadSplits(token,force),loadLicensedOdds(token)]);if(token!==generation)return;await Promise.all([loadScores(force,token),loadTrade(token,force)]);if(token!==generation)return;renderPicker();render();
 if(force)state.reportEvent='';if(selectedEvent())await loadReport();
}
root.addEventListener('error',e=>{if(e.target.matches?.('img.lh-v2-teamlogo')){const span=document.createElement('span');span.className='lh-v2-placeholder';span.textContent=state.sport==='nba'?'🏀':state.sport==='mlb'?'⚾':'🏈';e.target.replaceWith(span)}},true);
root.addEventListener('click',async e=>{
 const sport=e.target.closest('[data-lh-sport]');if(sport){state.sport=sport.dataset.lhSport;state.selected='';state.provider='';state.contract='';state.events=[];state.report=null;state.reportEvent='';await refresh(false);return}
 const market=e.target.closest('[data-lh-market]');if(market){state.market=market.dataset.lhMarket;state.contract='';render();return}
});
$('lh-v2-event').addEventListener('change',async e=>{state.selected=e.target.value;state.provider='';state.contract='';state.report=null;state.reportEvent='';render();if(selectedEvent())await loadReport()});
$('lh-v2-refresh').addEventListener('click',()=>refresh(true));
document.querySelectorAll('.mobile-bottom button').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.screen;document.body.dataset.tab=state.tab;document.querySelectorAll('.mobile-bottom button').forEach(x=>{x.setAttribute('aria-pressed',String(x===b));if(x===b)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});render();if(state.tab==='scores')loadReport()}));
root.addEventListener('change',e=>{if(e.target.matches('[data-lh-contract]')){state.contract=e.target.value;render()}if(e.target.matches('[data-lh-provider]')){state.provider=e.target.value;render()}});
let research=null;if(window.LHResearch)research=window.LHResearch.mount($('lh-v2-research'),{getContext:()=>({sport:state.sport,eventId:selectedEvent()?.id||state.selected,eventName:selection().title,market:state.market})});
refresh(false);
setInterval(()=>{if(document.visibilityState==='visible')refresh(false)},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh(false)});
})();