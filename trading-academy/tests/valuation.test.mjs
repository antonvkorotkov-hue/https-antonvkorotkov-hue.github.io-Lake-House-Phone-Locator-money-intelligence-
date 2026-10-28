import {test} from 'node:test';
import assert from 'node:assert/strict';
import {valuePortfolio} from '../lib/trading/valuation.mjs';
import {reserveCost} from '../lib/trading/limits.mjs';
test('portfolio marks reconcile cash, fractional positions, realized and unrealized P/L',()=>{
 const result=valuePortfolio({cashCents:9500,openingCents:10000,positions:[{symbol:'AAPL',quantityMicros:500000,costCents:500,realizedCents:25}],marks:[{symbol:'AAPL',price:12,timestamp:1000}]});
 assert.equal(result.totalMarketValueCents,600);assert.equal(result.totalEquityCents,10100);assert.equal(result.totalUnrealizedCents,100);assert.equal(result.totalRealizedCents,25);assert.equal(result.totalProfitLossCents,100);assert.equal(result.totalReturnPercent,1);assert.equal(result.oldestMarkTimestamp,1000);
});
test('missing marks never create a zero-valued holding or a fabricated total',()=>{
 const result=valuePortfolio({cashCents:9500,openingCents:10000,positions:[{symbol:'AAPL',quantityMicros:500000,costCents:500,realizedCents:0}],marks:[]});
 assert.equal(result.valuationAvailable,false);assert.equal(result.totalEquityCents,null);assert.equal(result.positions[0].marketValueCents,null);
 const cash=valuePortfolio({cashCents:10000,openingCents:10000,positions:[],marks:[]});assert.equal(cash.totalEquityCents,10000);
 assert.equal(reserveCost('buy',1,101),1);assert.equal(reserveCost('sell',1000000,101),0);assert.throws(()=>reserveCost('buy',Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER));
});
