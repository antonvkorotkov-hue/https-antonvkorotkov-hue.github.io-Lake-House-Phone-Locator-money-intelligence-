import { env } from 'cloudflare:workers';
import { hashSecret, randomSecret, validSecret } from '../../../lib/accounts/crypto';
export const dynamic = 'force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const lifetime=90*24*60*60*1000;
function db(): D1Database { if (!env.DB) throw new Error('Database unavailable'); return env.DB; }
async function limit(req:Request):Promise<boolean>{
 const ip=req.headers.get('cf-connecting-ip'); if(!ip)return false;
 const key=await hashSecret('account:'+ip); const now=Date.now();
 const row=await db().prepare('INSERT INTO rate_limits (key,count,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at<=? THEN ? ELSE reset_at END RETURNING count').bind(key,now+3600000,now,now,now+3600000).first<{count:number}>();
 return !!row && row.count<=10;
}
async function session(req:Request){const auth=req.headers.get('authorization')||'';const secret=auth.startsWith('Bearer ')?auth.slice(7):'';if(!validSecret(secret))return null;return db().prepare('SELECT a.display_name, a.cash_cents FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hashSecret(secret),Date.now()).first<{display_name:string,cash_cents:number}>();}
export async function GET(req:Request){try{const a=await session(req);return a?reply({displayName:a.display_name,cashCents:a.cash_cents}):reply({error:'Session not found or expired'},401)}catch{return reply({error:'Account service unavailable'},503)}}
export async function POST(req:Request){
 try {
  if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid request origin'},403);
  if(!(await limit(req)))return reply({error:'Too many attempts. Try again later.'},429);
  const body=await req.json() as {action?:string,displayName?:unknown,recoveryCode?:unknown};
  const now=Date.now(), token=randomSecret(), recovery=randomSecret();
  const tokenHash=await hashSecret(token), recoveryHash=await hashSecret(recovery);
  if(body.action==='create'){
   const name=typeof body.displayName==='string'?body.displayName.trim():'';
   if(name.length<1||name.length>40||/[\x00-\x1f\x7f]/.test(name))return reply({error:'Choose a display name of 1 to 40 characters.'},400);
   const id=crypto.randomUUID();
   await db().batch([
    db().prepare('INSERT INTO accounts(id,display_name,cash_cents,recovery_hash,created_at) VALUES(?,?,10000000,?,?)').bind(id,name,recoveryHash,now),
    db().prepare('INSERT INTO sessions(token_hash,account_id,created_at,expires_at) VALUES(?,?,?,?)').bind(tokenHash,id,now,now+lifetime),
    db().prepare('INSERT INTO ledger(id,account_id,kind,cash_delta_cents,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,'opening_balance',10000000,now)
   ]);
   return reply({displayName:name,cashCents:10000000,sessionToken:token,recoveryCode:recovery});
  }
  if(body.action==='recover'){
   if(!validSecret(body.recoveryCode))return reply({error:'Recovery code is invalid or already used.'},400);
   const old=await hashSecret(body.recoveryCode);
   const results=await db().batch([
    db().prepare('UPDATE accounts SET recovery_hash=? WHERE recovery_hash=? RETURNING id,display_name,cash_cents').bind(recoveryHash,old),
    db().prepare('DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE recovery_hash=?)').bind(recoveryHash),
    db().prepare('INSERT INTO sessions(token_hash,account_id,created_at,expires_at) SELECT ?,id,?,? FROM accounts WHERE recovery_hash=?').bind(tokenHash,now,now+lifetime,recoveryHash)
   ]);
   const account=results[0].results?.[0] as {display_name:string,cash_cents:number}|undefined;
   if(!account)return reply({error:'Recovery code is invalid or already used.'},401);
   return reply({displayName:account.display_name,cashCents:account.cash_cents,sessionToken:token,recoveryCode:recovery});
  }
  return reply({error:'Unknown action'},400);
 }catch{return reply({error:'Account service unavailable'},503)}
}
