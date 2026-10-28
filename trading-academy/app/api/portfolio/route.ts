import {authenticate,database,json} from '../../../lib/accounts/server';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const a=await authenticate(req);if(!a)return json({error:'Sign in first.'},401);const r=await database().prepare('SELECT symbol,quantity_micros AS quantityMicros,cost_cents AS costCents,realized_cents AS realizedCents FROM positions WHERE account_id=? ORDER BY symbol').bind(a.id).all();return json({cashCents:a.cash_cents,positions:r.results,valuationAvailable:false})}catch{return json({error:'Portfolio unavailable.'},503)}}
