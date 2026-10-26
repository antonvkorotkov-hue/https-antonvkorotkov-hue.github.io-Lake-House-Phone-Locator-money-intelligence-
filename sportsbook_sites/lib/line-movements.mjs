import {all,hash,now} from './sportsbook.mjs';
import {compactMarkets} from '../public/sportsbook-assets/market-view.mjs';
// Record the same closest-balanced featured pair shown in Games, per source.
// This is an observed featured line, never a claimed official opening line.
export async function recordMovements(db,quotes){
 const groups=new Map();for(const q of quotes){if(!['moneyline','spread','total'].includes(q.market)||!q.licensed||q.suspended||q.expires_at<=now())continue;const key=JSON.stringify([q.event_id,q.source,q.market,q.period,q.subject]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(q)}
 const commands=[];
 for(const rows of groups.values())for(const q of compactMarkets(rows,{time:now()}).featured){
  const series=await hash(JSON.stringify([q.event_id,q.source,q.market,q.side,q.period,q.subject,q.live]));
  const args=[series,q.event_id,q.market,q.side,q.period,q.subject,q.source,q.live,q.selection,q.line,q.odds,q.received_at,q.received_at,q.source_at];
  commands.push(db.prepare(`INSERT OR IGNORE INTO sb_line_movements(series,event_id,market,side,period,subject,source,live,selection,line,odds,observed_at,last_seen,source_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM sb_line_movements WHERE id=(SELECT id FROM sb_line_movements WHERE series=? ORDER BY observed_at DESC,id DESC LIMIT 1) AND (observed_at>=? OR (line IS ? AND odds=? AND last_seen>=?)))`).bind(...args,series,q.received_at,q.line,q.odds,q.received_at-(q.live?30:180)));
  commands.push(db.prepare(`UPDATE sb_line_movements SET last_seen=max(last_seen,?) WHERE id=(SELECT id FROM sb_line_movements WHERE series=? ORDER BY observed_at DESC,id DESC LIMIT 1) AND line IS ? AND odds=?`).bind(q.received_at,series,q.line,q.odds));
 }
 if(commands.length)await db.batch(commands);
}
export async function lineHistory(env,eventId,market){
 if(!env.DB)return {points:[],reason:'Persistent market database unavailable'};
 if(!/^(nfl|college|nba|mlb):[a-zA-Z0-9_-]{1,80}$/.test(eventId)||!['moneyline','spread','total'].includes(market))return {points:[],reason:'Select a game and Moneyline, Spread or Game total.'};
 const points=await all(env.DB,'SELECT * FROM (SELECT series,market,side,period,subject,source,live,selection,line,odds,observed_at,last_seen,source_at FROM sb_line_movements WHERE event_id=? AND market=? ORDER BY observed_at DESC,id DESC LIMIT 1200) ORDER BY observed_at',[eventId,market]);
 return {points,server_time:now(),limited:points.length===1200,reason:points.length?null:'Recording starts when fresh prices are retrieved. No verified history has been recorded for this game yet.'};
}
