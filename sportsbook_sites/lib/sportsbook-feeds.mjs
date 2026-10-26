import {all,one,hash,now,settle,quoteReason} from './sportsbook.mjs';
const sports={nfl:['football/nfl','american-football','usa-nfl'],college:['football/college-football','american-football','usa-college'],nba:['basketball/nba','basketball','usa-nba'],mlb:['baseball/mlb','baseball','usa-mlb']};
export const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'and').replace(/\bst\.?$/,'state').replace(/[^a-z0-9]/g,'');
const time=s=>{const t=Date.parse(s);return Number.isFinite(t)?Math.floor(t/1000):null};
const prepare=(db,sql,args=[])=>db.prepare(sql).bind(...args);
async function get(url,withHeaders=false){
 const r=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'LakeHouseVirtualSportsbook'}});
 if(!r.ok){const retry=r.headers.get('retry-after'),seconds=Number(retry),resetRaw=r.headers.get('x-ratelimit-reset'),reset=Number(resetRaw),resetDate=resetRaw?.includes('T')?Date.parse(resetRaw):NaN,resetAt=Number.isFinite(resetDate)?Math.floor(resetDate/1000):reset>1e12?Math.floor(reset/1000):reset>now()?reset:reset>0&&reset<=3600?now()+reset:now()+60,retryAt=retry?(Number.isFinite(seconds)?now()+Math.max(1,seconds):Math.floor(Date.parse(retry)/1000)):resetAt;throw Object.assign(Error((url.includes('espn.com')?'ESPN':'Odds-API.io')+' HTTP '+r.status+(r.status===429?' (rate limited)':r.status===401||r.status===403?' (key or subscription access denied)':'')),{provider:url.includes('espn.com')?'ESPN':'Odds-API.io',status:r.status,retryAt:Number.isFinite(retryAt)?retryAt:now()+60,rateLimit:r.headers.get('x-ratelimit-limit'),rateRemaining:r.headers.get('x-ratelimit-remaining'),rateReset:r.headers.get('x-ratelimit-reset')})}
 const data=await r.json();return withHeaders?{data,date:r.headers.get('date'),age:r.headers.get('age'),cacheControl:r.headers.get('cache-control')}:data;
}
export function eventMatches(offer,event){
 const details=JSON.parse(event.payload),start=time(offer.date||offer.startsAt||offer.startTime);
 return start!==null&&Math.abs(event.starts_at-start)<=180&&['home','away'].every(side=>
  (details.aliases?.[side]||[details.teams[side]]).map(norm).includes(norm(offer[side])));
}
export function collegeLeagues(rows){
 if(!Array.isArray(rows))throw Error('Odds-API.io league discovery returned an invalid response');
 const result=rows.filter(r=>typeof r.slug==='string'&&/ncaa|ncaaf|college|\bfbs\b|\bfcs\b/i.test(r.name+' '+r.slug)).map(r=>r.slug);
 if(!result.length)throw Error('Odds-API.io lists no college football league for american-football');
 return [...new Set(result)];
}
let leagueCache;
async function leaguesFor(sport,apiSport,league,key){
 if(sport!=='college')return [league];
 if(leagueCache&&leagueCache.until>now())return leagueCache.leagues;
 const rows=await get('https://api.odds-api.io/v3/leagues?'+new URLSearchParams({apiKey:key,sport:apiSport}));
 const leagues=collegeLeagues(rows);leagueCache={leagues,until:now()+3600};return leagues;
}
export function espnEvents(board,sport,url){
 const result=[];
 for(const raw of board.events||[]){
  const competition=raw.competitions?.[0],competitors=competition?.competitors||[];
  const teams=Object.fromEntries(competitors.map(t=>[t.homeAway,t.team?.displayName]));
  const start=time(competition?.date||raw.date);if(!teams.home||!teams.away||start===null)continue;
  const status=competition?.status||raw.status;
  let state={pre:'scheduled',in:'live',post:'final'}[status?.type?.state]||'unavailable';
  for(const closed of ['postponed','cancelled','canceled','suspended','delayed'])if(String(status?.type?.name).toLowerCase().includes(closed))state=closed;
  const aliases=Object.fromEntries(competitors.map(({homeAway,team})=>[homeAway,[team.displayName,team.shortDisplayName,team.location,team.abbreviation].filter(Boolean)]));
  const details={teams,aliases,scores:Object.fromEntries(competitors.map(t=>[t.homeAway,t.score])),clock:status?.displayClock,period:status?.period,status:status?.type?.detail,timestamp_note:'ESPN retrieval timestamp; event update time not supplied'};
  result.push({id:sport+':'+raw.id,sport,matchup:teams.away+' @ '+teams.home,starts_at:start,state,source:url,source_at:now(),payload:JSON.stringify(details)});
 }
 return result;
}

