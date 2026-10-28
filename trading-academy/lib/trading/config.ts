import {env} from 'cloudflare:workers';
import {decryptCredentials} from './credentials.mjs';
export async function marketConfig(){
 if(env.MARKETDATA_API_KEY)return {apiKey:env.MARKETDATA_API_KEY,licensed:env.MARKETDATA_LICENSE_CONFIRMED==='true',realtime:env.MARKETDATA_REALTIME_CONFIRMED==='true',optionsLicensed:env.MARKETDATA_OPTIONS_LICENSE_CONFIRMED==='true'};
 if(!env.DB||!env.CREDENTIAL_ENCRYPTION_KEY)return {apiKey:undefined,licensed:false,realtime:false,optionsLicensed:false};
 const stored=await env.DB.prepare('SELECT payload FROM settings WHERE id=?').bind('marketdata').first<{payload:string}>();
 if(!stored)return {apiKey:undefined,licensed:false,realtime:false,optionsLicensed:false};
 try{const data=await decryptCredentials(stored.payload,env.CREDENTIAL_ENCRYPTION_KEY);return {apiKey:typeof data.apiKey==='string'?data.apiKey:undefined,licensed:data.licensed===true,realtime:data.realtime===true,optionsLicensed:data.optionsLicensed===true}}catch{return {apiKey:undefined,licensed:false,realtime:false,optionsLicensed:false}}
}
