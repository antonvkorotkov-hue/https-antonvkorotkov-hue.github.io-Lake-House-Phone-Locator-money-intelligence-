/** Pure order validation and accounting. Monetary amounts use integer cents;
 * quantities use millionths of a share. Callers must persist atomically and
 * enforce idempotency with a unique order ID. No external orders are placed. */
export const SHARE = 1_000_000;
function integer(n, name, min=0) { if (!Number.isSafeInteger(n) || n < min) throw new Error(`Invalid ${name}`); }
export function validateQuote(q, now, maxAgeMs=30_000) {
  if (!q || q.realtime !== true || q.entitled !== true) throw new Error('Real-time licensed quote unavailable');
  integer(now,'clock'); integer(q.timestamp,'quote timestamp'); integer(maxAgeMs,'maximum quote age',1);
  if (q.timestamp > now || now-q.timestamp > maxAgeMs) throw new Error('Quote is stale or has an invalid timestamp');
  integer(q.bidCents,'bid',1); integer(q.askCents,'ask',1);
  if (q.bidCents > q.askCents) throw new Error('Invalid bid/ask spread');
  if (q.status !== 'open') throw new Error('Market is not open');
}
/** Fractional-share consideration rounds against the trader to whole cents. */
export function calculateStockFill({side, quantityMicros, quote, now, cashCents, heldMicros, limitCents}) {
  if (side !== 'buy' && side !== 'sell') throw new Error('Invalid side');
  integer(quantityMicros,'quantity',1); integer(cashCents,'cash'); integer(heldMicros,'holding');
  validateQuote(quote,now);
  const priceCents=side==='buy'?quote.askCents:quote.bidCents;
  if (limitCents !== undefined) { integer(limitCents,'limit',1); if ((side==='buy' && priceCents>limitCents)||(side==='sell' && priceCents<limitCents)) return {status:'open'}; }
  const raw=BigInt(priceCents)*BigInt(quantityMicros);
  const amountBig=side==='buy'?(raw+BigInt(SHARE)-1n)/BigInt(SHARE):raw/BigInt(SHARE);
  if (amountBig>BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Order value too large');
  const amountCents=Number(amountBig);
  if (!amountCents) throw new Error('Order value is too small');
  if (side==='buy' && amountCents>cashCents) throw new Error('Insufficient buying power');
  if (side==='sell' && quantityMicros>heldMicros) throw new Error('Insufficient shares');
  return {status:'filled',priceCents,amountCents,quantityMicros,quoteTimestamp:quote.timestamp,cashDeltaCents:side==='buy'?-amountCents:amountCents,holdingDeltaMicros:side==='buy'?quantityMicros:-quantityMicros};
}
/** Standard long option cost and expiration break-even; premiums are cents per share. */
export function optionPreview({type, contracts, premiumCents, strikeCents, multiplier=100}) {
  if(type!=='call' && type!=='put') throw new Error('Invalid option type');
  integer(contracts,'contracts',1);integer(premiumCents,'premium',1);integer(strikeCents,'strike',1);integer(multiplier,'multiplier',1);
  const total=BigInt(contracts)*BigInt(premiumCents)*BigInt(multiplier);
  if(total>BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Order value too large');
  return {costCents:Number(total),maximumLossCents:Number(total),breakevenCents:type==='call'?strikeCents+premiumCents:strikeCents-premiumCents};
}