export function american(value){const n=Number(value);if(!Number.isFinite(n))return null;if(typeof value==='number'&&Number.isInteger(n)&&Math.abs(n)>=100&&Math.abs(n)<=100000)return n;if(n>1&&n<=1001)return Math.round(n>=2?(n-1)*100:-100/(n-1));return null}
const propStats=[[/passing yards/i,'passing:yards'],[/rushing yards/i,'rushing:yards'],[/receiving yards/i,'receiving:yards'],[/receptions/i,'receiving:receptions'],[/player points/i,'basketball:points'],[/player rebounds/i,'basketball:rebounds'],[/player assists/i,'basketball:assists']];
export function offers(payload,event,env,reasons={}){const reject=reason=>{reasons[reason]=(reasons[reason]||0)+1};const out=[],details=JSON.parse(event.payload),teams=details.teams;for(const [book,markets] of Object.entries(payload.bookmakers||{})){if(!/^(DraftKings|Draft Kings|FanDuel)$/i.test(book)||!Array.isArray(markets))continue;for(const m of markets){if(m.suspended===true||/suspended|closed|inactive/i.test(String(m.status||''))){reject('Market suspended by provider');continue}const sourceAt=time(m.updatedAt);if(!sourceAt){reject('Provider market timestamp missing or invalid');continue}if(sourceAt>now()){reject('Provider market timestamp is in the future');continue}const name=String(m.name||'');let market,period='full',subject=null;const half=/1st half|first half|half 1|\bh1\b/i.test(name),base=name.replace(/1st half|first half|half 1|\bh1\b/ig,'').trim();if(half){if(event.sport==='mlb'||(event.state==='live'&&Number(details.period)>2))continue;period='first_half';market='first_half'}else if(/^team total (home|away)$/i.test(base)){market='team_total';subject=/home/i.test(base)?'home':'away'}else if(/^(ml|moneyline|money line|winner|match result)$/i.test(base))market='moneyline';else if(/^(spread|handicap|run line)$/i.test(base))market='spread';else if(/^(game total|total|totals|over\/under)$/i.test(base))market='total';else if(propStats.some(([re])=>re.test(base)))market='player_prop';else continue;
 const isSpread=/spread|handicap|run line/i.test(base),isTotal=/total|over\/under/i.test(base),isMl=/^(ml|moneyline|money line|winner|match result)$/i.test(base);if(half&&/^team total/i.test(base)){reject('Half-specific team totals are not supported');continue}if(half&&!isSpread&&!isTotal&&!isMl)continue;
 for(const row of m.odds||[]){if(row.suspended===true||/suspended|closed|inactive/i.test(String(row.status||''))){reject('Selection suspended by provider');continue}const lineRaw=(isSpread||isTotal||['team_total','total','player_prop'].includes(market))?(row.hdp??row.max??row.point??row.line):null;const line=lineRaw==null?null:Number(lineRaw);if(line!==null&&!Number.isFinite(line))continue;let sub=subject;if(market==='player_prop'){const player=String(row.player||row.playerName||row.label||m.player||'').trim();const stat=propStats.find(([re])=>re.test(base))?.[1];if(!player||!stat)continue;sub=player+'|'+stat}
 for(const side of ['home','away','over','under']){if(row[side]==null)continue;if((market==='team_total'||market==='total'||market==='player_prop'||isTotal)&&!['over','under'].includes(side))continue;if((market==='moneyline'||market==='spread'||isMl||isSpread)&&!['home','away'].includes(side))continue;if((market==='spread'||isSpread||isTotal||['team_total','total','player_prop'].includes(market))&&line===null)continue;const odds=american(row[side]);if(odds===null)continue;const live=event.state==='live';if(live&&env.SB_LIVE_ODDS_AUTHORIZED!=='1'){reject('Live odds authorization is not enabled');continue}const adjusted=(market==='spread'||isSpread)&&side==='away'?-line:line;const selection=(sub?(market==='team_total'?teams[sub]:sub.split('|')[0])+' ':'')+(['home','away'].includes(side)?teams[side]:side)+(adjusted!==null?' '+adjusted:'');const source='Odds-API.io / '+book;const key=hash(JSON.stringify([event.id,market,period,selection,odds,adjusted,sourceAt,source]));out.push({id:key,event_id:event.id,market,selection,odds,line:adjusted===null?null:String(adjusted),side,subject:sub,period,source,source_at:sourceAt,received_at:now(),expires_at:now()+(live?15:120),closes_at:live?now()+15:event.starts_at,live:Number(live),suspended:0,licensed:Number(env.SB_ODDS_AUTHORIZED==='1')})}
 }
 }}return out}
