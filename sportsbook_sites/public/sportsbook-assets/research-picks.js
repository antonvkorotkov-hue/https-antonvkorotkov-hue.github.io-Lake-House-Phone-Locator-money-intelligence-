(()=>{'use strict';
const sports={NFL:'nfl',NCAAF:'college',NBA:'nba',MLB:'mlb'};
const panel=document.createElement('section');panel.className='card';panel.setAttribute('aria-label','Virtual picks on real lines');
const heading=document.createElement('h2');heading.textContent='Virtual picks on real lines';
const note=document.createElement('p');note.textContent='Tap a confirmed price to enter virtual points. My Picks and balance use your existing sportsbook account.';
const market=document.createElement('select');market.setAttribute('aria-label','Virtual pick market');market.style.cssText='font:inherit;padding:12px;min-height:44px;background:#16293b;color:white;border:1px solid #66849d;border-radius:8px';
for(const [value,label] of [['moneyline','Moneyline'],['spread','Spread'],['total','Game total']]){const o=document.createElement('option');o.value=value;o.textContent=label;market.append(o)}
const status=document.createElement('p');status.setAttribute('role','status');const list=document.createElement('div');
const account=document.createElement('a');account.href='/sportsbook';account.textContent='My Picks · balance · sign in';account.style.cssText='display:block;padding:14px;color:#93d9ff';
panel.append(heading,note,account,market,status,list);document.querySelector('#top').before(panel);
let quotes=[],sequence=0,clockOffset=0;const selectedSport=()=>document.querySelector('.sports button.on')?.dataset.s||'NFL';
function render(){list.replaceChildren();const current=quotes.filter(q=>q.market===market.value&&q.expires_at>(Date.now()+clockOffset)/1000);if(!current.length){status.textContent=status.dataset.reason||'No confirmed '+market.options[market.selectedIndex].text+' prices right now. Other markets may be available.';return}
status.textContent=current.length+' confirmed selections. Confirm again on your virtual pick slip.';
for(const q of current){const a=document.createElement('a');a.href='/sportsbook?'+new URLSearchParams({sport:q.sport,market:q.market,quote_id:q.id});a.style.cssText='display:block;padding:14px;margin:8px 0;background:#174968;border:1px solid #74b9df;border-radius:10px;color:white;text-decoration:none;min-height:44px';a.textContent=q.event+' · '+q.selection+' '+(q.odds>0?'+':'')+q.odds+' · '+q.source+' · Select virtual pick';const small=document.createElement('small');small.style.cssText='display:block;opacity:.8;margin-top:6px';small.textContent='Snapshot checked '+new Date(q.received_at*1000).toLocaleTimeString()+' · Price last changed '+new Date(q.source_at*1000).toLocaleString();a.append(small);list.append(a)}
}
async function load(){const n=++sequence,sport=selectedSport();try{const r=await fetch('/api/board?sport='+encodeURIComponent(sport),{cache:'no-store'});if(!r.ok)throw Error('Market check failed');const d=await r.json();if(n!==sequence||sport!==selectedSport())return;quotes=d.virtualMarkets?.quotes||[];clockOffset=d.virtualMarkets?.server_time?d.virtualMarkets.server_time*1000-Date.now():0;status.dataset.reason=d.virtualMarkets?.reason||'';render()}catch{if(n!==sequence)return;quotes=[];status.dataset.reason='Could not confirm current provider prices. Refresh to retry.';render()}}
market.onchange=render;document.querySelector('.sports').addEventListener('click',e=>{if(e.target.closest('[data-s]')){quotes=[];status.dataset.reason='Checking provider prices…';render();load()}});
setInterval(()=>{if(!document.hidden)load()},10000);setInterval(()=>{if(quotes.some(q=>q.expires_at<=(Date.now()+clockOffset)/1000)){quotes=quotes.filter(q=>q.expires_at>(Date.now()+clockOffset)/1000);render()}},1000);load();
})();
