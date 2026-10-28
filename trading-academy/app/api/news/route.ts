import {database,json,rateLimit} from '../../../lib/accounts/server';
import {fetchOfficialNews} from '../../../lib/news/official-feeds.mjs';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 if(!await rateLimit(req,'official-news',60))return json({error:'Too many news requests. Try again later.'},429);
 const db=database(),now=Date.now();
 const cached=await db.prepare('SELECT payload,updated_at FROM settings WHERE id=?').bind('official-news').first<{payload:string;updated_at:number}>();
 let previous:Record<string,unknown>|null=null;try{previous=cached?JSON.parse(cached.payload):null}catch{}
 if(cached&&previous&&now-cached.updated_at<300000)return json({...previous,cached:true});
 const lock=crypto.randomUUID();
 const acquired=await db.prepare('INSERT INTO settings(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at WHERE settings.updated_at<? RETURNING payload').bind('official-news-lock',lock,now,now-20000).first<{payload:string}>();
 if(acquired?.payload!==lock)return previous?json({...previous,cached:true,warning:'News is being refreshed.'}):json({error:'News refresh is in progress. Please try again shortly.'},503);
 try{
  const result=await fetchOfficialNews();
  const data=result.stories.length||!previous?result:{...previous,checkedAt:Date.now(),warnings:[...result.warnings,'The last successful news response is shown because the sources could not be refreshed.']};
  await db.prepare('INSERT INTO settings(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind('official-news',JSON.stringify(data),Date.now()).run();
  return json({...data,cached:false});
 }finally{await db.prepare('DELETE FROM settings WHERE id=? AND payload=?').bind('official-news-lock',lock).run()}
}catch{return json({error:'News is temporarily unavailable. You can read the sources directly below.'},503)}}
