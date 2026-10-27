import {test} from 'node:test'; import assert from 'node:assert/strict';
import {SHARE,calculateStockFill,optionPreview} from '../lib/trading/engine.mjs';
const now=1_000_000, quote={realtime:true,entitled:true,timestamp:now-500,bidCents:999,askCents:1001,status:'open'};
const order={side:'buy',quantityMicros:SHARE*2,quote,now,cashCents:10000,heldMicros:0};
test('buy uses ask and deducts cash once in calculated fill',()=>{const f=calculateStockFill(order);assert.equal(f.amountCents,2002);assert.equal(f.cashDeltaCents,-2002);assert.equal(f.holdingDeltaMicros,2*SHARE)});
test('sell uses bid, checks ownership, rounds down',()=>{const f=calculateStockFill({...order,side:'sell',quantityMicros:SHARE/2,heldMicros:SHARE});assert.equal(f.amountCents,499);assert.throws(()=>calculateStockFill({...order,side:'sell'}),/Insufficient shares/)});
test('reject stale, future, delayed, crossed and closed quotes',()=>{for(const q of [{timestamp:now-30001},{timestamp:now+1},{realtime:false},{bidCents:1002},{status:'closed'}])assert.throws(()=>calculateStockFill({...order,quote:{...quote,...q}}))});
test('buying power and limits are enforced',()=>{assert.throws(()=>calculateStockFill({...order,cashCents:2001}),/buying power/);assert.deepEqual(calculateStockFill({...order,limitCents:1000}),{status:'open'})});
test('long options cost, loss and breakeven',()=>{assert.deepEqual(optionPreview({type:'call',contracts:2,premiumCents:300,strikeCents:10000}),{costCents:60000,maximumLossCents:60000,breakevenCents:10300});assert.equal(optionPreview({type:'put',contracts:1,premiumCents:300,strikeCents:10000}).breakevenCents,9700)});
