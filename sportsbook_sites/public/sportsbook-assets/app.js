import {compactMarkets,bookName} from './market-view.mjs';
(()=>{'use strict';
const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];let quotes=[],events=[],diagnostics=[],pending=null,serverOffset=0,loadingQuotes=false,submitting=false,loggedIn=false,reviewing=false,alternatesOpen=false;
const entry=new URLSearchParams(location.search);let requestedQuote=entry.get('quote_id');try{pending=JSON.parse(sessionStorage.getItem('lh-pending-pick')||'null')}catch{}if(['nfl','college','nba','mlb'].includes(entry.get('sport')))$('#sport').value=entry.get('sport');if(['moneyline','spread','total'].includes(entry.get('market')))$('#marketFilter').value=entry.get('market');
try{const intent=JSON.parse(sessionStorage.getItem('lh-intended-pick')||'null');if(intent&&!requestedQuote){requestedQuote=intent.quote_id;if(['nfl','college','nba','mlb'].includes(intent.sport))$('#sport').value=intent.sport;if(['moneyline','spread','total'].includes(intent.market))$('#marketFilter').value=intent.market;if(Number.isInteger(intent.stake_points)&&intent.stake_points>0&&intent.stake_points<=10000)$('#stake').value=intent.stake_points}}catch{}
const amount=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:2});
const msg=(s,error=false)=>{const e=$('#message');e.textContent=s;e.className='msg '+(error?'bad':'good')};
const csrf=()=>decodeURIComponent(document.cookie.split('; ').find(s=>s.startsWith('lh_csrf='))?.slice(8)||'');
async function api(path,method='GET',body){await window.LHClient.ready;const headers=window.LHClient.headers();if(body!==undefined)headers['Content-Type']='application/json';if(method!=='GET'&&!window.LHClient.crossOrigin)headers['X-CSRF-Token']||=csrf();const r=await fetch('/api/sportsbook/'+path,{method,headers,credentials:window.LHClient.crossOrigin?'omit':'same-origin',cache:'no-store',body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await r.json()}catch{throw Error('Server unavailable. Refresh to check your accepted picks before retrying.')}if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:'Invalid request');if(['login','join','access-login','owner-login'].includes(path))await window.LHClient.accept(data);if(path==='logout')await window.LHClient.clear();return data}
function item(parent,title,detail){const row=document.createElement('div');row.className='item';const heading=document.createElement('strong');heading.textContent=title;const meta=document.createElement('div');meta.className='sub';meta.textContent=detail;row.append(heading,meta);$(parent).append(row);return row}
function showAccess(){
 $('#access').classList.remove('hide');$('#access').scrollIntoView({behavior:'smooth',block:'start'});
}
function guestView(){
 loggedIn=false;$('#league').classList.remove('hide');$('#who').textContent='Guest';$('#role').textContent='Browse real lines. Sign in to save picks.';$('#balance').textContent='Sign in';$('#adminTab').classList.add('hide');$('#logout').classList.add('hide');$('#openAccess').classList.remove('hide');$('#place').textContent='Sign in to save this pick';$('#picks').textContent='Sign in to see your saved picks.';$('#signinLinkCard').classList.add('hide');
}
async function refresh(){
 let me;try{me=await api('me')}catch(err){if(err.message.includes('Login required')){await window.LHClient.clear();guestView();await loadQuotes();return}throw err}
 loggedIn=true;$('#access').classList.add('hide');$('#league').classList.remove('hide');$('#who').textContent=me.display_name||me.username;$('#role').textContent=me.role==='admin'?'Sole administrator · personal participant balance':'Invited member';$('#balance').textContent=amount(me.balance_points);$('#adminTab').classList.toggle('hide',me.role!=='admin');$('#logout').classList.remove('hide');$('#openAccess').classList.add('hide');$('#place').textContent='Review virtual pick';if(me.role!=='admin')$('#admin').classList.add('hide');
 const checks=await Promise.allSettled([loadPicks(),loadBoard(),...(me.role==='admin'?[loadMembers(),loadHouse()]:[])]);for(const check of checks)if(check.status==='rejected')msg(check.reason.message,true);
 await loadQuotes().catch(e=>{$('#feedStatus').textContent=e.message+' Your account and saved picks are still available.'});
}
async function loadQuotes(){
 if(loadingQuotes||submitting)return;loadingQuotes=true;const sport=$('#sport').value,market=$('#marketFilter').value,authenticated=loggedIn,eventId=$('#gameFilter').value;
 try{
  let result;
  if(authenticated)result=await api('quotes?sport='+encodeURIComponent(sport)+'&market='+encodeURIComponent(market)+'&event_id='+encodeURIComponent(eventId));
  else{const response=await fetch('/api/markets?sport='+encodeURIComponent(sport)+'&event_id='+encodeURIComponent(eventId),{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Current markets could not be loaded. Tap Refresh to retry.');const feed=await response.json();result={...feed,unavailable_reason:feed.reason};}
  if(sport!==$('#sport').value||market!==$('#marketFilter').value||authenticated!==loggedIn)return;
  quotes=result.quotes||[];events=result.events||[];diagnostics=result.diagnostics||[];serverOffset=result.server_time?result.server_time*1000-Date.now():0;
  $('#feedStatus').textContent='Checked '+new Date(result.server_time*1000).toLocaleTimeString()+'. '+(result.unavailable_reason||'Real provider lines. Select odds, enter virtual points, then confirm your pick.');if(!reviewing)renderQuotes();
 }finally{loadingQuotes=false;if(sport!==$('#sport').value||market!==$('#marketFilter').value||authenticated!==loggedIn)loadQuotes().catch(e=>msg(e.message,true))}
}
const expired=q=>q.expires_at<=(Date.now()+serverOffset)/1000;
function missingReason(e,market){
 const d=diagnostics.find(d=>d.sport===e.sport),detail=d?.events?.[e.id];
 if(!['scheduled','live'].includes(e.state))return 'ESPN event is '+e.state;
 if(d?.reason)return d.reason;
 if(detail?.reason)return detail.reason;
 const rejected=Object.keys(detail?.rejections||{}).join('; ');
 return rejected||'Provider snapshot contains no available '+market.replaceAll('_',' ')+' prices from DraftKings/FanDuel';
}
function renderQuotes(){let chosen=$('#gameFilter').value;const availableEvents=events.filter(e=>!$('#sport').value||e.sport===$('#sport').value);const requested=quotes.find(q=>q.id===requestedQuote);if(requested)chosen=requested.event_id;if(!availableEvents.some(e=>e.id===chosen))chosen=availableEvents.find(e=>quotes.some(q=>q.event_id===e.id&&!q.unavailable_reason&&!expired(q)))?.id||availableEvents.find(e=>['live','scheduled'].includes(e.state))?.id||availableEvents[0]?.id||'';if([...$('#gameFilter').options].map(o=>o.value+'~'+o.textContent).join('|')!==availableEvents.map(e=>e.id+'~'+e.matchup+' · '+e.state).join('|')){$('#gameFilter').replaceChildren();for(const event of availableEvents){const o=document.createElement('option');o.value=event.id;o.textContent=event.matchup+' · '+event.state;$('#gameFilter').append(o)}}$('#gameFilter').value=chosen;const selected=$('#quote_id').value,sport=$('#sport').value,market=$('#marketFilter').value;$('#events').replaceChildren();$('#quotes').replaceChildren();$('#quote_id').replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose a price above';$('#quote_id').append(placeholder);events.filter(e=>(!sport||e.sport===sport)&&e.id===chosen).forEach(e=>{const d=e.details;item('#events',e.matchup+' · '+e.state, new Date(e.starts_at*1000).toLocaleString()+' · '+(d.status||'')+' · '+Object.entries(d.scores||{}).map(([k,v])=>k+': '+v).join(' / ')+' · '+(d.clock||'')+' · '+(Date.now()/1000-e.source_at>60?'STALE event feed':'ESPN retrieved '+new Date(e.source_at*1000).toLocaleTimeString())+(!quotes.some(q=>q.event_id===e.id&&q.market===market&&!q.unavailable_reason&&!expired(q))?' · '+missingReason(e,market):''));});if(!events.length)item('#events','Schedule unavailable',diagnostics.filter(d=>!sport||d.sport===sport).map(d=>d.reason).filter(Boolean).join('; ')||'No ESPN games have been retrieved for this sport yet.');
const shown=quotes.filter(q=>(!sport||q.sport===sport)&&q.market===market&&q.event_id===chosen);
if(requestedQuote){const requested=shown.find(q=>q.id===requestedQuote);if(requested&&['DraftKings','FanDuel'].includes(bookName(requested)))$('#bookFilter').value=bookName(requested)}
const view=compactMarkets(shown,{book:$('#bookFilter').value,time:(Date.now()+serverOffset)/1000});
$('#marketHint').textContent=view.all.length?view.selectedBook+(view.featured.some(q=>q.source.startsWith('ESPN '))?' via ESPN':'')+' · Tap a price to build your pick.':missingReason(events.find(e=>e.id===chosen)||{sport,state:'scheduled',id:chosen},market);
const renderPair=(pair,parent)=>{
 const row=document.createElement('div');row.className='odds-pair';
 for(const q of pair){const op=document.createElement('option');op.value=q.id;op.textContent=q.selection+' ('+(q.odds>0?'+':'')+q.odds+') · '+bookName(q);$('#quote_id').append(op);
  const b=document.createElement('button');b.type='button';b.className='pick-choice';b.dataset.quoteId=q.id;
  const name=document.createElement('span');name.textContent=q.selection;const price=document.createElement('strong');price.textContent=(q.odds>0?'+':'')+q.odds;b.append(name,price);
  b.setAttribute('aria-label','Select '+q.selection+' at '+(q.odds>0?'+':'')+q.odds+' from '+bookName(q));
  b.onclick=()=>{$('#quote_id').value=q.id;rememberSelection();estimate();$('#stake').focus({preventScroll:true});$('#pick').scrollIntoView({behavior:'smooth',block:'nearest'});msg('Selected '+q.selection+'. Enter points, then review.')};row.append(b);
 }
 parent.append(row);
};
if(view.featured.length){renderPair(view.featured,$('#quotes'));
 if(view.alternates.length){const details=document.createElement('details');details.id='alternateLines';details.open=alternatesOpen;details.ontoggle=()=>{alternatesOpen=details.open};const summary=document.createElement('summary');summary.textContent='More lines ('+view.alternates.length+')';details.append(summary);for(const pair of view.alternates)renderPair(pair,details);$('#quotes').append(details)}
 const info=document.createElement('details');info.className='quote-info';const summary=document.createElement('summary');summary.textContent='Source & freshness';info.append(summary);const note=document.createElement('p');note.className='sub';note.textContent=[...new Set(view.featured.map(q=>q.source))].join(' · ')+'. Snapshot checked '+new Date(Math.min(...view.featured.map(q=>q.received_at))*1000).toLocaleTimeString()+'. Prices may change before confirmation.';info.append(note);$('#quotes').append(info);
}else item('#quotes','No available '+market.replaceAll('_',' '),shown.find(q=>q.unavailable_reason)?.unavailable_reason||'Refresh for current prices or choose another game or sportsbook.');
const restore=requestedQuote||selected;
if(restore&&[...$('#quote_id').options].some(o=>o.value===restore)){$('#quote_id').value=restore;if(requestedQuote)msg('Your selection is ready. Enter points and review.')}else if(requestedQuote)msg('That line changed or expired. Choose an available price.',true);
requestedQuote=null;estimate()}

function rememberSelection(){const quote_id=$('#quote_id').value;if(!quote_id)return;try{sessionStorage.setItem('lh-intended-pick',JSON.stringify({quote_id,sport:$('#sport').value,market:$('#marketFilter').value,stake_points:Number($('#stake').value)}))}catch{}}
function estimate(){document.querySelectorAll('.pick-choice').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.quoteId===$('#quote_id').value?'true':'false');const choice=quotes.find(q=>q.id===b.dataset.quoteId);b.disabled=!choice||expired(choice)||!!choice.unavailable_reason});const q=quotes.find(q=>q.id===$('#quote_id').value),s=Number($('#stake').value);$('#place').disabled=submitting||reviewing||!q||!!q.unavailable_reason||expired(q)||!Number.isInteger(s)||s<1||s>10000;$('#chosenSlip').textContent=q?q.selection+' · '+(q.odds>0?'+':'')+q.odds+' · '+bookName(q):'Select a team or total above to build your virtual pick.';if(!q){$('#return').textContent='Tap an available price to start.';return}const units=s*100;const r=units+(q.odds>0?Math.floor(units*q.odds/100):Math.floor(units*100/-q.odds));$('#return').textContent='Returns '+amount(r/100)+' points if won (includes your stake).'}
function showPicks(selector,picks){$(selector).replaceChildren();if(!picks.length){$(selector).textContent='No wagers yet.';return}picks.forEach(p=>item(selector,(p.user_id?'Member #'+p.user_id+' · ':'')+p.selection+' · '+amount(p.stake_points)+' pts',p.event+' · '+p.odds+' · '+p.status+' · Return '+amount(p.potential_return_points)+' · Accepted '+new Date(p.created_at*1000).toLocaleString()+(p.snapshot?' · '+p.snapshot.source+' · Price last changed '+new Date(p.snapshot.source_at*1000).toLocaleString()+' · Snapshot checked '+new Date(p.snapshot.received_at*1000).toLocaleString():' · Legacy demonstration record')))}
async function loadPicks(){try{showPicks('#picks',await api('picks'))}catch(err){$('#picks').textContent='Saved picks could not be loaded. Refresh to retry; do not resubmit an accepted pick.';throw err}}
async function loadBoard(){$('#leaders').replaceChildren();(await api('leaderboard')).forEach((r,i)=>item('#leaders',(i+1)+'. '+r.username,amount(r.balance_points)+' balance · '+amount(r.net_points)+' settled/net points'))}
async function loadMembers(){$('#members').replaceChildren();(await api('members')).forEach(u=>{const row=item('#members',u.username+' · '+u.role,amount(u.balance_points)+' pts · '+(u.enabled?'Enabled':'Disabled'));const control=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>fn().catch(e=>msg(e.message,true));row.append(b)};if(u.role!=='admin')control(u.enabled?'Disable':'Enable',async()=>{if(!confirm((u.enabled?'Disable ':'Enable ')+u.username+'?'))return;await api('members/'+u.id,'POST',{enabled:!u.enabled,reason:'Owner account status change',request_key:crypto.randomUUID()});await refresh()});control('Adjust balance',async()=>{const value=prompt('Virtual point adjustment (negative to deduct):');if(value===null)return;const n=Number(value);if(!Number.isSafeInteger(n))throw Error('Enter whole points');const reason=prompt('Reason for this audited adjustment:');if(!reason)return;await api('members/'+u.id,'POST',{adjustment_points:n,reason,request_key:crypto.randomUUID()});await refresh()});control('Recovery code',async()=>{if(!confirm('Issue a one-hour private recovery code for '+u.username+'?'))return;const r=await api('members/'+u.id+'/recovery','POST',{});msg('Share privately with '+u.username+': '+r.recovery_code)})})}
async function loadHouse(){const r=await api('admin');$('#house').textContent='House realized P/L: '+amount(r.house_realized_pnl_points)+' pts · Outstanding returns: '+amount(r.outstanding_return_points)+' · House cash: '+amount(r.house_cash_points)+' · Ledger check: '+r.ledger_sum;showPicks('#allPicks',r.picks);for(const [name,key] of [['max_stake_points','max_stake'],['starting_points','starting_balance'],['max_liability_points','max_liability']])$('#rules [name='+name+']').value=r.rules[key]/100;$('#starting').value=r.rules.starting_balance/100}
for(const name of ['login','recover'])$('#'+name).onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await api(name,'POST',Object.fromEntries(new FormData(e.target)));e.target.reset();if(name==='recover'){msg('Password reset. Sign in with your new password.');return}msg('Signed in');await refresh()}catch(err){msg(err.message,true)}finally{b.disabled=false}};
$('#join').onsubmit=async e=>{
 e.preventDefault();const button=e.submitter;if(button.disabled)return;button.disabled=true;button.textContent='Creating account…';$('#joinError').textContent='';
 try{const result=await api('join','POST',Object.fromEntries(new FormData(e.target)));e.target.reset();let loaded=true;await refresh().catch(()=>{loaded=false});if(result.sign_in_url){$('#signinLink').href=result.sign_in_url;$('#signinLinkCard').classList.remove('hide')}msg(loaded?'Account created. You are signed in and ready to save picks.':'Account created. Refresh to load your balance and picks.',!loaded);$('#league').scrollIntoView({behavior:'smooth',block:'start'})}
 catch(err){$('#joinError').textContent=err.message;msg(err.message,true)}finally{button.disabled=false;button.textContent='Create my account'}
};
function reviewPick(q,body){
 return new Promise(resolve=>{
  const dialog=$('#reviewDialog');$('#reviewTerms').textContent=q.event+' · '+q.selection+' at '+(q.odds>0?'+':'')+q.odds+' · Stake '+body.stake_points+' virtual points. '+$('#return').textContent;
  let settled=false;const finish=value=>{if(settled)return;settled=true;dialog.close();resolve(value)};
  $('#confirmSave').onclick=()=>finish(true);$('#cancelReview').onclick=()=>finish(false);dialog.oncancel=e=>{e.preventDefault();finish(false)};
  try{dialog.showModal()}catch{msg('The review panel could not open. Refresh the Site and retry.',true);finish(false)}
 });
}
$('#pick').onsubmit=async e=>{
 e.preventDefault();if(submitting||reviewing)return;
 const body={quote_id:$('#quote_id').value,stake_points:Number($('#stake').value)},q=quotes.find(q=>q.id===body.quote_id);
 if(!q||q.unavailable_reason||expired(q)){msg(q?.unavailable_reason||'This line expired. Refresh and select current odds.',true);estimate();return}
 if(!Number.isInteger(body.stake_points)||body.stake_points<1||body.stake_points>10000){msg('Enter whole virtual points from 1 to 10,000.',true);return}
 if(!loggedIn){requestedQuote=body.quote_id;try{sessionStorage.setItem('lh-intended-pick',JSON.stringify({...body,sport:$('#sport').value,market:$('#marketFilter').value}))}catch{}showAccess();msg('Sign in to save this pick to your account. Your selection and virtual points are held.');return}
 if(!pending||pending.quote_id!==body.quote_id||pending.stake_points!==body.stake_points){pending={...body,request_key:crypto.randomUUID()};try{sessionStorage.setItem('lh-pending-pick',JSON.stringify(pending))}catch{}}
 reviewing=true;estimate();let approved;
 try{approved=await reviewPick(q,body)}finally{reviewing=false;estimate()}
 if(!approved){renderQuotes();return}
 const current=quotes.find(price=>price.id===body.quote_id);
 if(!current||current.unavailable_reason||expired(current)){msg('This price expired during review. Refresh and select current odds before saving.',true);return}
 submitting=true;$('#place').disabled=true;let receipt;
 try{receipt=await api('picks','POST',pending)}catch(err){msg(err.message+' Check My Picks before retrying. A retry uses the same request key.',true);submitting=false;estimate();return}
 pending=null;try{sessionStorage.removeItem('lh-pending-pick');sessionStorage.removeItem('lh-intended-pick')}catch{}
 try{await refresh();msg('Saved pick #'+receipt.pick_id+(receipt.duplicate?' (already saved; no additional points deducted)':''))}catch{msg('Pick #'+receipt.pick_id+' was saved. Account refresh failed; refresh My Picks to view it. Do not resubmit.',true)}
 all('[data-tab]').forEach(x=>x.setAttribute('aria-selected',x.dataset.tab==='history'?'true':'false'));all('.pane').forEach(p=>p.classList.toggle('hide',p.id!=='history'));submitting=false;estimate();
};
$('#invite').onclick=async()=>{try{const r=await api('invites','POST',{starting_points:Number($('#starting').value)});$('#inviteResult').textContent='Share privately; valid 24 hours: '+r.invitation_code}catch(err){msg(err.message,true)}};
$('#rules').onsubmit=async e=>{e.preventDefault();try{const b=Object.fromEntries([...new FormData(e.target)].map(([k,v])=>[k,Number(v)]));await api('rules','POST',b);msg('Limits saved');await loadHouse()}catch(err){msg(err.message,true)}};
$('#ownerSetup').onsubmit=async e=>{e.preventDefault();try{await api('setup','POST',Object.fromEntries(new FormData(e.target)));e.target.reset();msg('Owner password set. Sign in below.')}catch(err){msg(err.message,true)}};
$('#logout').onclick=async()=>{try{await api('logout','POST',{});location.reload()}catch(err){msg(err.message,true)}};
$('#openAccess').onclick=showAccess;$('#closeAccess').onclick=()=>{$('#access').classList.add('hide');$('#markets').scrollIntoView({behavior:'smooth',block:'start'})};$('#refresh').onclick=()=>loadQuotes().catch(e=>msg(e.message,true));$('#sport').onchange=()=>{quotes=[];events=[];renderQuotes();loadQuotes().catch(e=>msg(e.message,true))};$('#marketFilter').onchange=()=>{alternatesOpen=false;renderQuotes();loadQuotes().catch(e=>msg(e.message,true))};$('#bookFilter').onchange=()=>{alternatesOpen=false;renderQuotes()};$('#gameFilter').onchange=()=>{alternatesOpen=false;renderQuotes();loadQuotes().catch(e=>msg(e.message,true))};$('#quote_id').onchange=()=>{rememberSelection();estimate()};$('#stake').oninput=()=>{rememberSelection();estimate()};
all('[data-tab]').forEach(b=>b.onclick=()=>{if(!loggedIn&&b.dataset.tab!=='markets'){showAccess();msg('Sign in to view your saved picks and balance.');return}all('[data-tab]').forEach(x=>x.setAttribute('aria-selected',x===b?'true':'false'));all('.pane').forEach(p=>p.classList.toggle('hide',p.id!==b.dataset.tab));if(b.dataset.tab==='markets')loadQuotes().catch(e=>msg(e.message,true));if(b.dataset.tab==='history')loadPicks().catch(e=>msg(e.message,true))});
setInterval(()=>{if(!document.hidden&&!$('#league').classList.contains('hide')&&!$('#markets').classList.contains('hide'))loadQuotes().catch(()=>msg('Feed refresh failed. Wagering will reject stale prices.',true))},5000);
setInterval(()=>{if(!$('#league').classList.contains('hide'))estimate()},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#league').classList.contains('hide')&&!$('#markets').classList.contains('hide'))loadQuotes().catch(e=>msg(e.message,true))});
all('[data-stake]').forEach(button=>button.onclick=()=>{$('#stake').value=button.dataset.stake;rememberSelection();estimate()});
$('#passwordlessLinks').onclick=async()=>{const button=$('#passwordlessLinks');button.disabled=true;try{const result=await api('provision-friends','POST',{});$('#privateLinks').replaceChildren();for(const account of result.accounts){const row=document.createElement('p'),link=document.createElement('a');link.href=account.url;link.textContent=account.name+' private sign-in link';row.append(link);$('#privateLinks').append(row)}msg('Links created. Share each link privately with its owner. Each link works once and expires in 30 days.')}catch(err){msg(err.message,true)}finally{button.disabled=false}};
guestView();(async()=>{const code=new URLSearchParams(location.hash.slice(1)).get('access');if(code){history.replaceState(null,'',location.pathname+location.search);await api('access-login','POST',{code});msg('Signed in without a password. Save this site to your Home Screen.')}else if(entry.get('admin')==='1'){await api('owner-login','POST',{});history.replaceState(null,'',location.pathname);msg('Admin signed in with your ChatGPT owner account.')}await refresh()})().catch(e=>{guestView();showAccess();msg(e.message,true);loadQuotes().catch(err=>msg(err.message,true))});
})();

if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
