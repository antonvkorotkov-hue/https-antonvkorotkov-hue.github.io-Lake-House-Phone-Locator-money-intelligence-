/* Verified ESPN report presentation. No inferred injuries, forecasts or market data. */
(function(global){
'use strict';
const arr=v=>Array.isArray(v)?v:[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=t=>t?.displayName||t?.shortDisplayName||t?.name||'Team not supplied';
const missing=t=>'<p class="lh-a-missing">'+esc(t)+'</p>';
const panel=(title,body)=>'<section class="lh-a-panel"><h2>'+esc(title)+'</h2>'+body+'</section>';
function numeric(s){const v=String(s?.displayValue??'').trim();return /^-?\d+(?:\.\d+)?%?$/.test(v)?Number(v.replace('%','')):null}
function when(v){if(!v)return '';const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString():''}
function render(report,event,sport,meta){
 meta=meta||{};
 if(!event&&!report)return panel('Game analytics',missing('Select a verified game to view its report.'));
 if(!report)return panel('Game analytics',missing('Loading ESPN game statistics and availability…'));
 if(report.error)return panel('Game analytics',missing('ESPN report unavailable: '+report.error+'. Refresh to retry.'));
 const comp=arr(event?.competitions)[0]||arr(report.header?.competitions)[0]||{};
 const competitors=arr(comp.competitors);const ids=new Set(competitors.map(c=>String(c.team?.id||c.id)).filter(Boolean));
 const reportComp=arr(report.header?.competitions)[0];
 if(event?.id&&report.header?.id&&String(event.id)!==String(report.header.id))return panel('Game analytics',missing('Report does not match the selected game. Refresh to load the correct report.'));
 const validTeam=t=>!ids.size||ids.has(String(t?.id));
 const source='<p class="lh-a-source">Source: ESPN game summary'+(when(meta.fetchedAt||meta.loadedAt||meta.reportLoadedAt)?' · Retrieved '+esc(when(meta.fetchedAt||meta.loadedAt||meta.reportLoadedAt)):' · Retrieval timestamp not supplied')+'. Report for this event; before play, some leader fields can describe season totals. Availability may change.</p>';
 const venue=report.gameInfo?.venue||comp.venue||{};
 let context='<dl class="lh-a-facts"><div><dt>Venue</dt><dd>'+esc(venue.fullName||'Not supplied')+'</dd></div>';
 competitors.forEach(c=>{context+='<div><dt>'+esc(c.homeAway==='home'?'Home team':c.homeAway==='away'?'Away team':'Team')+'</dt><dd>'+esc(name(c.team))+'</dd></div>'});
 context+='<div><dt>Indoor venue</dt><dd>'+esc(venue.indoor===true?'Yes':venue.indoor===false?'No':'Not supplied')+'</dd></div>';
 context+='<div><dt>Site</dt><dd>'+esc(comp.neutralSite===true?'Neutral venue':comp.neutralSite===false?'Home venue':'Neutral-site status not supplied')+'</dd></div></dl>';
 context+='<p>Venue context is shown without assigning an unsupported home-field points adjustment.</p>'+competitors.map(c=>{const records=arr(c.records).map(r=>esc(r.name||r.type||"Record")+": "+esc(r.summary||"Not supplied")).join(" · ");return records?"<p>"+esc(name(c.team))+" · Published records: "+records+"</p>":""}).join('');
 const weather=report.gameInfo?.weather||comp.weather;
 if(weather){const fields=[weather.displayValue,weather.condition,weather.temperature!=null?'Temperature: '+weather.temperature+(weather.temperatureUnit?' '+weather.temperatureUnit:' (unit not supplied)'):null,weather.wind!=null?'Wind: '+(typeof weather.wind==='object'?weather.wind.displayValue||'Not supplied':weather.wind):null].filter(Boolean);context+=fields.length?'<p>Reported weather: '+fields.map(esc).join(' · ')+'</p>':missing('Weather details were not supplied.');}else context+=missing('No verified game weather supplied.');
 const teams=arr(report.boxscore?.teams).filter(t=>validTeam(t.team));
 let stats='';
 if(teams.length>=2){const left=teams[0],right=teams[1];const byName=new Map(arr(right.statistics).map(s=>[s.name||s.label,s]));
 const pairs=arr(left.statistics).map(s=>[s,byName.get(s.name||s.label)]).filter(p=>p[1]);
 stats='<div class="lh-a-table-wrap"><table><caption>Reported team statistics · ESPN summary</caption><thead><tr><th scope="col">Statistic</th><th scope="col">'+esc(name(left.team))+'</th><th scope="col">'+esc(name(right.team))+'</th></tr></thead><tbody>'+pairs.map(([a,b])=>'<tr><th scope="row">'+esc(a.label||a.displayName||a.name)+'</th><td>'+esc(a.displayValue??'Not supplied')+'</td><td>'+esc(b.displayValue??'Not supplied')+'</td></tr>').join('')+'</tbody></table></div>';
 const preferred=sport==='nba'?/points|rebounds|assists|steals|blocks|turnovers|fieldGoalPct/i:sport==='mlb'?/hits|runs|errors|strikeouts|walks/i:/totalYards|rushingYards|netPassingYards|turnovers|firstDowns|sacks/i;
 const charts=pairs.filter(([a,b])=>preferred.test(a.name||'')&&numeric(a)!==null&&numeric(b)!==null&&numeric(a)>=0&&numeric(b)>=0).slice(0,5);
 stats+=charts.length?'<div class="lh-a-charts"><h3>Selected reported statistics</h3><p>Each pair shares a zero baseline and the same scale. Bars show reported values, not a percentage of the two teams combined.</p>'+charts.map(([a,b])=>{const x=numeric(a),y=numeric(b),max=Math.max(x,y,1);return '<figure class="lh-a-chart"><figcaption>'+esc(a.label||a.name)+'</figcaption><div class="lh-a-axis">0 — '+esc(max)+'</div>'+[[left,a,x],[right,b,y]].map(([t,s,n])=>'<div class="lh-a-bar-row"><span>'+esc(t.team?.abbreviation||name(t.team))+'</span><div class="lh-a-track"><div class="lh-a-bar" style="width:'+Math.max(0,n/max*100).toFixed(2)+'%"></div></div><strong>'+esc(s.displayValue)+'</strong></div>').join('')+'</figure>'}).join('')+'</div>':'';
 if(!pairs.length)stats=missing('ESPN did not supply matching team statistics for this game.');
 }else stats=missing('Comparable game team statistics are not available yet. No offensive or defensive rating is inferred.');
 let injuryRows=[];arr(report.injuries).filter(g=>validTeam(g.team)).forEach(g=>arr(g.injuries).forEach(i=>{const detail=[i.details?.type,i.details?.detail,i.details?.side].filter(v=>typeof v==='string').join(' · ');injuryRows.push('<li><strong>'+esc(i.athlete?.displayName||'Player not supplied')+'</strong><span>'+esc(name(g.team))+' · '+esc(i.status||i.type?.description||'Status not supplied')+(detail?' · '+esc(detail):'')+(when(i.date)?' · Updated '+esc(when(i.date)):'')+'</span></li>')}));
 const injuries=injuryRows.length?'<ul class="lh-a-list">'+injuryRows.join('')+'</ul><p>Published ESPN injury report; this is not a confirmed active roster.</p>':missing('No verified injury list supplied for this game. This does not establish that every player is healthy or active.');
 const football=sport==='nfl'||sport==='college'||sport==='ncaaf';
 let playerGroups=[];arr(report.boxscore?.players).filter(g=>validTeam(g.team)).forEach(g=>arr(g.statistics).forEach(group=>{const players=arr(group.athletes);if(!players.length)return;const labels=arr(group.labels),descriptions=arr(group.descriptions);let title=group.text||group.name||'Player statistics';if(football&&group.name==='passing')title=name(g.team)+' — Quarterbacks / passing';
 playerGroups.push('<details class="lh-a-players"'+(football&&group.name==='passing'?' open':'')+'><summary>'+esc(title)+' · '+esc(players.length)+' players</summary><div class="lh-a-table-wrap"><table><caption>'+esc(name(g.team))+' · '+esc(group.name||'Game player statistics')+'</caption><thead><tr><th scope="col">Player</th>'+labels.map((l,k)=>'<th scope="col" title="'+esc(descriptions[k]||l)+'">'+esc(l)+'</th>').join('')+'</tr></thead><tbody>'+players.map(p=>'<tr><th scope="row">'+esc(p.athlete?.displayName||'Player')+(p.didNotPlay?' (Did not play)':'')+'</th>'+labels.map((l,k)=>'<td>'+esc(arr(p.stats)[k]??'Not supplied')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'+(descriptions.length?'<p class="lh-a-key">'+labels.map((l,k)=>esc(l)+': '+esc(descriptions[k]||l)).join(' · ')+'</p>':'')+'</details>')}));
 let leaderRows=[];arr(report.leaders).filter(g=>!g.team||validTeam(g.team)).forEach(g=>arr(g.leaders).forEach(category=>arr(category.leaders).forEach(p=>leaderRows.push('<li><strong>'+esc(p.athlete?.displayName||'Player')+'</strong><span>'+esc(category.displayName||category.name||'Game leader')+' · '+esc(p.displayValue??'Value not supplied')+(g.team?' · '+esc(name(g.team)):'')+'</span></li>'))));
 return '<div class="lh-a-root">'+source+panel('Venue, home / away & weather',context)+panel('Offense, defense & team comparison',stats+'<p>These are reported summary statistics; before play, supplied fields may describe the season. Higher values do not always indicate better performance; turnovers and errors require context. Season strength and predictions are not inferred.</p>')+panel('Injuries & availability',injuries)+panel(football?'Quarterbacks & player statistics':'Player statistics',playerGroups.join('')||missing('No verified player box score supplied yet.'))+panel('Published player leaders',leaderRows.length?'<ul class="lh-a-list">'+leaderRows.join('')+'</ul>':missing('No verified game leaders supplied yet.'))+'</div>';
}
global.LHAnalytics=Object.freeze({render});
})(window);
