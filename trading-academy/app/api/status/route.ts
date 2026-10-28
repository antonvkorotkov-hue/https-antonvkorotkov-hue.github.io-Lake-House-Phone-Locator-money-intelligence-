import {json} from '../../../lib/accounts/server';
import {configured} from '../../../lib/trading/provider.mjs';
import {marketConfig} from '../../../lib/trading/config';
export const dynamic='force-dynamic';
export async function GET(){const ready=configured(await marketConfig());return json({tradingAvailable:ready,marketDataAvailable:ready,reason:ready?'Provider configured; quotes and market status are checked per request.':'A licensed real-time market-data connection is not activated. Quotes and order execution are unavailable.',optionsAvailable:false})}
