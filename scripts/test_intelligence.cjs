const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><body>',{runScripts:'outside-only'});dom.window.eval(fs.readFileSync('intelligence.js','utf8'));
const {analyze,render}=dom.window.LHIntelligence;
const now=Date.parse('2026-10-19T22:00:00Z'),time=new Date(now-60000).toISOString();
const home={id:'1',displayName:'Home Team'},away={id:'2',displayName:'Away Team'};
const quote={provider:{name:'Source Book'},moneyline:{home:{close:{odds:'-150'}},away:{close:{odds:'+130'}}},pointSpread:{home:{close:{line:'-3.5'}}},overUnder:47.5};
const event={id:'verified-game',status:{type:{state:'in',detail:'In progress'},period:2,displayClock:'5:12'},competitions:[{neutralSite:false,competitors:[{homeAway:'home',team:home,score:'10'},{homeAway:'away',team:away,score:'7'}],odds:[quote]}]};
const report={header:{id:event.id},gameInfo:{venue:{fullName:'Source Stadium'},weather:{displayValue:'Clear'}},boxscore:{teams:[{team:home,statistics:[{name:'totalYards',label:'Total yards',displayValue:'200'}]},{team:away,statistics:[{name:'totalYards',label:'Total yards',displayValue:'100'}]}],players:[{team:home,statistics:[{name:'passing',labels:['YDS'],athletes:[{athlete:{displayName:'Verified Quarterback'},stats:['150']}]}]}]},injuries:[{team:away,injuries:[{athlete:{displayName:'Injured Player'},status:'Questionable'}]}],lineups:[{confirmed:true,team:home,players:[{athlete:{displayName:'Confirmed Starter'},position:{abbreviation:'QB'}}]},{confirmed:false,team:away,players:[{athlete:{displayName:'Unconfirmed Player'}}]}],scoringPlays:[{homeScore:null,awayScore:0},{homeScore:0,awayScore:7,period:{number:1},clock:{displayValue:'10:00'},text:'Away touchdown'},{homeScore:3,awayScore:7,period:{number:1},text:'Home field goal'},{homeScore:3,awayScore:7,text:'Duplicate'},{homeScore:10,awayScore:7,period:{number:2},wallclock:time,text:'Home touchdown'}]};
const meta={now,fetchedAt:time,quote,quoteObservedAt:time};
for(const sport of ['nfl','college','nba','mlb']){
 const a=analyze(report,event,sport,meta),html=render(report,event,sport,meta);
 assert(a.recommendation.startsWith('PASS'),'No independent calibrated edge, even with substantial source facts');
 assert(html.includes('Independent winner forecast unavailable'),'Absent predictor cannot be replaced with bookmaker favorite as forecast');
 assert(html.includes('Bookmaker market favorite:'),'Market leader is shown separately from independent prediction');
 assert(html.includes('Matchup evidence'),'Decision includes descriptive matchup evidence');
 assert(html.includes('On-field comparison'),'Verified team comparison surfaced beside verdict');
 assert(html.includes('Observed evidence is descriptive'),'No inferred wagering edge from bare statistics');
 assert(a.projection.includes('unavailable'),'No invented score forecast/range');assert.equal(a.observedMarket.provider,'Source Book');
 assert.equal(a.observedMarket.sourceTime,null,'Retrieval time is not a source update time');assert.equal(a.quotes.length,0,'Recent retrieval does not establish current executable quote');
 assert(Math.abs(a.observedMarket.favorite.homeProbability+a.observedMarket.favorite.awayProbability-1)<1e-12);
 assert(Math.abs(a.observedMarket.favorite.homeProbability-(.6/(.6+100/230)))<1e-12,'No-vig arithmetic uses paired same-provider prices');
 assert.equal(a.scoring.length,3,'No fake initial zero, null-score or duplicate observations');
 assert.equal(a.lineups.length,1,'Only explicitly confirmed lineup');assert.equal(a.lineups[0].name,'Confirmed Starter');
 assert.equal(a.injuries[0].status,'Questionable');assert.equal(a.comparisons[0].leftValue,'200');
 assert(html.includes('not calibrated outcome probabilities'));assert(html.includes('not verified current pricing or our prediction'));assert(html.includes('source update unknown'));
 assert(!html.includes('<polyline'),'Scoring dots do not invent unobserved transitions');assert(!/NaN|undefined|Invalid Date/.test(html));
 if(sport==='mlb')assert.equal(a.observedMarket.score,null,'Baseball run line is not a full-game score forecast');
 else{assert.equal(a.observedMarket.score.home,25.5);assert.equal(a.observedMarket.score.away,22);assert(html.includes('Not our forecast, not a range'));assert(!html.includes('Home Team 35.5'),'Existing live score is not added to full-game total');}
}
const fresh={eventId:event.id,provider:'Verified Source',liveVerified:true,observedAt:time,homeAmerican:-150,awayAmerican:130};
assert.equal(analyze(report,event,'nfl',{...meta,verifiedQuotes:[fresh]}).quotes.length,1);
assert(analyze(report,event,'nfl',{...meta,verifiedQuotes:[fresh]}).recommendation.startsWith('PASS'),'Current prices alone still cannot justify a recommendation');
for(const change of [{eventId:'wrong-game'},{liveVerified:false},{observedAt:new Date(now-300001).toISOString()},{observedAt:new Date(now+1).toISOString()},{observedAt:null},{homeAmerican:null},{awayAmerican:0},{provider:''}])assert.equal(analyze(report,event,'nfl',{...meta,verifiedQuotes:[{...fresh,...change}]}).quotes.length,0,'Reject invalid verified quote '+JSON.stringify(change));
assert.equal(analyze(report,event,'nfl',{...meta,quote:structuredClone(quote)}).observedMarket,null,'Unmatched detached provider quote rejected');
assert.equal(analyze(report,event,'nfl',{...meta,quote:{...quote,eventId:'wrong-game'}}).observedMarket,null,'Wrong-event provider quote rejected');
assert.equal(analyze({...report,header:{id:'wrong-game'}},event,'nfl',meta).observedMarket,null,'Wrong summary withholds market analysis');
const absent=analyze({},event,'nfl',{});assert(absent.recommendation.startsWith('PASS'));assert.equal(absent.observedMarket,null);assert.equal(absent.scoring.length,0);
assert(!render(null,event,'nfl',{}).includes('<svg'),'Missing report cannot create a graph');
const one=render({...report,scoringPlays:[report.scoringPlays[1]]},event,'nfl',meta);assert(one.includes('One recorded scoring play'));assert(!one.includes('<polyline'));
const foreign=structuredClone(report);foreign.injuries.push({team:{id:'foreign'},injuries:[{athlete:{displayName:'Foreign Injury'},status:'Out'}]});assert(!render(foreign,event,'nfl',meta).includes('Foreign Injury'));
const hostile=structuredClone(report);hostile.gameInfo.venue.fullName='<img src=x onerror=alert(1)>';assert(render(hostile,event,'nfl',meta).includes('&lt;img'));
const pregame=structuredClone(event);pregame.status.type={state:'pre',detail:'Scheduled'};pregame.competitions[0].competitors.forEach(t=>t.score='0');
const pre=analyze(report,pregame,'nfl',{});assert.equal(pre.home.score,'');assert.equal(pre.away.score,'');assert.equal(pre.players.length,0);assert.equal(pre.comparisons.length,0);assert.equal(pre.scoring.length,0);assert(pre.missing.some(t=>t.includes('season statistics')),'Pregame season fields are not game-performance facts');
assert.equal(pre.clock,'','Pregame source placeholder clock is withheld');
assert.equal(analyze(report,event,'nfl',meta).clock,'5:12','Live football clock retained verbatim');
assert.equal(analyze(report,event,'college',meta).clock,'5:12','Live college football clock retained verbatim');
const completed=structuredClone(event);completed.status.type={state:'post',detail:'Final'};completed.status.displayClock='0:00';
assert.equal(analyze(report,completed,'nfl',meta).clock,'','Final-game placeholder clock withheld');
assert.equal(analyze(report,event,'mlb',meta).clock,'','Baseball has no football-style running clock');
const stale=analyze(report,event,'nfl',{...meta,fetchedAt:new Date(now-300001).toISOString()});assert.equal(stale.fresh,false);assert(stale.missing.some(t=>t.includes('stale')));assert(!stale.facts.some(t=>t.startsWith('Recent observed scoring window')));
assert.equal(analyze(report,event,'nfl',{...meta,fetchedAt:now-60000}).fresh,true,'Numeric retrieval milliseconds supported');
const future=analyze(report,event,'nfl',{...meta,fetchedAt:now+1});assert(!future.fresh);assert(future.missing.some(t=>t.includes('future')));
const error=render({error:'HTTP 503'},event,'nfl',meta);assert(error.includes('HTTP 503'),'Summary source failure is visible');
const rich=structuredClone(report);rich.gameInfo.weather={temperature:0,temperatureUnit:'F',wind:'5 mph'};
rich.lastFiveGames=[{team:home,events:[{gameResult:'W',gameDate:'2026-10-18T20:00:00Z',score:'24-17',opponent:{abbreviation:'OPP'}},{gameResult:'L',gameDate:'2027-01-01T20:00:00Z',score:'0-99'}]},{team:{id:'foreign'},events:[{gameResult:'W',gameDate:time,score:'999'}]}];
rich.drives={previous:[{team:home,displayResult:'Touchdown',yards:75,offensivePlays:8},{team:{id:'foreign'},displayResult:'Foreign Drive'}]};rich.rosters=[{team:away,roster:[{starter:true,athlete:{displayName:'Roster Starter'}},{athlete:{displayName:'Appearance Only'}}]}];
const enriched=analyze(rich,event,'nfl',meta);assert(enriched.facts.some(t=>t.includes('Temperature 0 F')));assert.equal(enriched.history.length,1);assert(!enriched.history[0].includes('0-99'),'Future history rejected');assert.equal(enriched.drives.length,1);assert(!render(rich,event,'nfl',meta).includes('Foreign Drive'));assert(enriched.lineups.some(p=>p.name==='Roster Starter'));assert(!enriched.lineups.some(p=>p.name==='Appearance Only'));
const noIdsEvent=structuredClone(event),noIdsReport=structuredClone(report);noIdsEvent.competitions[0].competitors.forEach(c=>delete c.team.id);
for(const group of [...noIdsReport.boxscore.teams,...noIdsReport.boxscore.players,...noIdsReport.injuries,...noIdsReport.lineups])delete group.team.id;
const noIds=analyze(noIdsReport,noIdsEvent,'nfl',meta);for(const key of ['comparisons','players','injuries','lineups'])assert.equal(noIds[key].length,0,'Missing team identities withhold unscoped '+key);
assert.equal(analyze({},null,'nfl',{quote:structuredClone(quote)}).observedMarket,null,'No selected game cannot accept a detached quote');
assert.equal(analyze({},null,'nfl',{now,verifiedQuotes:[{...fresh,eventId:''}]}).quotes.length,0,'Empty event identity cannot qualify a current quote');
const savedSources=JSON.parse(fs.readFileSync('scoreboards.json','utf8')),coverage={};
for(const sport of ['nfl','college','nba','mlb']){
 coverage[sport]=0;
 for(const game of savedSources.sports[sport].events){
  const saved=savedSources.reports?.[sport+':'+game.id];if(!saved?.report)continue;
  const result=analyze(saved.report,game,sport,{fetchedAt:saved.collected_at,quote:game.competitions?.[0]?.odds?.[0],quoteObservedAt:savedSources.sports[sport].collected_at});
  assert.equal(result.mismatch,false,'Saved report matches '+sport+' '+game.id);assert(result.recommendation.startsWith('PASS'),'Real-source data alone is not a validated betting edge');assert.equal(result.quotes.length,0,'Real retrieved closing fields do not qualify as live verified prices');
  if(result.observedMarket)assert.equal(result.observedMarket.sourceTime,null,'Unknown actual provider update time remains unknown');
  assert(!/NaN|undefined|Invalid Date/.test(render(saved.report,game,sport,{fetchedAt:saved.collected_at})),sport+' real-source rendering has no invalid values');
  const selectedNames=new Set(game.competitions[0].competitors.map(t=>t.team.displayName||t.team.shortDisplayName||t.team.name));
  for(const person of [...result.players,...result.injuries,...result.lineups])assert(selectedNames.has(person.team),'Real-source player/team mapping '+person.team);
  coverage[sport]++;
 }
 assert(coverage[sport]>0,'At least one saved real-source report available for '+sport+'; missing evidence must be recorded as a release blocker');
}
console.log('Real-source intelligence coverage:',JSON.stringify(coverage),'MLB has only the available source matchup; no extra game invented.');
// Published ESPN estimates are distinct from market arithmetic and our own forecasts.
const forecastEvent=structuredClone(pregame),forecastReport=structuredClone(report);
forecastReport.predictor={header:'Matchup Predictor',homeTeam:{id:'1',gameProjection:'60'},awayTeam:{id:'2',gameProjection:'40'}};
const forecastMeta={...meta,quote:forecastEvent.competitions[0].odds[0]};
const published=analyze(forecastReport,forecastEvent,'nfl',forecastMeta);
assert.equal(published.predictor.homePercentage,60);assert.equal(published.predictor.awayPercentage,40);assert.equal(published.predictor.likelySide,'Home Team');assert.equal(published.predictor.sourceTime,null,'Unknown predictor update time is never inferred from retrieval');assert(published.predictor.source.includes('ESPN'));assert(published.recommendation.startsWith('PASS'),'Published predictor and matching market favorite do not establish an independent edge');
const publishedHtml=render(forecastReport,forecastEvent,'nfl',forecastMeta);assert(publishedHtml.includes('60'));assert(publishedHtml.includes('40'));assert(/agreement|disagreement|not.*edge/i.test(publishedHtml),'Market/model comparison is not marketed as an edge');
for(const pair of [[{id:'2',gameProjection:'60'},{id:'1',gameProjection:'40'}],[{id:'foreign',gameProjection:'60'},{id:'2',gameProjection:'40'}],[{id:'1',gameProjection:'101'},{id:'2',gameProjection:'-1'}],[{id:'1',gameProjection:'60'},{id:'2',gameProjection:'60'}],[{id:'1',gameProjection:''},{id:'2',gameProjection:'40'}],[{id:'1',gameProjection:null},{id:'2',gameProjection:'40'}]])assert.equal(analyze({...forecastReport,predictor:{homeTeam:pair[0],awayTeam:pair[1]}},forecastEvent,'nfl',forecastMeta).predictor,null,'Invalid/mismatched predictor pair rejected');
for(const fetchedAt of [now-300001,now+1,null])assert.equal(analyze(forecastReport,forecastEvent,'nfl',{...forecastMeta,fetchedAt}).predictor,null,'Stale/future/unknown report cannot be presented as fresh pregame estimate');
assert.equal(analyze(forecastReport,event,'nfl',forecastMeta).predictor,null,'Pregame predictor withheld during live play');assert.equal(analyze(forecastReport,completed,'nfl',forecastMeta).predictor,null,'Pregame predictor withheld after game');assert.equal(analyze({...forecastReport,header:{}},forecastEvent,'nfl',forecastMeta).predictor,null,'Predictor needs explicit source event identity');
const rounding=analyze({...forecastReport,predictor:{homeTeam:{id:'1',gameProjection:'87'},awayTeam:{id:'2',gameProjection:'12.9'}}},forecastEvent,'nfl',forecastMeta);assert.equal(rounding.predictor.homePercentage,87);assert.equal(rounding.predictor.awayPercentage,12.9,'Rounded source percentages are not rescaled');
for(const extra of [{tieProbability:1},{drawChance:1},{tieTeam:{gameProjection:'1'}}])assert.equal(analyze({...forecastReport,predictor:{...forecastReport.predictor,...extra}},forecastEvent,'nfl',forecastMeta).predictor,null,'Two-way display cannot omit a separately published positive tie/draw outcome');
let predictorCount=0;const predictorCoverage={};
for(const sport of ['nfl','college','nba','mlb']){
 predictorCoverage[sport]=0;
 for(const game of savedSources.sports[sport].events){const saved=savedSources.reports?.[sport+':'+game.id];if(!saved?.report?.predictor)continue;
  const instant=Date.parse(saved.collected_at),actual=analyze(saved.report,game,sport,{fetchedAt:saved.collected_at,now:instant});
  assert(actual.predictor,'Real-source predictor is shown only with valid role IDs/percentages at its observed retrieval instant');assert.equal(actual.predictor.homePercentage,Number(saved.report.predictor.homeTeam.gameProjection));assert.equal(actual.predictor.awayPercentage,Number(saved.report.predictor.awayTeam.gameProjection));assert(actual.recommendation.startsWith('PASS'));assert.equal(actual.predictor.sourceTime,null);predictorCount++;predictorCoverage[sport]++;
 }
 assert(predictorCoverage[sport]>0,'Actual published predictor coverage exists for '+sport);
}
assert(predictorCount>=9,'Nine actual saved published predictor reports checked');console.log('Real-source published predictor coverage:',JSON.stringify(predictorCoverage));
dom.window.close();console.log('PASS: intelligence four sports; source facts vs estimates; same-provider odds arithmetic; missing/stale/future/wrong-event quote guards; conservative PASS; scoring/lineup integrity and escaping.');
