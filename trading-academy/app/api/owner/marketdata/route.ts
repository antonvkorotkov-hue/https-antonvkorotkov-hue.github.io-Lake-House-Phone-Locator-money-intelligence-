import {probeAlternate} from '../../../../lib/trading/alternate-provider.mjs';
import {env} from 'cloudflare:workers';
import {database,json,rateLimit,readBody,sameOrigin} from '../../../../lib/accounts/server';
import {marketConfig} from '../../../../lib/trading/config';
import {encryptCredentials} from '../../../../lib/trading/credentials.mjs';
import {configured,displayConfigured,MarketDataError,probeStockAccess} from '../../../../lib/trading/provider.mjs';
import {read} from '../../../../lib/trading/market-read.mjs';
export const dynamic='force-dynamic';
function owner(req:Request){const email=req.headers.get('oai-authenticated-user-email');return !!env.OWNER_EMAIL && !!req.headers.get('oai-authenticated-user-id') && email?.trim().toLowerCase()===env.OWNER_EMAIL.toLowerCase()}
const signIn='/signin-with-chatgpt?return_to='+encodeURIComponent('/?setup=marketdata');
export async function GET(req:Request){if(!owner(req))return json({error:'Sign in with the site owner’s ChatGPT account to configure data.',signIn},401);try{return json({owner:true,configured:displayConfigured(await marketConfig()),provider:(await marketConfig()).provider||'massive',optionsAvailable:false})}catch{return json({error:'Data setup is temporarily unavailable.'},503)}}
export async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);
 if(!owner(req))return json({error:'Only the verified site owner can change this connection.'},403);
 try{
  if(!env.CREDENTIAL_ENCRYPTION_KEY)return json({error:'Secure credential storage is not configured.'},503);
  if(!await rateLimit(req,'data-setup',5))return json({error:'Too many setup attempts. Try again in an hour.'},429);
  const body=await readBody(req);
  if(typeof body.apiKey!=='string'||!/^[A-Za-z0-9_.\-]{8,256}$/.test(body.apiKey))return json({error:'Enter the provider API key.'},400);
  const provider=typeof body.provider==='string'?body.provider:'massive';if(!['massive','finnhub','stockdata'].includes(provider))return json({error:'Choose a supported provider.'},400);
  if(body.licensed!==true)return json({error:'Confirm your plan permits this public app’s display and use before connecting it.'},400);
  if(provider==='massive'){if(body.realtime!==true)return json({error:'Massive trading requires real-time bid/ask access.'},400);await probeStockAccess(body.apiKey)}else await probeAlternate({provider,apiKey:body.apiKey,licensed:true,realtime:provider==='finnhub'&&body.realtime===true});
  if(provider==='massive'&&body.optionsLicensed===true)await read('/v3/snapshot/options/AAPL?limit=1',{apiKey:body.apiKey,licensed:true,realtime:true});
  const payload=await encryptCredentials({provider,apiKey:body.apiKey,licensed:true,realtime:provider!=='stockdata'&&body.realtime===true,optionsLicensed:provider==='massive'&&body.optionsLicensed===true},env.CREDENTIAL_ENCRYPTION_KEY);
  await database().prepare('INSERT INTO settings(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind('marketdata',payload,Date.now()).run();
  return json({configured:true,message:'Connection saved securely. Search and latest prices are enabled. Practice orders additionally require real-time bid/ask and market-status access. Options trading is not enabled.'});
 }catch(e){if(e instanceof MarketDataError)return json({error:e.message},e.status);return json({error:'The connection could not be saved. Your existing connection was not changed.'},503)}
}
