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

const native={'oai-authenticated-user-id':'fixture-owner','oai-authenticated-user-email':env.SB_OWNER_EMAIL};
await call('setup',{username:'anton',password:'original-owner-password'},{'x-setup-secret':env.SB_SETUP_SECRET});await call('provision-friends',{},native);
let login=await (await call('owner-login',{},native)).json();const auth=x=>({Authorization:'Bearer '+x.session_token,'X-CSRF-Token':x.csrf_token});
assert.equal((await call('account-options')).status,401);let options=await (await call('account-options',undefined,auth(login))).json();assert.equal(options.accounts.length,3);const admin=options.current_id,brad=options.accounts.find(x=>x.username==='brad').id,anton=options.accounts.find(x=>x.username==='anton_player').id;
assert.equal((await call('switch-account',{user_id:brad},{Authorization:auth(login).Authorization})).status,403);
let response=await call('switch-account',{user_id:brad},auth(login));assert.equal(response.status,200);let player=await response.json();let me=await (await call('me',undefined,auth(player))).json();assert.equal(me.username,'brad');assert.equal(me.role,'member');assert.equal(me.balance_points,1000);
assert.equal((await call('switch-account',{user_id:admin},auth(player))).status,403,'regular player cannot escalate to admin');assert.equal((await call('account-options',undefined,auth(player))).status,403);
assert.equal((await call('switch-account',{user_id:admin},{...auth(player),'oai-authenticated-user-email':env.SB_OWNER_EMAIL})).status,403,'email without native identity is insufficient');
options=await (await call('account-options',undefined,{...auth(player),...native})).json();assert.equal(options.current_id,brad);
await call('refill',{points:100,request_key:'switch-balance-fixture'},auth(player));response=await call('switch-account',{user_id:anton},{...auth(player),...native});assert.equal(response.status,200);player=await response.json();me=await (await call('me',undefined,auth(player))).json();assert.equal(me.username,'anton_player');assert.equal(me.balance_points,1000);
response=await call('switch-account',{user_id:admin},{...auth(player),...native});assert.equal(response.status,200);login=await response.json();assert.equal((await (await call('me',undefined,auth(login))).json()).role,'admin');
response=await call('switch-account',{user_id:brad},auth(login));player=await response.json();assert.equal((await (await call('me',undefined,auth(player))).json()).balance_points,1100,'switch preserves each balance');
sqlite.prepare('UPDATE sb_users SET enabled=0 WHERE id=?').run(anton);assert.equal((await call('switch-account',{user_id:anton},{...auth(player),...native})).status,404);assert.equal((await call('switch-account',{user_id:'missing'},{...auth(player),...native})).status,404);assert.equal(sqlite.prepare("SELECT count(*) n FROM sb_audit WHERE action='owner_account_switched'").get().n,4);assert.equal(sqlite.prepare('SELECT sum(delta) n FROM sb_postings').get().n,0);
console.log('PASS account switching: owner/admin only, CSRF, ordinary-player escalation denial, native owner identity, Brad/Anton/Admin round trip, disabled/missing rejection, separate persisted balances and audited switches.');
