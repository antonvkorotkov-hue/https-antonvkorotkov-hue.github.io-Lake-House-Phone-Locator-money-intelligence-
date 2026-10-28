import {validateQuote} from './engine.mjs';
export class MarketDataError extends Error { constructor(message,status=503){super(message);this.status=status;} }
export function configured(config){return !!config?.apiKey && config.licensed===true && config.realtime===true;}
export async function getStockQuote(symbol,config,{fetcher=fetch,now}={}){
 if(!configured(config))throw new MarketDataError('Real-time market data is not activated. A provider credential and verified display/use entitlements are required.');
 if(!/^[A-Z][A-Z0-9.\-]{0,14}$/.test(symbol))throw new MarketDataError('Enter a valid stock symbol.',400);
 async function read(path){let response;try{response=await fetcher('https://api.massive.com'+path,{headers:{Authorization:'Bearer '+config.apiKey},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)})}catch{throw new MarketDataError('The market-data provider could not be reached. Try again.');}if(response.status===401||response.status===403)throw new MarketDataError('The provider credential is not authorized for this data.');if(response.status===429)throw new MarketDataError('Market-data rate limit reached. Try again shortly.',429);if(!response.ok)throw new MarketDataError('Market data is temporarily unavailable.');let data;try{data=await response.json()}catch{throw new MarketDataError('The provider returned an invalid response.')}if(data.status==='DELAYED')throw new MarketDataError('This feed is delayed and cannot execute real-time practice orders.');return data;}
 const [reference,market,quotes]=await Promise.all([read('/v3/reference/tickers/'+encodeURIComponent(symbol)),read('/v1/marketstatus/now'),read('/v3/quotes/'+encodeURIComponent(symbol)+'?limit=1&sort=timestamp&order=desc')]);
 const checkedAt=now??Date.now();
 const ref=reference.results;
 if(!ref || ref.ticker!==symbol || ref.active!==true || ref.market!=='stocks' || ref.locale!=='us' || !['CS','ETF'].includes(ref.type) || ref.currency_name!=='usd' || !['XNAS','XNYS','ARCX','XASE','BATS','IEXG'].includes(ref.primary_exchange))throw new MarketDataError('This security is not supported. Only active, supported US-listed common stocks and ETFs in USD are currently eligible.',400);
 const marketTime=Date.parse(market.serverTime);
 if(!Number.isFinite(marketTime)||Math.abs(checkedAt-marketTime)>60000)throw new MarketDataError('The provider market-status timestamp is unavailable or stale.');
 const q=quotes.results?.[0];
 if(!q || !Number.isFinite(q.bid_price)||!Number.isFinite(q.ask_price))throw new MarketDataError('A valid bid and ask are unavailable.');
 const quote={symbol,name:ref.name,bidCents:Math.floor(q.bid_price*100+1e-7),askCents:Math.ceil(q.ask_price*100-1e-7),timestamp:Math.floor(q.sip_timestamp/1e6),status:market.exchanges?.nyse==='open'&&market.exchanges?.nasdaq==='open'?'open':'closed',realtime:true,entitled:true,provider:'Massive',latencyLabel:'Real-time',bidSize:q.bid_size,askSize:q.ask_size};
 try{validateQuote(quote,checkedAt)}catch(e){throw new MarketDataError(e.message,409)}
 return quote;
}
/** Read-only capability probe; it does not claim to verify contractual use rights. */
export async function probeStockAccess(apiKey,{fetcher=fetch}={}){
 for(const path of ['/v3/reference/tickers/AAPL','/v3/quotes/AAPL?limit=1&sort=timestamp&order=desc']){
  let response;try{response=await fetcher('https://api.massive.com'+path,{headers:{Authorization:'Bearer '+apiKey},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)})}catch{throw new MarketDataError('The provider could not be reached. Your existing connection was not changed.')}
  if(response.status===401||response.status===403)throw new MarketDataError('The key does not have access to the required stock reference and bid/ask quote endpoints.',400);
  if(response.status===429)throw new MarketDataError('The provider rate limit was reached. Try again later.',429);
  if(!response.ok)throw new MarketDataError('The provider returned an error. Your existing connection was not changed.');
  const body=await response.json();if(body.status==='DELAYED')throw new MarketDataError('This key returned delayed data. A real-time subscription is required.',400);
  if(path.includes('/quotes/')&&(!Array.isArray(body.results)||!body.results.length||!Number.isFinite(body.results[0].bid_price)||!Number.isFinite(body.results[0].ask_price)||body.results[0].bid_price<=0||body.results[0].ask_price<body.results[0].bid_price||!Number.isFinite(body.results[0].sip_timestamp)))throw new MarketDataError('The provider did not return a stock bid/ask quote. Check the key’s product access.',400);
 }
 return {quoteEndpointAccessible:true};
}
