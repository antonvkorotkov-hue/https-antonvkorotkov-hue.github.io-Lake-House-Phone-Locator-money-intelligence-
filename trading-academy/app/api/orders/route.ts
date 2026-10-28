import {authenticate,database,json,rateLimit,readBody,sameOrigin} from '../../../lib/accounts/server';
import {randomSecret,validSecret} from '../../../lib/accounts/crypto';
import {calculateStockFill} from '../../../lib/trading/engine.mjs';
import {getStockQuote,MarketDataError} from '../../../lib/trading/provider.mjs';
import {marketConfig} from '../../../lib/trading/config';
import {stockFillStatements} from '../../../lib/trading/persistence.mjs';
import {createLimitStatements,reserveCost,tradingDate} from '../../../lib/trading/limits.mjs';
import {tradingState,costChanges} from '../../../lib/trading/account-state';
import {limitQuery} from '../../../lib/trading/limit-service';
export const dynamic='force-dynamic';
type Preview={id:string;account_id:string;symbol:string;side:'buy'|'sell';quantity_micros:number;price_cents:number;expires_at:number;order_type:string;limit_cents:number|null;time_in_force:'DAY'|'GTC'};
function publicOrderQuery(){return "SELECT id,symbol,side,quantity_micros AS quantityMicros,price_cents AS priceCents,amount_cents AS amountCents,realized_delta_cents AS realizedDeltaCents,quote_timestamp AS quoteTimestamp,created_at AS createdAt,CASE WHEN EXISTS(SELECT 1 FROM limit_orders WHERE limit_orders.id=orders.id) THEN 'limit' ELSE 'market' END AS orderType FROM orders"}
export async function GET(req:Request){try{const a=await authenticate(req);if(!a)return json({error:'Sign in first.'},401);const q=new URL(req.url).searchParams,clauses=['account_id=?'],args:(string|number)[]=[a.id];const side=q.get('side');if(side&&side!=='all'){if(!['buy','sell'].includes(side))return json({error:'Invalid history side filter.'},400);clauses.push('side=?');args.push(side)}for(const [field,operator] of [['from','>='],['to','<']] as const){const raw=q.get(field);if(raw!==null){const value=Number(raw);if(!Number.isSafeInteger(value)||value<0)return json({error:'Invalid history date filter.'},400);clauses.push('created_at'+operator+'?');args.push(value)}}const beforeTime=q.get('beforeTime'),beforeId=q.get('beforeId');if(beforeTime!==null||beforeId!==null){const t=Number(beforeTime);if(beforeTime===null||!Number.isSafeInteger(t)||t<0||!beforeId||!/^[a-f0-9]{64}$/.test(beforeId))return json({error:'Invalid history cursor.'},400);clauses.push('(created_at<? OR (created_at=? AND id<?))');args.push(t,t,beforeId)}const r=await database().prepare(publicOrderQuery()+' WHERE '+clauses.join(' AND ')+' ORDER BY created_at DESC,id DESC LIMIT 51').bind(...args).all<{id:string;createdAt:number}>();const page=r.results.slice(0,50),last=page[page.length-1];return json({orders:page,nextCursor:r.results.length>50&&last?{time:last.createdAt,id:last.id}:null})}catch{return json({error:'Order history unavailable.'},503)}}
export async function POST(req:Request){if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);try{
 const a=await authenticate(req);if(!a)return json({error:'Sign in first.'},401);if(!await rateLimit(req,'orders:'+a.id,120))return json({error:'Too many order requests. Try again later.'},429);const body=await readBody(req),db=database();
 if(body.action==='preview'){
  const symbol=typeof body.symbol==='string'?body.symbol.trim().toUpperCase():'',side=body.side,quantityMicros=body.quantityMicros,orderType=body.orderType??'market',duration=body.timeInForce??'GTC';
  if((side!=='buy'&&side!=='sell')||typeof quantityMicros!=='number'||!Number.isSafeInteger(quantityMicros)||quantityMicros<=0||quantityMicros>1000000000000||!['market','limit'].includes(String(orderType)))return json({error:'Enter a valid side, order type and quantity.'},400);
  const limitCents=orderType==='limit'?body.limitCents:null;
  if(orderType==='limit'&&(typeof limitCents!=='number'||!Number.isSafeInteger(limitCents)||limitCents<=0||limitCents>10000000000||!['DAY','GTC'].includes(String(duration))))return json({error:'Enter a positive limit price in cents and choose DAY or GTC.'},400);
  const quote=await getStockQuote(symbol,await marketConfig()),state=await tradingState(a.id,symbol);let priceCents:number,amountCents:number;
  if(orderType==='limit'){
   const reservation=reserveCost(side,quantityMicros,limitCents as number);
   if(side==='buy'&&reservation>state.availableCashCents)throw new Error('Insufficient buying power');if(side==='sell'&&quantityMicros>state.availableShares)throw new Error('Insufficient unreserved shares');
   priceCents=limitCents as number;amountCents=side==='buy'?reservation:Number(BigInt(priceCents)*BigInt(quantityMicros)/BigInt(1000000));
   if(!Number.isSafeInteger(amountCents)||amountCents<=0)throw new Error('Invalid order value');
  }else{const fill=calculateStockFill({side,quantityMicros,quote,now:Date.now(),cashCents:state.availableCashCents,heldMicros:state.availableShares});if(fill.status!=='filled')return json({error:'Order is not executable.'},409);priceCents=fill.priceCents;amountCents=fill.amountCents}
  const id=randomSecret(),expiresAt=Math.min(Date.now()+20000,quote.timestamp+30000);
  await db.prepare('INSERT INTO previews(id,account_id,symbol,side,quantity_micros,price_cents,order_type,limit_cents,time_in_force,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,a.id,symbol,side,quantityMicros,priceCents,orderType,limitCents,String(duration),expiresAt).run();
  return json({previewId:id,symbol,side,orderType,timeInForce:duration,quantityMicros,priceCents,amountCents,quoteTimestamp:quote.timestamp,provider:quote.provider,expiresAt,explanation:orderType==='limit'?'Submitting reserves buying power or shares. The order can fill at your limit or better, including immediately. Pending orders are checked only while the app is open, using current fresh quotes; missed price crossings are not backfilled. DAY orders expire when a session close is observed or the next trading date begins.':'Virtual market order: buys use the ask and sells use the bid. Prices round against you to whole cents. No commission. A fresh quote is checked again on confirmation.'});
 }
 if(body.action==='confirm'){
  if(!validSecret(body.previewId))return json({error:'Invalid order preview.'},400);
  const existing=await db.prepare(publicOrderQuery()+' WHERE id=? AND account_id=?').bind(body.previewId,a.id).first();if(existing)return json({order:existing,replayed:true,status:'filled'});
  const existingLimit=await db.prepare(limitQuery+' WHERE id=? AND account_id=?').bind(body.previewId,a.id).first();if(existingLimit)return json({order:existingLimit,replayed:true,status:existingLimit.status});
  const p=await db.prepare('SELECT * FROM previews WHERE id=? AND account_id=?').bind(body.previewId,a.id).first<Preview>();if(!p||p.expires_at<=Date.now())return json({error:'The preview expired. Request a fresh preview.'},409);
  const quote=await getStockQuote(p.symbol,await marketConfig());if(p.expires_at<=Date.now())return json({error:'The preview expired. Request a fresh preview.'},409);
  const state=await tradingState(a.id,p.symbol);
  if(p.order_type==='limit'){
   const statements=createLimitStatements({id:p.id,accountId:a.id,expectedVersion:state.account.version,processToken:randomSecret(),symbol:p.symbol,side:p.side,quantityMicros:p.quantity_micros,limitCents:p.limit_cents!,timeInForce:p.time_in_force,tradingDate:tradingDate(),createdAt:Date.now()});await db.batch(statements.map(s=>db.prepare(s.sql).bind(...s.args)));
   const saved=await db.prepare(limitQuery+' WHERE id=? AND account_id=?').bind(p.id,a.id).first();return saved?json({order:saved,status:saved.status},201):json({error:'Buying power, available shares or the 20-open-order limit changed. Request a new preview.'},409);
  }
  if((p.side==='buy'?quote.askCents:quote.bidCents)!==p.price_cents)return json({error:'The price changed. Request a new preview and confirm the updated price.'},409);
  const fill=calculateStockFill({side:p.side,quantityMicros:p.quantity_micros,quote,now:Date.now(),cashCents:state.availableCashCents,heldMicros:state.availableShares});if(fill.status!=='filled')return json({error:'Order is not executable.'},409);
  const changes=costChanges(state.holding,p.side,p.quantity_micros,fill.amountCents);if(!Number.isSafeInteger(state.account.cash_cents+fill.cashDeltaCents))throw new Error('Order value too large');
  const statements=stockFillStatements({orderId:p.id,accountId:a.id,expectedVersion:state.account.version,processToken:randomSecret(),symbol:p.symbol,side:p.side,quantityMicros:p.quantity_micros,priceCents:fill.priceCents,amountCents:fill.amountCents,cashDeltaCents:fill.cashDeltaCents,...changes,quoteTimestamp:quote.timestamp,createdAt:Date.now()});await db.batch(statements.map(s=>db.prepare(s.sql).bind(...s.args)));
  const saved=await db.prepare(publicOrderQuery()+' WHERE id=? AND account_id=?').bind(p.id,a.id).first();return saved?json({order:saved,status:'filled'},201):json({error:'The account changed while confirming. Request a new preview.'},409);
 }return json({error:'Unknown order action.'},400);
}catch(e){if(e instanceof MarketDataError)return json({error:e.message},e.status);if(e instanceof Error&&/Insufficient|Invalid|quantity|too small|too large|stale|Market is not open|Account ledger/.test(e.message))return json({error:e.message},400);return json({error:'The order could not be completed. Check Activity before retrying the same confirmation.'},503)}}
