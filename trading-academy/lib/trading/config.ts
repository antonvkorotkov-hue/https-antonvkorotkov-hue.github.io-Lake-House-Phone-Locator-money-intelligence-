import {env} from 'cloudflare:workers';
export function marketConfig(){return {apiKey:env.MARKETDATA_API_KEY,licensed:env.MARKETDATA_LICENSE_CONFIRMED==='true',realtime:env.MARKETDATA_REALTIME_CONFIRMED==='true'}}
