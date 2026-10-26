const bad=message=>{throw Object.assign(Error(message),{status:422})};
export function dateBoundary(value,next=false){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))bad('Use dates in YYYY-MM-DD format');
 const [y,m,d]=value.split('-').map(Number),day=Date.UTC(y,m-1,d);if(y<2000||y>2100||new Date(day).toISOString().slice(0,10)!==value)bad('Invalid report date');
 const target=day+(next?86400000:0);let guess=target;
 const formatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 for(let i=0;i<3;i++){const parts=Object.fromEntries(formatter.formatToParts(new Date(guess)).map(p=>[p.type,p.value]));const local=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);guess+=target-local}
 return Math.floor(guess/1000);
}
export function reportFilters(params){
 const from=params.get('from')||'',to=params.get('to')||'',basis=params.get('basis')||'placed';if(!['placed','settled'].includes(basis))bad('Choose pick date or settlement date');
 const start=from?dateBoundary(from):0,end=to?dateBoundary(to,true):4134000000;if(start>=end)bad('Start date must be on or before end date');return {from,to,basis,start,end};
}
export async function resultsReport(db,{userId='',start=0,end=4134000000,basis='placed'}={}){
 const when=basis==='settled'?'coalesce(c.created_at,s.created_at)':'p.created_at';
 const rows=(await db.prepare(`WITH filtered AS (
 SELECT p.*,coalesce(c.amount,s.payout) AS returned FROM sb_picks p
 LEFT JOIN sb_cashouts c ON c.pick_id=p.id
 LEFT JOIN sb_settlements s ON s.id=(SELECT id FROM sb_settlements WHERE pick_id=p.id ORDER BY version DESC LIMIT 1)
 WHERE ${when}>=? AND ${when}<?
 ), stats AS (SELECT user_id,count(*) picks,
 sum(status='win') wins,sum(status='loss') losses,sum(status='push') pushes,sum(status='void') voids,sum(status='cashed_out') cashouts,sum(status='pending') open,
 sum(stake) staked,sum(CASE WHEN status='pending' THEN stake ELSE 0 END) open_stake,
 sum(CASE WHEN status!='pending' THEN coalesce(returned,0) ELSE 0 END) returned,
 sum(CASE WHEN status!='pending' AND returned IS NOT NULL THEN returned-stake ELSE 0 END) net,
 sum(CASE WHEN status!='pending' AND returned IS NOT NULL THEN max(returned-stake,0) ELSE 0 END) gross_won,
 sum(CASE WHEN status!='pending' AND returned IS NOT NULL THEN max(stake-returned,0) ELSE 0 END) gross_lost
 FROM filtered GROUP BY user_id)
 SELECT u.id,u.username,u.role,u.enabled,coalesce(s.picks,0) picks,coalesce(s.wins,0) wins,coalesce(s.losses,0) losses,coalesce(s.pushes,0) pushes,coalesce(s.voids,0) voids,coalesce(s.cashouts,0) cashouts,coalesce(s.open,0) open,
 coalesce(s.staked,0)/100.0 staked_points,coalesce(s.open_stake,0)/100.0 open_stake_points,coalesce(s.returned,0)/100.0 returned_points,coalesce(s.net,0)/100.0 net_points,coalesce(s.gross_won,0)/100.0 won_points,coalesce(s.gross_lost,0)/100.0 lost_points
 FROM sb_users u LEFT JOIN stats s ON s.user_id=u.id WHERE (?='' OR u.id=?) ORDER BY net_points DESC,u.username`).bind(start,end,userId,userId).all()).results;
 const keys=['picks','wins','losses','pushes','voids','cashouts','open','staked_points','open_stake_points','returned_points','net_points','won_points','lost_points'];
 for(const row of rows)row.win_rate=row.wins+row.losses?100*row.wins/(row.wins+row.losses):null;
 const totals=Object.fromEntries(keys.map(k=>[k,Math.round(rows.reduce((n,r)=>n+r[k],0)*100)/100]));totals.win_rate=totals.wins+totals.losses?100*totals.wins/(totals.wins+totals.losses):null;
 return {users:rows,totals,timezone:'America/New_York',basis};
}
