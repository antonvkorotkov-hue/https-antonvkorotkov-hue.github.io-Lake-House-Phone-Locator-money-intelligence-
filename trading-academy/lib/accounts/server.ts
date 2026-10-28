import { env } from 'cloudflare:workers';
import { hashSecret, randomSecret, validSecret } from './crypto';
export const COOKIE = import.meta.env.DEV ? 'lh-preview-session' : '__Host-lh-session';
const SECURE = import.meta.env.DEV ? '' : '; Secure';
export const SESSION_LIFETIME = 90 * 24 * 60 * 60 * 1000;
export function database(): D1Database { if (!env.DB) throw new Error('Database unavailable'); return env.DB; }
export function json(body: unknown, status = 200, extra: Record<string,string> = {}) {
 return Response.json(body,{status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
}
export function sessionSecret(req: Request): string | null {
 const value = (req.headers.get('cookie') || '').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 return validSecret(value) ? value : null;
}
export function sessionCookie(token: string) { return `${COOKIE}=${token}; Path=/; HttpOnly${SECURE}; SameSite=Strict; Max-Age=${SESSION_LIFETIME/1000}`; }
export function clearCookie() { return `${COOKIE}=; Path=/; HttpOnly${SECURE}; SameSite=Strict; Max-Age=0`; }
export type Account = {id:string; display_name:string; cash_cents:number; created_at:number;version:number};
export async function authenticate(req: Request): Promise<Account | null> {
 const token = sessionSecret(req); if (!token) return null;
 return database().prepare('SELECT a.id,a.display_name,a.cash_cents,a.created_at,a.version FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hashSecret(token),Date.now()).first<Account>();
}
export function sameOrigin(req: Request) { return req.headers.get('origin') === new URL(req.url).origin; }
export async function readBody(req: Request): Promise<Record<string,unknown>> {
 if (!req.headers.get('content-type')?.startsWith('application/json')) throw new Error('JSON required');
 const text=await req.text(); if(text.length>4096) throw new Error('Request too large');
 const body=JSON.parse(text); if(!body || Array.isArray(body) || typeof body!=='object') throw new Error('Invalid request'); return body;
}
export async function rateLimit(req: Request, group: string, maximum=20) {
 let source=req.headers.get('cf-connecting-ip');
 if (!source && import.meta.env.DEV) source='local-preview';
 if(!source)return false;
 const now=Date.now(), key=await hashSecret(`${group}:${Math.floor(now/3600000)}:${source}`);
 const row=await database().prepare('INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+3600000).first<{count:number}>();
 return !!row && row.count<=maximum;
}
export async function issueSecrets() { const token=randomSecret(), recovery=randomSecret(); return {token,recovery,tokenHash:await hashSecret(token),recoveryHash:await hashSecret(recovery)}; }
