import {authenticate,json,rateLimit} from '../../../lib/accounts/server';
import {marketConfig} from '../../../lib/trading/config';
import {optionChain} from '../../../lib/trading/options-read.mjs';
import {MarketDataError} from '../../../lib/trading/provider.mjs';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const a=await authenticate(req);if(!a)return json({error:'Create or recover your account first.'},401);if(!await rateLimit(req,'options-read:'+a.id,120))return json({error:'Too many chain requests. Try again later.'},429);const q=new URL(req.url).searchParams;return json(await optionChain((q.get('symbol')||'').trim().toUpperCase(),{type:q.get('type')||'call',expiry:q.get('expiry')||'',strike:q.get('strike')||''},await marketConfig()))}catch(e){return e instanceof MarketDataError?json({error:e.message},e.status):json({error:'The options chain is temporarily unavailable.'},503)}}
