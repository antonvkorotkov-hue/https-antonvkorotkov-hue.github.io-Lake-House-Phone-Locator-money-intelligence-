/** Generates a single atomic D1 batch. The account version serializes fills;
 * a per-attempt token prevents an idempotent replay from mutating balances. */
export function stockFillStatements({orderId,accountId,expectedVersion,processToken,symbol,side,quantityMicros,priceCents,amountCents,cashDeltaCents,costDeltaCents,realizedDeltaCents,quoteTimestamp,createdAt}) {
 const quantityDelta=side==='buy'?quantityMicros:-quantityMicros;
 const minimumCash=side==='buy'?amountCents:0;
 const minimumShares=side==='sell'?quantityMicros:0;
 return [
  {sql:'INSERT INTO orders(id,account_id,process_token,symbol,side,quantity_micros,price_cents,amount_cents,cash_delta_cents,cost_delta_cents,realized_delta_cents,quote_timestamp,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? FROM accounts WHERE id=? AND version=? AND cash_cents>=? AND COALESCE((SELECT quantity_micros FROM positions WHERE account_id=? AND symbol=?),0)>=? ON CONFLICT(id) DO NOTHING',args:[orderId,accountId,processToken,symbol,side,quantityMicros,priceCents,amountCents,cashDeltaCents,costDeltaCents,realizedDeltaCents,quoteTimestamp,createdAt,accountId,expectedVersion,minimumCash,accountId,symbol,minimumShares]},
  {sql:'UPDATE accounts SET cash_cents=cash_cents+?,version=version+1 WHERE id=? AND EXISTS(SELECT 1 FROM orders WHERE id=? AND account_id=? AND process_token=?)',args:[cashDeltaCents,accountId,orderId,accountId,processToken]},
  {sql:'INSERT INTO positions(account_id,symbol,quantity_micros,cost_cents,realized_cents) SELECT account_id,symbol,?,?,? FROM orders WHERE id=? AND account_id=? AND process_token=? ON CONFLICT(account_id,symbol) DO UPDATE SET quantity_micros=quantity_micros+excluded.quantity_micros,cost_cents=cost_cents+excluded.cost_cents,realized_cents=realized_cents+excluded.realized_cents',args:[quantityDelta,costDeltaCents,realizedDeltaCents,orderId,accountId,processToken]},
  {sql:'INSERT INTO ledger(id,account_id,kind,cash_delta_cents,created_at) SELECT id,account_id,?,cash_delta_cents,created_at FROM orders WHERE id=? AND account_id=? AND process_token=?',args:['stock_'+side,orderId,accountId,processToken]}
 ];
}
