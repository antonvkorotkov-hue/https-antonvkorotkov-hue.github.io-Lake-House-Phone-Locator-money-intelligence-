import {authenticate,json,rateLimit} from '../../../../lib/accounts/server';
import {getStockQuote,MarketDataError} from '../../../../lib/trading/provider.mjs';
import {marketConfig} from '../../../../lib/trading/config';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{if(!await authenticate(req))return json({error:'Create or recover a practice account first.'},401);if(!await rateLimit(req,'quotes',120))return json({error:'Too many quote requests. Try again later.'},429);const symbol=(new URL(req.url).searchParams.get('symbol')||'').trim().toUpperCase();return json(await getStockQuote(symbol,await marketConfig()))}catch(e){return e instanceof MarketDataError?json({error:e.message},e.status):json({error:'Quote service unavailable.'},503)}}
