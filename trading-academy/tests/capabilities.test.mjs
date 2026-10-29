import {test} from 'node:test';
import assert from 'node:assert/strict';
import {marketCapabilities} from '../lib/trading/capabilities.mjs';
import {stockDetail} from '../lib/trading/market-read.mjs';
test('display-only connections keep prices available without enabling execution',async()=>{
 const config={apiKey:'test-only',provider:'massive',licensed:true,realtime:false};
 assert.deepEqual(marketCapabilities(config),{provider:'massive',search:true,latestPrices:true,movers:true,history:true,trading:false,optionsChain:false});
 const data=await stockDetail('AAPL',config,{fetcher:async url=>Response.json(url.includes('/reference/')?{results:{name:'Fixture'}}:{status:'DELAYED',ticker:{ticker:'AAPL',lastTrade:{p:10,t:1700000000000000000}}})});
 assert.equal(data.price,10);assert.match(data.latencyLabel,/Delayed/);
 for(const provider of ['finnhub','stockdata']){const flags=marketCapabilities({...config,provider,realtime:true});assert.equal(flags.movers,false);assert.equal(flags.history,false);assert.equal(flags.optionsChain,false);assert.equal(flags.trading,provider==='finnhub')}
 assert.equal(marketCapabilities({}).latestPrices,false);assert.equal(marketCapabilities({...config,licensed:false}).search,false);
 await assert.rejects(stockDetail('AAPL',{...config,licensed:false},{fetcher:()=>{throw Error('must not request upstream')}}));
});
