import {json} from '../../../lib/accounts/server';
export const dynamic='force-dynamic';
export function GET(){return json({tradingAvailable:false,marketDataAvailable:false,reason:'A licensed market-data connection is not configured. Quotes, movers and order execution are unavailable.'})}
