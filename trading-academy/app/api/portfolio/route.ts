import {authenticate,database,json} from '../../../lib/accounts/server';
import {marketConfig} from '../../../lib/trading/config';
import {portfolioMarks} from '../../../lib/trading/market-read.mjs';
import {configured} from '../../../lib/trading/provider.mjs';
import {valuePortfolio} from '../../../lib/trading/valuation.mjs';
export const dynamic='force-dynamic';
type Position={symbol:string;quantityMicros:number;costCents:number;realizedCents:number};
export async function GET(req:Request){try{
 const a=await authenticate(req);if(!a)return json({error:'Sign in first.'},401);const db=database();
 const data=await db.prepare('SELECT symbol,quantity_micros AS quantityMicros,cost_cents AS costCents,realized_cents AS realizedCents FROM positions WHERE account_id=? ORDER BY symbol').bind(a.id).all<Position>();
 const reserved=await db.prepare("SELECT COALESCE(SUM(reserved_cents),0) AS amount FROM limit_orders WHERE account_id=? AND status='open' AND side='buy'").bind(a.id).first<{amount:number}>();
 const opening=await db.prepare("SELECT cash_delta_cents AS amount FROM ledger WHERE account_id=? AND kind='opening_balance' ORDER BY created_at LIMIT 1").bind(a.id).first<{amount:number}>();
 const symbols=data.results.filter(p=>p.quantityMicros>0).map(p=>p.symbol),config=await marketConfig();let marks:Awaited<ReturnType<typeof portfolioMarks>>['marks']=[],valuationMessage='Latest available provider marks; see each price timestamp.';
 if(symbols.length){if(!configured(config))valuationMessage='A market-data connection is required to value open positions.';else try{const result=await portfolioMarks(symbols.slice(0,50),config);marks=result.marks;valuationMessage=result.provider+' · '+result.latencyLabel+(symbols.length>50?' · Some holdings exceed the 50-symbol response limit.':'')}catch{valuationMessage='Current position marks are unavailable. No missing price has been treated as zero.'}}
 const current=await db.prepare('SELECT version FROM accounts WHERE id=?').bind(a.id).first<{version:number}>();if(current?.version!==a.version)return json({error:'Your account changed while prices were loading. Refresh the portfolio.'},409);
 const value=valuePortfolio({cashCents:a.cash_cents,positions:data.results,marks,openingCents:opening?.amount||0});
 await db.prepare("INSERT INTO equity_history(id,account_id,captured_at,cash_cents,market_value_cents,equity_cents) SELECT ?,account_id,created_at,cash_delta_cents,0,cash_delta_cents FROM ledger WHERE account_id=? AND kind='opening_balance' ORDER BY created_at LIMIT 1 ON CONFLICT(id) DO NOTHING").bind(a.id+':opening',a.id).run();
 if(value.valuationAvailable&&value.totalEquityCents!==null){const now=Date.now();await db.prepare('INSERT INTO equity_history(id,account_id,captured_at,cash_cents,market_value_cents,equity_cents,source_as_of) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET captured_at=excluded.captured_at,cash_cents=excluded.cash_cents,market_value_cents=excluded.market_value_cents,equity_cents=excluded.equity_cents,source_as_of=excluded.source_as_of').bind(a.id+':mark:'+Math.floor(now/900000),a.id,now,a.cash_cents,value.totalMarketValueCents,value.totalEquityCents,value.oldestMarkTimestamp).run()}
 const history=await db.prepare('SELECT captured_at AS capturedAt,equity_cents AS equityCents,source_as_of AS sourceAsOf FROM equity_history WHERE account_id=? ORDER BY captured_at DESC,id DESC LIMIT 200').bind(a.id).all();
 return json({cashCents:a.cash_cents,reservedCashCents:reserved?.amount||0,buyingPowerCents:a.cash_cents-(reserved?.amount||0),...value,valuationMessage:symbols.length?valuationMessage:'Cash-only account; no market prices are needed.',history:history.results.reverse()});
}catch{return json({error:'Portfolio unavailable.'},503)}}
