export function bookName(q){return String(q.source||'').split('/').pop().trim()||'Provider'}
export function implied(odds){return odds>0?100/(odds+100):Math.abs(odds)/(Math.abs(odds)+100)}
export function compactMarkets(quotes,{book='auto',time=Date.now()/1000}={}){
 const available=quotes.filter(q=>!q.unavailable_reason&&!q.suspended&&Number.isFinite(q.odds)&&q.odds!==0&&q.expires_at>time);
 const books=[...new Set(available.map(bookName))].sort();
 const selectedBook=book==='auto'?(books.find(b=>b==='DraftKings')||books[0]||''):book;
 const unique=new Map();
 for(const q of available.filter(q=>bookName(q)===selectedBook)){
  const key=JSON.stringify([q.event_id,q.market,q.period,q.subject,q.side,q.line]);const prior=unique.get(key);
  if(!prior||q.received_at>prior.received_at)unique.set(key,q);
 }
 const groups=new Map();
 for(const q of unique.values()){
  const line=q.market==='moneyline'?null:q.market==='spread'&&q.side==='away'?-Number(q.line):q.line==null?null:Number(q.line);
  const key=JSON.stringify([q.event_id,q.market,q.period,q.subject,line]);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(q);
 }
 const pairs=[...groups.values()].map(group=>group.sort((a,b)=>['home','over','away','under'].indexOf(a.side)-['home','over','away','under'].indexOf(b.side)));
 pairs.sort((a,b)=>Number(b.length>=2)-Number(a.length>=2)||a.reduce((n,q)=>n+Math.abs(implied(q.odds)-.5),0)/a.length-b.reduce((n,q)=>n+Math.abs(implied(q.odds)-.5),0)/b.length||String(a[0].id).localeCompare(String(b[0].id)));
 return {books,selectedBook,featured:pairs[0]||[],alternates:pairs.slice(1),all:pairs.flat()};
}
