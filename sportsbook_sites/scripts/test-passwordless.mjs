import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {api,hash} from '../lib/sportsbook.mjs';
const sqlite=new DatabaseSync(':memory:');
for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+f,'utf8'));
function prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){return sqlite.prepare(sql).run(...args)}}}
const db={prepare,async batch(commands){sqlite.exec('BEGIN IMMEDIATE');try{const result=[];for(const c of commands)result.push(await c.run());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const env={DB:db,SB_SETUP_SECRET:'test-bootstrap',SB_ACCOUNT_SETUP_SECRET:'test-passwordless-provision',SB_OWNER_EMAIL:'owner@example.test'};let requests=0;
async function call(path,body,extra={}){return api(new Request('https://unit.test/api/sportsbook/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:'https://unit.test','cf-connecting-ip':String(++requests),...extra},body:body===undefined?undefined:JSON.stringify(body)}),env)}
assert.equal((await call('setup',{username:'anton',password:'original-owner-password'},{'x-setup-secret':env.SB_SETUP_SECRET})).status,200);
const original=sqlite.prepare("SELECT * FROM sb_users WHERE role='admin'").get();
assert.equal((await call('provision-friends',{})).status,401);
assert.equal((await call('provision-friends',{}, {'x-account-setup-secret':'wrong'})).status,401);
assert.equal((await call('owner-login',{})).status,403);
let r=await call('provision-friends',{}, {'x-account-setup-secret':env.SB_ACCOUNT_SETUP_SECRET});assert.equal(r.status,200);const issued=await r.json();assert.equal(issued.accounts.length,2);
assert.equal(sqlite.prepare('SELECT count(*) n FROM sb_users').get().n,3);
assert.deepEqual(sqlite.prepare("SELECT * FROM sb_users WHERE role='admin'").get(),original,'existing owner account and password unchanged');
const before=sqlite.prepare('SELECT count(*) n FROM sb_postings').get().n;
assert.equal((await call('provision-friends',{}, {'x-account-setup-secret':env.SB_ACCOUNT_SETUP_SECRET})).status,409);
assert.equal(sqlite.prepare('SELECT count(*) n FROM sb_postings').get().n,before,'repeat setup creates no grants');
const members=[];
for(const account of issued.accounts){const code=new URLSearchParams(new URL(account.url).hash.slice(1)).get('access');assert(code);assert(!JSON.stringify(sqlite.prepare('SELECT * FROM sb_recovery').all()).includes(code),'only hashed link tokens stored');
 r=await call('access-login',{code});assert.equal(r.status,200);const auth=await r.json();const headers={Authorization:'Bearer '+auth.session_token,'X-CSRF-Token':auth.csrf_token};members.push(headers);
 let me=await (await call('me',undefined,headers)).json();assert.equal(me.role,'member');assert.equal(me.display_name,account.name);assert.equal(me.balance_points,1000);
 assert.equal((await call('access-login',{code})).status,400,'link cannot be reused');assert.equal((await call('admin',undefined,headers)).status,403);assert.equal((await call('provision-friends',{},headers)).status,403);
 assert.equal((await call('picks',undefined,headers)).status,200);assert.equal((await (await call('me',undefined,headers)).json()).id,me.id,'session survives another request');
}
const ownerHeaders={'oai-authenticated-user-id':'owner-id','oai-authenticated-user-email':env.SB_OWNER_EMAIL};
r=await call('owner-login',{},ownerHeaders);assert.equal(r.status,200);const owner=await r.json();const ownerSession={Authorization:'Bearer '+owner.session_token,'X-CSRF-Token':owner.csrf_token};
assert.equal((await call('admin',undefined,ownerSession)).status,200);assert.equal((await (await call('me',undefined,ownerSession)).json()).display_name,'Admin');
r=await call('provision-friends',{},ownerSession);assert.equal(r.status,200);assert.equal(sqlite.prepare('SELECT count(*) n FROM sb_postings').get().n,before,'reissuing links never changes balances');
const fresh=(await r.json()).accounts[0],expiredCode=new URLSearchParams(new URL(fresh.url).hash.slice(1)).get('access');sqlite.prepare('UPDATE sb_recovery SET expires_at=0 WHERE digest=?').run(hash('access:'+expiredCode));assert.equal((await call('access-login',{code:expiredCode})).status,400);
assert.equal((await call('owner-login',{}, {...ownerHeaders,'oai-authenticated-user-email':'other@example.test'})).status,403);
assert.equal(sqlite.prepare('SELECT sum(delta) total FROM sb_postings').get().total,0);
assert.equal((await call('logout',{},members[0])).status,200);assert.equal((await call('me',undefined,members[0])).status,401);assert.equal((await call('me',undefined,members[1])).status,200);
assert.deepEqual(sqlite.prepare("SELECT * FROM sb_users WHERE role='admin'").get(),original);
console.log('PASS passwordless accounts: protected provisioning, exactly three accounts, preserved owner credentials, one grant each, hashed single-use expiring links, member/admin isolation, owner ChatGPT login, reissue without balance changes, session persistence and logout.');
