import {authenticate,database,json,rateLimit} from '../../../../lib/accounts/server';
import {marketConfig} from '../../../../lib/trading/config';
import {MarketDataError} from '../../../../lib/trading/provider.mjs';
import {marketMovers,searchStocks,stockDetail,stockHistory} from '../../../../lib/trading/market-read.mjs';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const account=await authenticate(req);if(!account)return json({error:'Create or recover a practice account first.'},401);if(!await rateLimit(req,'market-read',180))return json({error:'Too many market requests. Try again later.'},429);const q=new URL(req.url).searchParams,action=q.get('action'),config=await marketConfig();if(action==='watchlist'){
 const offsetText=q.get('offset')||'0';if(!/^(0|[1-9][0-9]?)$/.test(offsetText)||Number(offsetText)>45||Number(offsetText)%5!==0)return json({error:'Invalid watchlist page.'},400);
 const offset=Number(offsetText),saved=await database().prepare('SELECT symbol FROM watchlist WHERE account_id=? ORDER BY symbol').bind(account.id).all<{symbol:string}>(),symbols=saved.results.slice(offset,offset+5).map(row=>row.symbol);
 const rows=await Promise.all(symbols.map(async symbol=>{try{return {symbol,quote:await stockDetail(symbol,config),error:null}}catch(e){return {symbol,quote:null,error:e instanceof MarketDataError?e.message:'Price unavailable. Try again later.'}}}));
 return json({rows,total:saved.results.length,offset,hasMore:offset+5<saved.results.length});
 }if(action==='search')return json(await searchStocks(q.get('query')||'',config));if(action==='movers')return json(await marketMovers(q.get('direction')||'',config));const symbol=(q.get('symbol')||'').trim().toUpperCase();if(action==='detail')return json(await stockDetail(symbol,config));if(action==='history')return json(await stockHistory(symbol,q.get('range')||'1M',config));return json({error:'Unknown market request.'},400)}catch(e){return e instanceof MarketDataError?json({error:e.message},e.status):json({error:'Market information is temporarily unavailable.'},503)}}