// ESPN's explicit live branches are current snapshots, not closing prices.
// source_at records the source HTTP snapshot publication time, NOT a price-change time.
export function espnOffers(response,event,env){
 const summary=response.data,sourceAt=time(response.date),age=Number(response.age||0),cache=String(response.cacheControl||'').match(/(?:^|,)\s*max-age=(\d+)/i);
 const live=event.state==='live',ttl=live?15:120;
 if(!sourceAt||sourceAt>now()||sourceAt<now()-ttl||!Number.isFinite(age)||age<0||age>ttl||!cache||Number(cache[1])>ttl)return [];
 if(env.SB_ODDS_AUTHORIZED!=='1'||(live&&env.SB_LIVE_ODDS_AUTHORIZED!=='1'))return [];
 const rawId=event.id.split(':')[1],comp=summary?.header?.competitions?.[0];
 if(String(summary?.header?.id)!==rawId||!comp||comp.status?.type?.completed===true||comp.status?.type?.state!==(live?'in':'pre'))return [];
 const teams=Object.fromEntries((comp.competitors||[]).map(c=>[c.homeAway,c.team?.displayName]));const expected=JSON.parse(event.payload);
 if(!['home','away'].every(side=>norm(teams[side])===norm(expected.teams[side])))return [];
 const start=time(comp.date);if(!start||Math.abs(start-event.starts_at)>180)return [];
 if(live&&(Number(comp.status.period)!==Number(expected.period)||String(comp.status.displayClock)!==String(expected.clock)))return [];
 if(live&&!comp.competitors.every(c=>String(c.score)===String(expected.scores[c.homeAway])))return [];
 const output=[];const parseOdds=value=>{if(typeof value!=='string'&&typeof value!=='number')return null;const n=Number(value);return Number.isInteger(n)&&Math.abs(n)>=100&&Math.abs(n)<=100000?n:null};
 for(const row of summary.pickcenter||[]){const book=row.provider?.name;if(!['DraftKings','FanDuel'].includes(book)||row.suspended===true)continue;
  for(const [market,node,sides] of [['moneyline',row.moneyline,['home','away']],['spread',row.pointSpread,['home','away']],['total',row.total,['over','under']]]){
   for(const side of sides){const offer=node?.[side]?.[live?'live':'close'];if(!offer||offer.suspended===true||/off|suspended|closed/i.test(String(offer.status||'')))continue;const odds=parseOdds(offer.odds);if(odds===null)continue;
    let line=null;if(market!=='moneyline'){if(typeof offer.line!=='string'||! /^(?:[ou])?[+-]?\d+(?:\.\d+)?$/i.test(offer.line))continue;line=Number(offer.line.replace(/^[ou]/i,''));if(!Number.isFinite(line))continue;}
    const selection=(['home','away'].includes(side)?expected.teams[side]:side)+(line===null?'':' '+line),source='ESPN '+(live?'live':'pregame')+' snapshot / '+book;
    const key=hash(JSON.stringify(['espn',event.id,market,side,line,odds,source]));
    output.push({id:key,event_id:event.id,market,selection,odds,line:line===null?null:String(line),side,subject:null,period:'full',source,source_at:sourceAt,received_at:now(),expires_at:Math.min(sourceAt+ttl,now()+(live?15:90)),closes_at:live?Math.min(sourceAt+ttl,now()+15):event.starts_at,live:Number(live),suspended:0,licensed:1});
   }
  }
 }
 return output.filter(q=>q.expires_at>now());
}
async function espnFallback(env,event,diagnostic){
 const db=env.DB,lease=await prepare(db,"INSERT INTO sb_config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE value<? RETURNING value",['espn_odds_refresh:'+event.id,now()+(event.state==='live'?5:60),now()]).first();
 if(!lease)return;
 try{const path=sports[event.sport][0],url='https://site.api.espn.com/apis/site/v2/sports/'+path+'/summary?event='+encodeURIComponent(event.id.split(':')[1]);
  const response=await get(url,true);const prices=espnOffers(response,event,env);
  const commands=[prepare(db,"UPDATE sb_quotes SET suspended=1 WHERE event_id=? AND source LIKE 'ESPN %'",[event.id])];
  for(const q of prices)commands.push(prepare(db,'INSERT INTO sb_quotes VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET source_at=excluded.source_at,suspended=0,received_at=excluded.received_at,expires_at=excluded.expires_at,closes_at=excluded.closes_at',Object.values(q)));
  await db.batch(commands);const detail=diagnostic.events[event.id];if(prices.length){detail.reason=null;detail.fallback='ESPN';for(const q of prices)detail.markets[q.market]=(detail.markets[q.market]||0)+1;diagnostic.quotes+=prices.length;diagnostic.fallback_quotes=(diagnostic.fallback_quotes||0)+prices.length;}
 }catch{diagnostic.events[event.id].fallback_reason='ESPN did not return a fresh verified odds snapshot';}
}
export async function ensureEspnPrices(env,sport,eventId){
 if(!env.DB||!eventId||!sports[sport]||!eventId.startsWith(sport+':')||eventId.length>100)return;
 const event=await one(env.DB,'SELECT * FROM sb_events WHERE id=? AND sport=?',[eventId,sport]);
 if(!event||!['live','scheduled'].includes(event.state)||event.source_at<now()-60)return;
 const fresh=await one(env.DB,"SELECT 1 found FROM sb_quotes WHERE event_id=? AND source LIKE 'ESPN %' AND suspended=0 AND expires_at>? LIMIT 1",[event.id,now()+5]);if(fresh)return;
 await espnFallback(env,event,{quotes:0,events:{[event.id]:{markets:{},reason:null}}});
}
export async function refresh(env,selected='',selectedEvent=''){
 const db=env.DB;if(!db)return;
 const entries=Object.entries(sports).filter(([sport])=>!selected||selected===sport);
 await Promise.all(entries.map(async([sport,[path,apiSport,league]])=>{
  const prior=selectedEvent?await one(db,'SELECT * FROM sb_events WHERE id=? AND sport=?',[selectedEvent,sport]):null;const interval=prior&&(prior.state==='live'||prior.starts_at<now()+120)?10:45;const refreshKey='feed_refresh_'+sport+(selectedEvent?':'+selectedEvent:'');
  const lease=await prepare(db,"INSERT INTO sb_config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE value<? RETURNING value",[refreshKey,now()+120,now()-interval]).first();
  if(!lease)return;
  const diagnostic={sport,checked_at:now(),espn_events:0,provider_events:0,matched_events:0,quotes:0,leagues:[],rejections:{},events:{},reason:null};
  let stage='ESPN scoreboard';
  try{
   const url='https://site.api.espn.com/apis/site/v2/sports/'+path+'/scoreboard?'+new URLSearchParams(sport==='college'?{groups:'80',limit:'1000'}:{limit:'1000'});
   const board=await get(url);if(!Array.isArray(board.events))throw Error('Invalid ESPN scoreboard response');
   const events=espnEvents(board,sport,url);diagnostic.espn_events=events.length;
   for(const event of events){
    await prepare(db,'INSERT INTO sb_events VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET matchup=excluded.matchup,starts_at=excluded.starts_at,state=excluded.state,source_at=excluded.source_at,payload=excluded.payload',Object.values(event)).run();
    diagnostic.events[event.id]={markets:{},reason:['scheduled','live'].includes(event.state)?'No matching Odds-API.io event with both teams and kickoff within 3 minutes':'ESPN event is '+event.state};
   }
   if(!events.length)throw Error('ESPN returned no games for this scoreboard date');
   const activeFallback=events.filter(e=>['scheduled','live'].includes(e.state));const fallbackTargets=selectedEvent?activeFallback.filter(e=>e.id===selectedEvent):activeFallback.sort((a,b)=>Number(b.state==='live')-Number(a.state==='live')||a.starts_at-b.starts_at).slice(0,3);
   for(const event of fallbackTargets){const fresh=await one(db,'SELECT 1 found FROM sb_quotes WHERE event_id=? AND suspended=0 AND expires_at>? LIMIT 1',[event.id,now()+3]);if(!fresh)await espnFallback(env,event,diagnostic)}
   stage='Odds-API.io';
   const cooldown=await one(db,"SELECT value FROM sb_config WHERE key='provider_retry_until'");if(cooldown?.value>now()){diagnostic.provider_retry_until=cooldown.value;throw Error('Odds-API.io is rate limited; retry after '+new Date(cooldown.value*1000).toISOString())}if(!env.ODDS_API_IO_KEY)throw Error('Odds-API.io key is not configured');
   if(env.SB_ODDS_AUTHORIZED!=='1')throw Error('Odds-API.io market usage authorization is not enabled');
   const active=events.filter(e=>['scheduled','live'].includes(e.state));
   const wanted=selectedEvent?active.filter(e=>e.id===selectedEvent):active.slice(0,3);
   if(!wanted.length)throw Error('The selected ESPN game is not open for picks');
   const providerLease=await prepare(db,"INSERT INTO sb_config(key,value) VALUES('provider_refresh_budget',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE value<=? RETURNING value",[now()+45,now()]).first();
   if(!providerLease){const previous=await one(db,'SELECT payload FROM sb_feed_diagnostics WHERE sport=?',[sport]);if(previous){const saved=JSON.parse(previous.payload);diagnostic.matched_events=saved.matched_events||0;diagnostic.leagues=saved.leagues||[];diagnostic.mapping_cache=true}throw Error('Shared provider refresh is already scheduled; ESPN fallback is checked separately')}
   let matches=[];const missing=[];
   for(const event of wanted){
    const mapping=await one(db,'SELECT value FROM sb_config WHERE key=?',['provider_map_id:'+event.id]);
    const mappedAt=await one(db,'SELECT value FROM sb_config WHERE key=?',['provider_map_time:'+event.id]);
    if(mapping&&mappedAt?.value>now()-86400){const teams=JSON.parse(event.payload).teams;matches.push({providerId:String(mapping.value),event,cached:true,offer:{home:teams.home,away:teams.away,date:new Date(event.starts_at*1000).toISOString()}})}else missing.push(event.id);
   }
   if(missing.length){
    stage='Odds-API.io league mapping';diagnostic.leagues=await leaguesFor(sport,apiSport,league,env.ODDS_API_IO_KEY);
    stage='Odds-API.io events';const providerById=new Map();
    for(const slug of diagnostic.leagues){
     for(let skip=0;skip<5000;skip+=1000){
      const params=new URLSearchParams({apiKey:env.ODDS_API_IO_KEY,sport:apiSport,league:slug,limit:'1000',skip:String(skip)});
      const rows=await get('https://api.odds-api.io/v3/events?'+params);if(!Array.isArray(rows))throw Error('Invalid provider events response');
      for(const row of rows)providerById.set(String(row.id),row);if(rows.length<1000)break;
     }
    }
    const providerEvents=[...providerById.values()];diagnostic.provider_events=providerEvents.length;
    if(!providerEvents.length)throw Error('Provider returned no events for '+diagnostic.leagues.join(', '));
    const candidates=[];
    for(const offer of providerEvents){const found=active.filter(e=>eventMatches(offer,e));if(found.length===1)candidates.push({providerId:String(offer.id),event:found[0],offer})}
    const unique=candidates.filter(m=>candidates.filter(x=>x.event.id===m.event.id).length===1);
    for(const item of unique){
     const numeric=Number(item.providerId);if(Number.isSafeInteger(numeric)&&numeric>0)await db.batch([prepare(db,'INSERT INTO sb_config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',['provider_map_id:'+item.event.id,numeric]),prepare(db,'INSERT INTO sb_config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',['provider_map_time:'+item.event.id,now()])]);
     if(missing.includes(item.event.id))matches.push(item);
    }
   }else{diagnostic.leagues=[league];diagnostic.mapping_cache=true;}
   diagnostic.matched_events=matches.length;
   stage='Odds-API.io market snapshots';
   for(let i=0;i<matches.length;i+=10){
    const group=matches.slice(i,i+10),q=new URLSearchParams({apiKey:env.ODDS_API_IO_KEY,eventIds:group.map(m=>m.providerId).join(','),bookmakers:'DraftKings,FanDuel'});
    const snapshots=await get('https://api.odds-api.io/v3/odds/multi?'+q);
    if(!Array.isArray(snapshots))throw Error('Invalid provider odds response');
    for(const match of group){
     const detail=diagnostic.events[match.event.id],snapshot=snapshots.find(s=>String(s.id)===match.providerId);
     const commands=[prepare(db,"UPDATE sb_quotes SET suspended=1 WHERE event_id=? AND source LIKE 'Odds-API.io / %'",[match.event.id])];
     let quotes=[];const reasons={};
     if(/settled|completed|finished|final|cancelled|canceled|suspended|postponed/i.test(String(match.offer.status||'')))detail.reason='Provider event is '+match.offer.status;
     else if(!snapshot)detail.reason='Provider returned no odds snapshot for matched event';
     else if(!eventMatches(match.cached?snapshot:{...match.offer,...snapshot},match.event)){detail.reason='Provider snapshot teams or kickoff do not match ESPN';if(match.cached)commands.push(prepare(db,'DELETE FROM sb_config WHERE key IN (?,?)',['provider_map_id:'+match.event.id,'provider_map_time:'+match.event.id]));}
     else if(/settled|completed|finished|final|cancelled|canceled|suspended|postponed/i.test(String(snapshot.status||'')))detail.reason='Provider snapshot is '+snapshot.status;
     else{
      quotes=offers(snapshot,match.event,env,reasons);
      detail.reason=quotes.length?null:Object.keys(reasons).join('; ')||'DraftKings/FanDuel returned no supported moneyline, spread or total prices';
      for(const quote of quotes){
       detail.markets[quote.market]=(detail.markets[quote.market]||0)+1;
       commands.push(prepare(db,'INSERT INTO sb_quotes VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET suspended=0,received_at=excluded.received_at,expires_at=excluded.expires_at,closes_at=excluded.closes_at',Object.values(quote)));
      }
     }
     detail.rejections=reasons;
     for(const [reason,count] of Object.entries(reasons))diagnostic.rejections[reason]=(diagnostic.rejections[reason]||0)+count;
     diagnostic.quotes+=quotes.length;await db.batch(commands);
    }
   }
   if(!diagnostic.quotes)diagnostic.reason=Object.keys(diagnostic.rejections).join('; ')||(!matches.length?'No unambiguous provider/ESPN event match':'Matched games have no supported available markets');
  }catch(error){if(error.status===429&&error.provider==='Odds-API.io'){diagnostic.provider_retry_until=error.retryAt;diagnostic.provider_rate_limit={limit:error.rateLimit,remaining:error.rateRemaining,reset:error.rateReset};await prepare(db,"INSERT INTO sb_config(key,value) VALUES('provider_retry_until',?) ON CONFLICT(key) DO UPDATE SET value=max(value,excluded.value)",[error.retryAt]).run()}diagnostic.reason=diagnostic.fallback_quotes?'ESPN fallback active. '+stage+': '+error.message:stage+': '+(error.name==='TimeoutError'?'request timed out':error.message);}
  await prepare(db,'INSERT INTO sb_feed_diagnostics(sport,payload) VALUES(?,?) ON CONFLICT(sport) DO UPDATE SET payload=excluded.payload',[sport,JSON.stringify(diagnostic)]).run();
  await prepare(db,'UPDATE sb_config SET value=? WHERE key=?',[now(),refreshKey]).run();
 }));
 // Final-result lookups share a separate lease; selecting a sport must not fan out settlement requests every ten seconds.
 const resultsLease=await prepare(db,"INSERT INTO sb_config(key,value) VALUES('result_refresh',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE value<? RETURNING value",[now(),now()-60]).first();
 if(resultsLease)await refreshResults(env);
}
export async function refreshResults(env){const db=env.DB;const pending=await all(db,`SELECT DISTINCT e.* FROM sb_events e JOIN sb_picks p ON p.event_id=e.id WHERE p.status='pending' OR e.starts_at>? LIMIT 12`,[now()-7*86400]);for(const e of pending){try{const path=sports[e.sport][0],rawId=e.id.split(':')[1],summaryUrl='https://site.api.espn.com/apis/site/v2/sports/'+path+'/summary?event='+rawId;const summary=await get(summaryUrl);if(String(summary.header?.id)!==rawId)continue;const comp=summary.header.competitions?.[0],status=comp?.status?.type;if(!comp||!status)continue;const details=JSON.parse(e.payload),teams=Object.fromEntries(comp.competitors.map(t=>[t.homeAway,t.team?.displayName]));if(norm(teams.home)!==norm(details.teams.home)||norm(teams.away)!==norm(details.teams.away))continue;let result=null;if(status.completed===true&&status.state==='post'){const date=new Date(e.starts_at*1000).toISOString().slice(0,10).replaceAll('-','');const board=await get('https://site.api.espn.com/apis/site/v2/sports/'+path+'/scoreboard?dates='+date);const other=board.events?.find(x=>String(x.id)===rawId);if(other?.status?.type?.completed!==true)continue;const scores=Object.fromEntries(comp.competitors.map(t=>[t.homeAway,Number(t.score)])),second=Object.fromEntries((other.competitions?.[0]?.competitors||[]).map(t=>[t.homeAway,Number(t.score)]));if(!['home','away'].every(k=>Number.isFinite(scores[k])&&scores[k]===second[k]))continue;result={state:'final',scores,verification:'ESPN scoreboard and summary agree'};const half={};for(const t of comp.competitors){const lines=t.linescores;if(Array.isArray(lines)&&lines.length>=2&&lines.slice(0,2).every(x=>Number.isFinite(x.value)))half[t.homeAway]=lines[0].value+lines[1].value}if(Object.keys(half).length===2)result.first_half=half;
 // Props settle only from explicit final box-score statistics, never name-based guesses.
 const props={};for(const group of summary.boxscore?.players||[])for(const category of group.statistics||[])for(const athlete of category.athletes||[]){const name=athlete.athlete?.displayName;if(!name)continue;const statMap={};(category.keys||category.names||[]).forEach((key,i)=>statMap[key]=athlete.stats?.[i]);const mapping={passingYards:'passing:yards',rushingYards:'rushing:yards',receivingYards:'receiving:yards',receptions:'receiving:receptions',points:'basketball:points',rebounds:'basketball:rebounds',totalRebounds:'basketball:rebounds',assists:'basketball:assists'};for(const [stat,value] of Object.entries(statMap)){const canonical=mapping[stat],number=Number(value);if(canonical&&value!=null&&value!==''&&typeof value!=='boolean'&&Number.isFinite(number))props[name+'|'+canonical]={participated:athlete.didNotPlay!==true,value:number}}}if(Object.keys(props).length)result.props=props;
 }else{const name=String(status.name).toLowerCase();for(const state of ['cancelled','postponed','abandoned'])if(name.includes(state))result={state,verification:'ESPN terminal event status'}}
 if(!result)continue;await db.batch([prepare(db,'UPDATE sb_events SET state=?,source_at=? WHERE id=?',[result.state,now(),e.id]),prepare(db,'UPDATE sb_quotes SET suspended=1 WHERE event_id=?',[e.id])]);await settle(db,e.id,result,summaryUrl);
 }catch{/* Missing or conflicting final data stays pending. */}}}

