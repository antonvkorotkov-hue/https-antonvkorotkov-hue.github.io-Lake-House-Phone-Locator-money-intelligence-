import {database} from '../accounts/server';
import {randomSecret} from '../accounts/crypto';
import {calculateStockFill} from './engine.mjs';
import {stockFillStatements} from './persistence.mjs';
import {closeLimitStatements,tradingDate} from './limits.mjs';
import {marketConfig} from './config';
import {configured,getStockQuote,MarketDataError} from './provider.mjs';
import {tradingState,costChanges} from './account-state';
export const limitQuery='SELECT id,symbol,side,quantity_micros AS quantityMicros,limit_cents AS limitCents,reserved_cents AS reservedCents,time_in_force AS timeInForce,trading_date AS tradingDate,status,created_at AS createdAt,updated_at AS updatedAt,checked_at AS checkedAt,last_error AS lastError FROM limit_orders';
type Limit={id:string;symbol:string;side:'buy'|'sell';quantity_micros:number;limit_cents:number;time_in_force:string;trading_date:string};
export async function closeLimit(id:string,accountId:string,status:'cancelled'|'expired'){const token=randomSecret(),db=database();const statements=closeLimitStatements({id,accountId,processToken:token,status,now:Date.now()});await db.batch(statements.map(s=>db.prepare(s.sql).bind(...s.args)));const changed=await db.prepare('SELECT id FROM limit_orders WHERE id=? AND account_id=? AND status=? AND process_token=?').bind(id,accountId,status,token).first();return !!changed}
export async function processLimits(accountId:string){const db=database(),now=Date.now(),today=tradingDate(now);let expired=0,filled=0;const pending=await db.prepare("SELECT * FROM limit_orders WHERE account_id=? AND status='open' ORDER BY checked_at,created_at,id LIMIT 20").bind(accountId).all<Limit>();for(const order of pending.results)if(order.time_in_force==='DAY'&&order.trading_date<today){if(await closeLimit(order.id,accountId,'expired'))expired++}
 const config=await marketConfig();if(!configured(config))return {checked:0,filled,expired,configured:false};
 const rows=pending.results.filter(o=>o.time_in_force!=='DAY'||o.trading_date>=today).slice(0,5);
 const quotes=new Map<string,Promise<Awaited<ReturnType<typeof getStockQuote>>>>();
 for(const row of rows)if(!quotes.has(row.symbol))quotes.set(row.symbol,getStockQuote(row.symbol,config));
 // Await all provider calls before consuming their results, avoiding unhandled rejections.
 const symbols=[...quotes.keys()],settled=await Promise.allSettled(symbols.map(s=>quotes.get(s)!));
 const results=new Map(symbols.map((s,i)=>[s,settled[i]]));
 for(const order of rows){try{
  const result=results.get(order.symbol)!;if(result.status==='rejected')throw result.reason;const quote=result.value;
  const state=await tradingState(accountId,order.symbol,order.id);
  const fill=calculateStockFill({side:order.side,quantityMicros:order.quantity_micros,quote,now:Date.now(),cashCents:state.availableCashCents,heldMicros:state.availableShares,limitCents:order.limit_cents});
  if(fill.status==='filled'){
   const changes=costChanges(state.holding,order.side,order.quantity_micros,fill.amountCents),token=randomSecret();
   if(!Number.isSafeInteger(state.account.cash_cents+fill.cashDeltaCents))throw new Error('Order value too large');
   const statements=stockFillStatements({orderId:order.id,accountId,expectedVersion:state.account.version,processToken:token,symbol:order.symbol,side:order.side,quantityMicros:order.quantity_micros,priceCents:fill.priceCents,amountCents:fill.amountCents,cashDeltaCents:fill.cashDeltaCents,...changes,quoteTimestamp:quote.timestamp,createdAt:Date.now(),sourceLimitId:order.id});
   await db.batch(statements.map(s=>db.prepare(s.sql).bind(...s.args)));
   if(await db.prepare('SELECT id FROM orders WHERE id=? AND account_id=? AND process_token=?').bind(order.id,accountId,token).first())filled++;
  }
  await db.prepare("UPDATE limit_orders SET checked_at=?,last_error=NULL WHERE id=? AND account_id=? AND status='open'").bind(Date.now(),order.id,accountId).run();
 }catch(e){const message=e instanceof MarketDataError?e.message:e instanceof Error&&/^(Insufficient|Quote|Market|Invalid|Account ledger)/.test(e.message)?e.message:'The order could not be checked. It remains pending.';
  if(order.time_in_force==='DAY'&&message==='Market is not open'){if(await closeLimit(order.id,accountId,'expired'))expired++;continue}
  await db.prepare("UPDATE limit_orders SET checked_at=?,last_error=? WHERE id=? AND account_id=? AND status='open'").bind(Date.now(),message,order.id,accountId).run();
 }}return {checked:rows.length,filled,expired,configured:true};
}
