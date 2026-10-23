import { env } from 'cloudflare:workers';
import { api } from '../../../../lib/sportsbook.mjs';
import { refresh } from '../../../../lib/sportsbook-feeds.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  if(new URL(request.url).pathname.endsWith('/quotes')){
    const allowed=await api(request,env);if(!allowed.ok)return allowed;
    await refresh(env).catch(()=>{});
  }
  return api(request,env);
}
export async function POST(request:Request){return api(request,env)}
