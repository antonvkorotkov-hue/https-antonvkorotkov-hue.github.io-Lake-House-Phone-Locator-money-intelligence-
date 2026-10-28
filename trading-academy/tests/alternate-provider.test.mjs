import {test} from 'node:test';import assert from 'node:assert/strict';
import {alternateDetail,alternateSearch,probeAlternate} from '../lib/trading/alternate-provider.mjs';
import {getStockQuote,configured,displayConfigured} from '../lib/trading/provider.mjs';
const config={provider:'finnhub',apiKey:'test-only',licensed:true,realtime:true};
const now=Date.now();
function fixture({stale=false,closed=false,denied=false,milliseconds=false}={}){return async(url,opts)=>{assert.equal(new URL(url).origin,'https://finnhub.io');assert.equal(opts.headers['X-Finnhub-Token'],'test-only');assert.equal(url.includes('test-only'),false);if(denied)return new Response('',{status:403});return Response.json(url.includes('/profile2')?{ticker:'AAPL',currency:'USD',exchange:'NASDAQ NMS',name:'Fixture'}:url.includes('/market-status')?{isOpen:!closed,session:closed?'post-market':'regular',t:now/1000}:url.includes('/bidask')?{b:100,a:100.01,t:(now-(stale?60000:100))/(milliseconds?1:1000)}:url.includes('/search')?{result:[{symbol:'AAPL',description:'Fixture',type:'Common Stock'},{symbol:'X:Y',type:'Forex'}]}:{c:100,t:now/1000,d:1,dp:1})}}
test('Finnhub authenticates server-side, normalizes search and execution bid/ask, rejects stale/closed/unauthorized feeds',async()=>{
 const q=await getStockQuote('AAPL',config,{fetcher:fixture(),now});assert.equal(q.bidCents,10000);assert.equal(q.askCents,10001);assert.equal(q.provider,'Finnhub');assert.equal((await getStockQuote('AAPL',config,{fetcher:fixture({milliseconds:true}),now})).timestamp,now-100);
 assert.equal((await alternateSearch('apple',config,{fetcher:fixture()})).results.length,1);
 assert.equal((await alternateDetail('AAPL',config,{fetcher:fixture()})).price,100);
 for(const options of [{stale:true},{closed:true},{denied:true}])await assert.rejects(getStockQuote('AAPL',config,{fetcher:fixture(options),now}));
 assert.equal((await probeAlternate(config,{fetcher:fixture()})).accessible,true);
});
test('StockData supports exact-symbol prices without fabricating timestamps or execution quotes',async()=>{
 const c={...config,provider:'stockdata'};assert.equal(configured(c),false);assert.equal(displayConfigured(c),true);
 const fetcher=async url=>{assert.equal(new URL(url).origin,'https://api.stockdata.org');assert.equal(new URL(url).searchParams.get('api_token'),'test-only');return Response.json({data:[{ticker:'AAPL',currency:'USD',price:123.45,last_trade_time:'2026-10-27T16:00:00.000000',name:'Fixture'}]})};
 const q=await alternateDetail('AAPL',c,{fetcher});assert.equal(q.price,123.45);assert.equal(q.timestamp,null);assert.match(q.latencyLabel,/2026-10-27/);await assert.rejects(getStockQuote('AAPL',c,{fetcher}));
});
