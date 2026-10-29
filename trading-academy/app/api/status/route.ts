import {json} from '../../../lib/accounts/server';
import {configured,displayConfigured} from '../../../lib/trading/provider.mjs';
import {marketCapabilities} from '../../../lib/trading/capabilities.mjs';
import {marketConfig} from '../../../lib/trading/config';
export const dynamic='force-dynamic';
export async function GET(){const config=await marketConfig(),ready=configured(config);return json({capabilities:marketCapabilities(config),tradingAvailable:ready,marketDataAvailable:displayConfigured(config),reason:ready?'Provider configured; quotes and market status are checked per request.':'A licensed real-time market-data connection is not activated. Real-time practice orders are unavailable; authorized latest-price viewing may still be connected.',optionsAvailable:false,optionsChainAvailable:ready&&(!config.provider||config.provider==='massive')&&config.optionsLicensed===true})}
