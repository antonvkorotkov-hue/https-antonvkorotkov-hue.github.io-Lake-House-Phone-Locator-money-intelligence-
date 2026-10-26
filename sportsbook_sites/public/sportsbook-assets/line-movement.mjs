import {bookName,implied} from './market-view.mjs';
let active='',lastFetch=0,sequence=0,data=[],selected='';
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const clock=t=>new Date(t*1000).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'});
const price=n=>(n>0?'+':'')+n;
export function chartValue(p){return p.market==='moneyline'?implied(p.odds)*100:Number(p.line)}
export function movementSegments(rows){const result=[];for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i];result.push({a,b,gap:b.observed_at-a.last_seen>(a.live?30:180)})}return result}
function render(){
 const target=document.querySelector('#movementChart'),select=document.querySelector('#movementSeries');target.replaceChildren();
 const rows=data.filter(p=>p.series===select.value);if(!rows.length){target.append(node('p','No recorded prices for this selection yet.','sub'));return}
 const first=rows[0],last=rows.at(-1),unit=first.market==='moneyline'?'Implied probability (%)':'Line (points)';
 const summary=node('div',undefined,'movement-stats');for(const [label,p] of [['First recorded',first],['Latest observed',last]]){const card=node('div');card.append(node('span',label,'sub'),node('strong',p.market==='moneyline'?price(p.odds):(p.line+' · '+price(p.odds))),node('span',clock(label==='First recorded'?p.observed_at:p.last_seen),'sub'));summary.append(card)}target.append(summary);
 const change=chartValue(last)-chartValue(first);target.append(node('p',rows.length===1?'One recorded price. The chart will grow when the price or featured line changes.':'Change since first recorded: '+(change>0?'+':'')+Number(change.toFixed(2))+(first.market==='moneyline'?' percentage points of implied probability':' points')+'. '+rows.length+' recorded changes/prices.','sub'));
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 640 240');svg.setAttribute('role','img');svg.setAttribute('aria-label',unit+' over time for '+first.side+' · '+first.source);svg.classList.add('movement-svg');
 const draw=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;svg.append(e);return e};
 const values=rows.map(chartValue),lo=Math.min(...values),hi=Math.max(...values),pad=Math.max((hi-lo)*.15,first.market==='moneyline'?1:.5),min=lo-pad,max=hi+pad,start=first.observed_at,end=Math.max(last.last_seen,start+1),x=t=>62+((t-start)/(end-start))*550,y=v=>193-(v-min)/(max-min)*155;
 for(let i=0;i<=4;i++){const v=min+(max-min)*i/4;draw('line',{x1:62,x2:612,y1:y(v),y2:y(v),class:'movement-grid'});draw('text',{x:52,y:y(v)+4,'text-anchor':'end'},Number(v.toFixed(1)))}
 draw('text',{x:62,y:20},unit);draw('text',{x:62,y:227},new Date(start*1000).toLocaleTimeString());draw('text',{x:612,y:227,'text-anchor':'end'},new Date(end*1000).toLocaleTimeString());
 for(const {a,b,gap}of movementSegments(rows)){draw('path',{d:gap?`M ${x(a.observed_at)} ${y(chartValue(a))} H ${x(a.last_seen)}`:`M ${x(a.observed_at)} ${y(chartValue(a))} H ${x(b.observed_at)} V ${y(chartValue(b))}`,class:'movement-line'});}
 if(last.last_seen>last.observed_at)draw('path',{d:`M ${x(last.observed_at)} ${y(chartValue(last))} H ${x(last.last_seen)}`,class:'movement-line'});
 for(const p of rows){const dot=draw('circle',{cx:x(p.observed_at),cy:y(chartValue(p)),r:4,class:'movement-dot',tabindex:0});const title=document.createElementNS(ns,'title');title.textContent=clock(p.observed_at)+' · '+p.selection+' · '+price(p.odds);dot.append(title)}target.append(svg);
 target.append(node('p','Historical observations, not a current betting offer. Gaps mean no continuous observation. '+(first.market==='moneyline'?'Implied probability is calculated from the odds and includes bookmaker margin. ':'')+'Live and pregame data and each feed are kept separate.','sub'));
 const details=node('details'),caption=node('summary','Recorded prices & timestamps'),wrap=node('div',undefined,'movement-table-wrap'),table=node('table'),head=node('tr');for(const label of ['Observed','Line','Odds','Last checked'])head.append(node('th',label));table.append(head);for(const p of [...rows].reverse().slice(0,100)){const tr=node('tr');for(const v of [clock(p.observed_at),p.line??'Moneyline',price(p.odds),clock(p.last_seen)])tr.append(node('td',v));table.append(tr)}wrap.append(table);details.append(caption,wrap);target.append(details);
 if(Date.now()/1000-last.last_seen>(last.live?30:180))target.prepend(node('p','Latest observation is stale. Refresh Games for current market availability.','bad'));
}
export async function loadMovement(event,market,book){
 const select=document.querySelector('#movementSeries'),target=document.querySelector('#movementChart');if(!select||!target)return;
 const key=JSON.stringify([event,market,book]);if(active===key&&Date.now()-lastFetch<4500)return;const changed=active!==key;active=key;lastFetch=Date.now();const token=++sequence;
 if(changed){select.replaceChildren();target.replaceChildren(node('p','Loading recorded line movement…','sub'))}
 try{const response=await fetch('/api/line-history?'+new URLSearchParams({event_id:event,market}),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Could not load line history. Refresh Games to retry.');const result=await response.json();if(token!==sequence)return;data=result.points.filter(p=>book==='auto'||bookName(p)===book);const series=[...new Map(data.map(p=>[p.series,p])).values()];selected=select.value||selected;select.replaceChildren();for(const p of series){const option=node('option',p.side+' · '+p.source+' · '+(p.live?'Live':'Pregame')+' · '+p.period);option.value=p.series;select.append(option)}if(series.some(p=>p.series===selected))select.value=selected;select.onchange=()=>{selected=select.value;render()};if(!series.length)target.replaceChildren(node('p',result.reason||'No recorded history for this sportsbook yet.','sub'));else{render();if(result.limited)target.append(node('p','Showing the most recent 1,200 observations for this game and market.','sub'))}}
 catch(e){if(token===sequence)target.replaceChildren(node('p',e.message,'bad'))}
}