// Public sports prices only. This never reads or returns member/account records.
export async function publicMarkets(env,sport,selectedEvent=''){
 await ensureEspnPrices(env,sport,selectedEvent);
 if(!env.DB)return {quotes:[],reason:'Persistent market database unavailable'};
 const schedule=await all(env.DB,'SELECT * FROM sb_events WHERE sport=? AND starts_at>? AND starts_at<? ORDER BY starts_at LIMIT 1000',[sport,now()-86400,now()+8*86400]);const events=schedule.map(e=>({...e,details:JSON.parse(e.payload)}));
 const row=await one(env.DB,'SELECT payload FROM sb_feed_diagnostics WHERE sport=?',[sport]);
 const diagnostic=row?JSON.parse(row.payload):null;
 if(env.SB_ODDS_AUTHORIZED!=='1')return {quotes:[],events,server_time:now(),reason:'Provider market usage authorization is not enabled'};
 const rows=await all(env.DB,"SELECT q.*,e.sport,e.matchup,e.state AS event_state,e.starts_at AS event_start,e.source_at AS event_checked FROM sb_quotes q JOIN sb_events e ON e.id=q.event_id WHERE e.sport=? AND q.market IN ('moneyline','spread','total') AND q.suspended=0 AND q.expires_at>? ORDER BY e.starts_at,q.source,q.market LIMIT 4000",[sport,now()]);
 const quotes=rows.filter(q=>!quoteReason(q,{state:q.event_state,starts_at:q.event_start,source_at:q.event_checked})&&(!q.live||env.SB_LIVE_ODDS_AUTHORIZED==='1')).map(q=>({id:q.id,event_id:q.event_id,sport:q.sport,event:q.matchup,market:q.market,selection:q.selection,odds:q.odds,side:q.side,line:q.line,period:q.period,subject:q.subject,source:q.source,source_at:q.source_at,received_at:q.received_at,expires_at:q.expires_at}));
 const retry=await one(env.DB,"SELECT value FROM sb_config WHERE key='provider_retry_until'");return {quotes,events,retry_at:retry?.value>now()?retry.value:null,server_time:now(),checked_at:diagnostic?.checked_at,reason:quotes.some(q=>q.source.startsWith('ESPN '))&&retry?.value>now()?'Prices supplied by ESPN while the primary odds feed recovers.':retry?.value>now()?'Odds-API.io is rate limited. Next provider check after '+new Date(retry.value*1000).toLocaleTimeString('en-US',{timeZone:'America/New_York'})+' Eastern.':quotes.length?null:diagnostic?.reason||'No confirmed active markets for this sport. Sign in to view each game’s availability details.'};
}
