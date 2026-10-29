import {configured,displayConfigured} from './provider.mjs';
export function marketCapabilities(config){
 const ready=displayConfigured(config),provider=config?.provider||'massive';
 return {provider:ready?provider:null,search:ready,latestPrices:ready,movers:ready&&provider==='massive',history:ready&&provider==='massive',trading:configured(config),optionsChain:configured(config)&&provider==='massive'&&config.optionsLicensed===true};
}
