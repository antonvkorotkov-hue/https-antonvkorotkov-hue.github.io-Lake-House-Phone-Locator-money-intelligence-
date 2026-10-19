const fs=require('node:fs');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only'});
dom.window.eval(fs.readFileSync('analytics.js','utf8'));
const render=dom.window.LHAnalytics.render;
const away={id:'1',displayName:'Away Team',abbreviation:'AWY'},home={id:'2',displayName:'Home Team',abbreviation:'HME'};
const event={id:'test-game',competitions:[{neutralSite:false,competitors:[{homeAway:'away',team:away},{homeAway:'home',team:home}]}]};
const report={header:{id:'test-game'},gameInfo:{venue:{fullName:'Verified Stadium'},weather:{temperature:0,temperatureUnit:'F',displayValue:'Snow'}},boxscore:{teams:[{team:away,statistics:[{name:'totalYards',label:'Total Yards',displayValue:'122'},{name:'thirdDownEff',label:'Third Down',displayValue:'3-8'}]},{team:home,statistics:[{name:'totalYards',label:'Total Yards',displayValue:'244'},{name:'thirdDownEff',label:'Third Down',displayValue:'5-10'}]}],players:[{team:away,statistics:[{name:'passing',text:'Passing',labels:['C/ATT','YDS'],athletes:[{athlete:{displayName:'Verified QB'},stats:['11/22','60']}]}]}]},injuries:[{team:away,injuries:[{athlete:{displayName:'Verified Injury'},status:'Questionable',details:{type:'Knee'}}]}],leaders:[{team:away,leaders:[{displayName:'Passing',leaders:[{athlete:{displayName:'Verified QB'},displayValue:'60 YDS'}]}]}]};
for(const sport of ['nfl','college','nba','mlb']){
 const html=render(report,event,sport,{fetchedAt:'2026-10-19T21:00:00Z'});dom.window.document.body.innerHTML=html;
 const text=dom.window.document.body.textContent;
 for(const expected of ['Verified Stadium','Away Team','Home Team','122','244','3-8','5-10','Verified QB','Verified Injury','Questionable','Snow','Temperature: 0 F','Retrieved'])assert(text.includes(expected),sport+' renders '+expected);
 assert(!/NaN|undefined|Invalid Date/.test(text));
 assert(html.includes('<table>'),'Data tables retain nonnumeric statistics');
 assert(!/guaranteed|healthy|points advantage/i.test(text),'No inferred player status or artificial advantage');
}
assert.match(render(null,event,'nfl'),/Loading/);
assert.match(render({error:'HTTP 503'},event,'nfl'),/HTTP 503/);
assert(!/No verified injury list/.test(render({error:'HTTP 503'},event,'nfl')),'Request failure is not presented as an empty verified injury list');
assert.match(render({...report,header:{id:'another-game'}},event,'nfl'),/does not match/);
const hostile=structuredClone(report);hostile.gameInfo.venue.fullName='<img src=x onerror=alert(1)>';
assert(render(hostile,event,'nfl').includes('&lt;img'),'Source fields are escaped');
const foreign=structuredClone(report);foreign.injuries.push({team:{id:'999',displayName:'Unrelated Team'},injuries:[{athlete:{displayName:'Wrong Player'},status:'Out'}]});foreign.boxscore.players.push({team:{id:'999'},statistics:[{name:'passing',labels:['YDS'],athletes:[{athlete:{displayName:'Wrong QB'},stats:['999']}]}]});
assert(!/Wrong Player|Wrong QB|Unrelated Team/.test(render(foreign,event,'nfl')),'Reject foreign team players and injuries');
dom.window.close();console.log('PASS: analytics across 4 sports; teams, weather, nonnumeric stats, QB/player rows, injuries, timestamps, wrong-event/team rejection, error/loading and escaping.');
