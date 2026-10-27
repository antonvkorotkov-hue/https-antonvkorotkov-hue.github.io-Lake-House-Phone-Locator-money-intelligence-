import { hashSecret, validSecret } from '../../../lib/accounts/crypto';
import { authenticate, clearCookie, database, issueSecrets, json, rateLimit, readBody, sameOrigin, sessionCookie, sessionSecret, SESSION_LIFETIME } from '../../../lib/accounts/server';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
 try {const a=await authenticate(req); return a?json({displayName:a.display_name,cashCents:a.cash_cents,createdAt:a.created_at}):json({error:'Sign in or create a practice account.'},401)}
 catch{return json({error:'Account service is temporarily unavailable.'},503)}
}
export async function DELETE(req:Request) {
 if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);
 try{const token=sessionSecret(req);if(token)await database().prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hashSecret(token)).run();return json({ok:true},200,{'Set-Cookie':clearCookie()})}catch{return json({error:'Could not sign out. Try again.'},503)}
}
export async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);
 try{
  if(!await rateLimit(req,'account',10))return json({error:'Too many attempts. Please try again in an hour.'},429);
  const body=await readBody(req), now=Date.now(), db=database();
  if(body.action==='create'){
   if(await authenticate(req))return json({error:'Sign out before creating another account.'},409);
   const name=typeof body.displayName==='string'?body.displayName.trim():'';
   if(!name||name.length>40||/[\x00-\x1f\x7f]/.test(name))return json({error:'Choose a display name of 1 to 40 characters.'},400);
   const s=await issueSecrets(), id=crypto.randomUUID();
   await db.batch([
    db.prepare('INSERT INTO accounts(id,display_name,cash_cents,recovery_hash,created_at) VALUES(?,?,10000000,?,?)').bind(id,name,s.recoveryHash,now),
    db.prepare('INSERT INTO sessions(token_hash,account_id,created_at,expires_at) VALUES(?,?,?,?)').bind(s.tokenHash,id,now,now+SESSION_LIFETIME),
    db.prepare('INSERT INTO ledger(id,account_id,kind,cash_delta_cents,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,'opening_balance',10000000,now)
   ]);
   return json({displayName:name,cashCents:10000000,recoveryCode:s.recovery},201,{'Set-Cookie':sessionCookie(s.token)});
  }
  if(body.action==='recover'){
   if(!validSecret(body.recoveryCode))return json({error:'Recovery code is invalid or has already been used.'},400);
   const s=await issueSecrets(),old=await hashSecret(body.recoveryCode);
   const results=await db.batch([
    db.prepare('UPDATE accounts SET recovery_hash=? WHERE recovery_hash=? RETURNING id,display_name,cash_cents').bind(s.recoveryHash,old),
    db.prepare('DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE recovery_hash=?)').bind(s.recoveryHash),
    db.prepare('INSERT INTO sessions(token_hash,account_id,created_at,expires_at) SELECT ?,id,?,? FROM accounts WHERE recovery_hash=?').bind(s.tokenHash,now,now+SESSION_LIFETIME,s.recoveryHash)
   ]);
   const a=results[0].results?.[0] as {display_name:string;cash_cents:number}|undefined;
   if(!a)return json({error:'Recovery code is invalid or has already been used.'},401);
   return json({displayName:a.display_name,cashCents:a.cash_cents,recoveryCode:s.recovery},200,{'Set-Cookie':sessionCookie(s.token)});
  }
  if(body.action==='rename'){
   const a=await authenticate(req);if(!a)return json({error:'Sign in first.'},401);
   const name=typeof body.displayName==='string'?body.displayName.trim():'';
   if(!name||name.length>40||/[\x00-\x1f\x7f]/.test(name))return json({error:'Choose a display name of 1 to 40 characters.'},400);
   await db.prepare('UPDATE accounts SET display_name=? WHERE id=?').bind(name,a.id).run();return json({displayName:name});
  }
  return json({error:'Unknown account action.'},400);
 }catch{return json({error:'Could not complete the request. Please try again.'},503)}
}
