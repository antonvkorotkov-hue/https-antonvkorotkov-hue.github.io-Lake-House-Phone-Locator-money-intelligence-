import {authenticate,database,json,rateLimit,readBody,sameOrigin} from '../../../lib/accounts/server';
import {randomSecret,validSecret} from '../../../lib/accounts/crypto';
import {calculateStockFill} from '../../../lib/trading/engine.mjs';
import {getStockQuote,MarketDataError} from '../../../lib/trading/provider.mjs';
import {marketConfig} from '../../../lib/trading/config';
import {stockFillStatements} from '../../../lib/trading/persistence.mjs';
export const dynamic='force-dynamic';
type Position={quantity_micros:number;cost_cents:number;realized_cents:number};
type Preview={id:string;account_id:string;symbol:string;side:'buy'|'sell';quantity_micros:number;price_cents:number;expires_at:number};
async function position(accountId:string,symbol:string):Promise<Position>{return await database().prepare('SELECT quantity_micros,cost_cents,realized_cents FROM positions WHERE account_id=? AND symbol=?').bind(accountId,symbol).first<Position>()||{quantity_micros:0,cost_cents:0,realized_cents:0}}
function publicOrderQuery(){return 'SELECT id,symbol,side,quantity_micros AS quantityMicros,price_cents AS priceCents,amount_cents AS amountCents,realized_delta_cents AS realizedDeltaCents,quote_timestamp AS quoteTimestamp,created_at AS createdAt FROM orders'}
export async function GET(req:Request){try{const a=await authenticate(req);if(!a)return json({error:'Sign in first.'},401);const r=await database().prepare(publicOrderQuery()+' WHERE account_id=? ORDER BY created_at DESC LIMIT 100').bind(a.id).all();return json({orders:r.results})}catch{return json({error:'Order history unavailable.'},503)}}
export async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);
 try{
  const a=await authenticate(req);if(!a)return json({error:'Sign in first.'},401);if(!await rateLimit(req,'orders',120))return json({error:'Too many order requests. Try again later.'},429);
  const body=await readBody(req),db=database();
  if(body.action==='preview'){
   const symbol=typeof body.symbol==='string'?body.symbol.trim().toUpperCase():'';
   const side=body.side;
   const quantityMicros=body.quantityMicros;
   if((side!=='buy'&&side!=='sell')||typeof quantityMicros!=='number'||!Number.isSafeInteger(quantityMicros)||quantityMicros<=0||quantityMicros>1000000000000)return json({error:'Enter a valid buy/sell side and quantity of up to 1,000,000 shares, with at most six decimal places.'},400);
   const quote=await getStockQuote(symbol,marketConfig()),p=await position(a.id,symbol);
   const fill=calculateStockFill({side,quantityMicros,quote,now:Date.now(),cashCents:a.cash_cents,heldMicros:p.quantity_micros});
   if(fill.status!=='filled')return json({error:'Order is not executable.'},409);
   const id=randomSecret(),expiresAt=Math.min(Date.now()+20000,quote.timestamp+30000),priceCents=fill.priceCents;
   await db.prepare('INSERT INTO previews(id,account_id,symbol,side,quantity_micros,price_cents,expires_at) VALUES(?,?,?,?,?,?,?)').bind(id,a.id,symbol,side,quantityMicros,priceCents,expiresAt).run();
   return json({previewId:id,symbol,side,quantityMicros,priceCents,amountCents:fill.amountCents,quoteTimestamp:quote.timestamp,provider:quote.provider,expiresAt,explanation:'Virtual market order: buys use the ask and sells use the bid. Prices round against you to whole cents. No commission. A fresh quote is checked again on confirmation.'});
  }
  if(body.action==='confirm'){
   if(!validSecret(body.previewId))return json({error:'Invalid order preview.'},400);
   const existing=await db.prepare(publicOrderQuery()+' WHERE id=? AND account_id=?').bind(body.previewId,a.id).first();if(existing)return json({order:existing,replayed:true});
   const preview=await db.prepare('SELECT * FROM previews WHERE id=? AND account_id=?').bind(body.previewId,a.id).first<Preview>();if(!preview||preview.expires_at<=Date.now())return json({error:'The preview expired. Review a fresh quote before confirming.'},409);
   const quote=await getStockQuote(preview.symbol,marketConfig());if(preview.expires_at<=Date.now())return json({error:'The preview expired. Request a fresh quote.'},409);const price=preview.side==='buy'?quote.askCents:quote.bidCents;
   if(price!==preview.price_cents)return json({error:'The market price changed. Request a new preview and confirm the updated price.'},409);
   const current=await db.prepare('SELECT cash_cents,version FROM accounts WHERE id=?').bind(a.id).first<{cash_cents:number;version:number}>();if(!current)return json({error:'Account unavailable.'},401);
   const p=await position(a.id,preview.symbol),fill=calculateStockFill({side:preview.side,quantityMicros:preview.quantity_micros,quote,now:Date.now(),cashCents:current.cash_cents,heldMicros:p.quantity_micros});
   if(fill.status!=='filled')return json({error:'Order is not executable.'},409);
   const soldCost=preview.side==='sell'?Number(BigInt(p.cost_cents)*BigInt(preview.quantity_micros)/BigInt(p.quantity_micros)):0;
   const quantityAfter=p.quantity_micros+(preview.side==='buy'?preview.quantity_micros:-preview.quantity_micros), costAfter=p.cost_cents+(preview.side==='buy'?fill.amountCents:-soldCost), realizedAfter=p.realized_cents+(preview.side==='sell'?fill.amountCents-soldCost:0);
   if(!Number.isSafeInteger(quantityAfter)||quantityAfter<0||!Number.isSafeInteger(costAfter)||costAfter<0||!Number.isSafeInteger(realizedAfter))return json({error:'Order value is too large for this simulator.'},400);
   const statements=stockFillStatements({orderId:preview.id,accountId:a.id,expectedVersion:current.version,processToken:randomSecret(),symbol:preview.symbol,side:preview.side,quantityMicros:preview.quantity_micros,priceCents:fill.priceCents,amountCents:fill.amountCents,cashDeltaCents:fill.cashDeltaCents,costDeltaCents:preview.side==='buy'?fill.amountCents:-soldCost,realizedDeltaCents:preview.side==='sell'?fill.amountCents-soldCost:0,quoteTimestamp:quote.timestamp,createdAt:Date.now()});
   await db.batch(statements.map(s=>db.prepare(s.sql).bind(...s.args)));
   const saved=await db.prepare(publicOrderQuery()+' WHERE id=? AND account_id=?').bind(preview.id,a.id).first();
   return saved?json({order:saved},201):json({error:'The account changed while the order was being confirmed. Request a new preview.'},409);
  }
  return json({error:'Unknown order action.'},400);
 }catch(e){if(e instanceof MarketDataError)return json({error:e.message},e.status);if(e instanceof Error&&/Insufficient|Invalid|quantity|too small|too large|stale|Market is not open/.test(e.message))return json({error:e.message},400);return json({error:'The order could not be completed. Check Activity before retrying the same confirmation.'},503)}
}
