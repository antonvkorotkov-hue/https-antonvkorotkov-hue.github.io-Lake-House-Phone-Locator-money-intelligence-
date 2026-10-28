import {MarketDataError} from './provider.mjs';
import {read} from './market-read.mjs';
const price=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:null;
const number=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const dateOk=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const frame=x=>x==='REAL-TIME'?'Real-time':x==='DELAYED'?'Delayed':x==='HISTORICAL'?'Historical':'Timeframe not supplied';
export async function optionChain(symbol,{type='call',expiry='',strike=''}={},config,{fetcher=fetch,now=Date.now()}={}){
 if(!/^[A-Z][A-Z0-9.\-]{0,14}$/.test(symbol))throw new MarketDataError('Enter a valid underlying stock or ETF symbol.',400);
 if(config.optionsLicensed!==true)throw new MarketDataError('Options-chain display is not activated. The owner must verify options-data display rights and provider access.');
 if(!['call','put'].includes(type))throw new MarketDataError('Choose calls or puts.',400);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 const params=new URLSearchParams({limit:'50',contract_type:type,sort:'expiration_date',order:'asc','expiration_date.gte':today});
 if(expiry){if(!dateOk(expiry)||expiry<today)throw new MarketDataError('Choose a valid expiration date that has not passed.',400);params.set('expiration_date',expiry)}
 if(strike!==''){const n=Number(strike);if(!Number.isFinite(n)||n<=0||n>1000000000)throw new MarketDataError('Enter a valid strike price.',400);params.set('strike_price',String(n))}
 const data=await read('/v3/snapshot/options/'+encodeURIComponent(symbol)+'?'+params,config,fetcher);
 const contracts=(data.results||[]).filter(r=>typeof r.details?.ticker==='string'&&dateOk(r.details?.expiration_date)&&r.details.expiration_date>=today&&r.details.contract_type===type&&(!expiry||r.details.expiration_date===expiry)&&(strike===''||r.details.strike_price===Number(strike))).slice(0,50).map(r=>({symbol:r.details.ticker,type:r.details.contract_type,expiration:r.details.expiration_date,strike:number(r.details.strike_price),multiplier:number(r.details.shares_per_contract),exerciseStyle:r.details.exercise_style||null,bid:price(r.last_quote?.bid),ask:price(r.last_quote?.ask),quoteTimestamp:number(r.last_quote?.last_updated)!==null?Math.floor(r.last_quote.last_updated/1e6):null,quoteTimeframe:frame(r.last_quote?.timeframe),last:price(r.last_trade?.price),lastTimestamp:number(r.last_trade?.sip_timestamp)!==null?Math.floor(r.last_trade.sip_timestamp/1e6):null,volume:number(r.day?.volume),openInterest:number(r.open_interest),iv:number(r.implied_volatility),delta:number(r.greeks?.delta),gamma:number(r.greeks?.gamma),theta:number(r.greeks?.theta),vega:number(r.greeks?.vega),underlyingPrice:number(r.underlying_asset?.price),underlyingTimestamp:number(r.underlying_asset?.last_updated)!==null?Math.floor(r.underlying_asset.last_updated/1e6):null,underlyingTimeframe:frame(r.underlying_asset?.timeframe)}));
 return {provider:'Massive',underlying:symbol,contracts,hasMore:!!data.next_url,readOnly:true,coverage:'Up to 50 matching contracts. Refine expiration and strike to narrow the result. Missing quotes and Greeks are not estimated.'};
}
