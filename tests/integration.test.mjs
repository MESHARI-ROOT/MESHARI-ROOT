import {test,after} from 'node:test';
import {randomBytes} from 'node:crypto';
const initialPassword=randomBytes(24).toString('hex'),replacementPassword=randomBytes(24).toString('hex');
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createApp} from '../server/app.mjs';
import {passwordHash,normalizeCode,verifyPassword,sha256} from '../server/security.mjs';
const pg=new PGlite();for(const file of (await readdir('netlify/database/migrations')).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile('netlify/database/migrations/'+file,'utf8'));
// Isolate access-control fixtures from catalog seed migrations in this in-memory database.
await pg.exec('DELETE FROM zen_scripts');
const db={query:(sql,p=[])=>pg.query(sql,p),transaction:fn=>pg.transaction(fn)};
const env={AUTH_PEPPER:randomBytes(48).toString('hex'),ADMIN_USER:'meshari',ADMIN_PASSWORD_HASH:await passwordHash(initialPassword)};
const errors=[];const app=createApp({db,env,logger:{error:(...v)=>errors.push(v)}});
let adminCookie,seq=100000000;
async function call(path,{method='GET',data,cookie=adminCookie,origin='https://zen.example',ip='192.0.2.25',csrf=true}={}){
 const headers={'user-agent':'Chrome/140 Windows',...(cookie?{cookie}:{}),...(data!==undefined?{'content-type':'application/json'}:{}),...(origin?{origin}:{}),...(csrf?{'X-Zen-Request':'1'}:{})};
 const response=await app(new Request('https://zen.example/api'+path,{method,headers,...(data!==undefined?{body:JSON.stringify(data)}:{})}),{ip});
 const json=response.headers.get('content-type')?.includes('application/json')?await response.clone().json():null;return {response,status:response.status,json,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const login=await call('/auth/admin',{method:'POST',data:{username:'meshari',password:initialPassword},cookie:null});assert.equal(login.status,200);adminCookie=login.cookie;
const clientData=(overrides={})=>({name:'عميل اختبار',code:String(++seq),active:true,allScripts:false,allowedScriptIds:[],expiresAt:new Date(Date.now()+86400000*30).toISOString(),maxSessions:1,notes:'ملاحظة خاصة',...overrides});
async function createClient(overrides={}){const input=clientData(overrides),r=await call('/admin/clients',{method:'POST',data:input});assert.equal(r.status,201,JSON.stringify(r.json));return {...r.json,input};}
async function clientLogin(code){return call('/auth/client',{method:'POST',data:{code},cookie:null,ip:'198.51.100.'+(++seq%200)});}
const scriptData=(overrides={})=>({title:'سكربت اختبار آمن',category:'اختبار',version:'1.0',description:'شرح',requirements:'متطلبات',installation:'خطوات',usage:'استخدام',changelog:'أول نسخة',published:true,fileName:'example.gpc',fileBase64:Buffer.from('// Test fixture only\nmain {}').toString('base64'),...overrides});
async function script(overrides={}){const r=await call('/admin/scripts',{method:'POST',data:scriptData(overrides)});assert.equal(r.status,201,JSON.stringify(r.json));return r.json;}
after(async()=>{assert.deepEqual(errors,[],'No unexpected backend errors');await pg.close();});
test('normalizes Arabic/Persian codes and preserves leading zero',()=>{assert.equal(normalizeCode('٠١٢٣٤٥٦٧٨'),'012345678');assert.equal(normalizeCode('۰۱۲۳۴۵۶۷۸'),'012345678');assert.throws(()=>normalizeCode('123'));assert.throws(()=>normalizeCode('12345678a'));});
test('password hashing verifies correct password and rejects wrong one',async()=>{assert.equal(await verifyPassword(initialPassword,env.ADMIN_PASSWORD_HASH),true);assert.equal(await verifyPassword('wrong',env.ADMIN_PASSWORD_HASH),false);});
test('server rejects anonymous protected access',async()=>{assert.equal((await call('/scripts',{cookie:null})).status,401);assert.equal((await call('/admin/clients',{cookie:null})).status,401);});
test('rejects cross-origin and missing CSRF marker writes',async()=>{assert.equal((await call('/admin/clients',{method:'POST',data:clientData(),origin:'https://evil.example'})).status,403);assert.equal((await call('/admin/clients',{method:'POST',data:clientData(),csrf:false})).status,403);});
test('admin cookie is secure, HttpOnly and SameSite Strict',()=>{const c=login.response.headers.get('set-cookie');for(const part of ['__Host-zen=','Secure','HttpOnly','SameSite=Strict','Path=/'])assert.ok(c.includes(part));assert.equal(login.response.headers.get('Cache-Control'),'no-store');});
test('manual codes required, unique, masked and not stored plaintext',async()=>{const c=await createClient({code:'001234567'});assert.equal(c.maskedCode,'••••••567');assert.ok(!('codeHash'in c));assert.equal((await call('/admin/clients',{method:'POST',data:clientData({code:'001234567'})})).status,409);assert.equal((await call('/admin/clients',{method:'POST',data:clientData({code:''})})).status,422);const row=(await pg.query('SELECT code_hash FROM zen_clients WHERE id=$1',[c.id])).rows[0];assert.notEqual(row.code_hash,c.input.code);assert.equal((await clientLogin('٠٠١٢٣٤٥٦٧')).status,200);});
test('customer cannot use admin APIs or see unpublished/unauthorized files',async()=>{const c=await createClient(),s=await script(),draft=await script({published:false});const auth=await clientLogin(c.input.code);assert.equal((await call('/admin/clients',{cookie:auth.cookie})).status,403);assert.deepEqual((await call('/scripts',{cookie:auth.cookie})).json,[]);assert.equal((await call('/scripts/'+s.id+'/download',{cookie:auth.cookie})).status,404);assert.equal((await call('/scripts/'+draft.id,{cookie:auth.cookie})).status,404);});
test('assigned script can be downloaded with exact SHA and private headers',async()=>{const s=await script(),c=await createClient({allowedScriptIds:[s.id]});const a=await clientLogin(c.input.code);const list=await call('/scripts',{cookie:a.cookie});assert.equal(list.json.length,1);const r=await call('/scripts/'+s.id+'/download',{cookie:a.cookie});assert.equal(r.status,200);assert.equal(sha256(Buffer.from(await r.response.arrayBuffer())),s.sha256);assert.equal(r.response.headers.get('X-Content-SHA256'),s.sha256);assert.ok(r.response.headers.get('Content-Disposition').startsWith('attachment;'));assert.equal(r.response.headers.get('Cache-Control'),'no-store');});
test('expiration blocks already authenticated clients and new logins',async()=>{const c=await createClient({allScripts:true}),a=await clientLogin(c.input.code);await pg.query("UPDATE zen_clients SET expires_at=now()-interval '1 second' WHERE id=$1",[c.id]);assert.equal((await call('/me',{cookie:a.cookie})).status,401);assert.equal((await call('/scripts',{cookie:a.cookie})).status,401);assert.equal((await clientLogin(c.input.code)).status,401);});
test('extension renews expired account from now and increments revision',async()=>{const c=await createClient();await pg.query("UPDATE zen_clients SET expires_at=now()-interval '10 days',active=false WHERE id=$1",[c.id]);const r=await call('/admin/clients/'+c.id+'/extend',{method:'POST',data:{days:7,revision:c.revision}});assert.equal(r.status,200);assert.equal(r.json.active,true);assert.ok(new Date(r.json.expiresAt)>Date.now()+6.9*86400000);assert.equal(r.json.revision,c.revision+1);assert.equal((await call('/admin/clients/'+c.id+'/extend',{method:'POST',data:{days:7,revision:c.revision}})).status,409);});
test('disable immediately revokes sessions',async()=>{const c=await createClient(),a=await clientLogin(c.input.code);const r=await call('/admin/clients/'+c.id,{method:'PUT',data:{...c.input,code:'',active:false,revision:c.revision}});assert.equal(r.status,200);assert.equal((await call('/me',{cookie:a.cookie})).status,401);assert.equal((await clientLogin(c.input.code)).status,401);});
test('code rotation revokes session, old code fails, new code works',async()=>{const c=await createClient(),a=await clientLogin(c.input.code),newCode=String(++seq);const r=await call('/admin/clients/'+c.id,{method:'PUT',data:{...c.input,code:newCode,revision:c.revision}});assert.equal(r.status,200);assert.equal((await call('/me',{cookie:a.cookie})).status,401);assert.equal((await clientLogin(c.input.code)).status,401);assert.equal((await clientLogin(newCode)).status,200);});
test('max session limit replaces previous session and owner can revoke all',async()=>{const c=await createClient(),a=await clientLogin(c.input.code),b=await clientLogin(c.input.code);assert.equal((await call('/me',{cookie:a.cookie})).status,401);assert.equal((await call('/me',{cookie:b.cookie})).status,200);await call('/admin/clients/'+c.id+'/revoke',{method:'POST',data:{}});assert.equal((await call('/me',{cookie:b.cookie})).status,401);});
test('permissions update removes access from existing session',async()=>{const s=await script(),c=await createClient({allowedScriptIds:[s.id]}),a=await clientLogin(c.input.code);await call('/admin/clients/'+c.id,{method:'PUT',data:{...c.input,code:'',allowedScriptIds:[],revision:c.revision}});assert.equal((await call('/scripts/'+s.id+'/download',{cookie:a.cookie})).status,404);});
test('invalid permissions rollback client creation atomically',async()=>{const code=String(++seq);const r=await call('/admin/clients',{method:'POST',data:clientData({code,allowedScriptIds:['11111111-1111-4111-8111-111111111111']})});assert.equal(r.status,422);const next=await createClient({code});assert.ok(next.id);});
test('script update revision prevents lost writes, unpublished is hidden',async()=>{const s=await script(),c=await createClient({allScripts:true}),a=await clientLogin(c.input.code);const data={...scriptData({published:false}),revision:s.revision};assert.equal((await call('/admin/scripts/'+s.id,{method:'PUT',data})).status,200);assert.equal((await call('/admin/scripts/'+s.id,{method:'PUT',data})).status,409);assert.equal((await call('/scripts/'+s.id,{cookie:a.cookie})).status,404);});
test('rejects invalid uploads and past subscriptions',async()=>{assert.equal((await call('/admin/scripts',{method:'POST',data:scriptData({fileName:'../file.gpc'})})).status,422);assert.equal((await call('/admin/scripts',{method:'POST',data:scriptData({fileBase64:Buffer.alloc(2097153).toString('base64')})})).status,413);assert.equal((await call('/admin/clients',{method:'POST',data:clientData({expiresAt:'2000-01-01T00:00:00Z'})})).status,422);});
test('dashboard, audit and sessions expose activity without tokens or codes',async()=>{const d=await call('/admin/dashboard');assert.equal(d.status,200);assert.ok(d.json.total>0);const logs=await call('/admin/audit');assert.ok(logs.json.items.length);const sessions=await call('/admin/sessions');assert.ok(!JSON.stringify(sessions.json).includes('tokenHash'));assert.ok(logs.json.items.every(x=>!x.ipHint.endsWith('.25')));});
test('firmware/installation confirmations are labelled as client reports',async()=>{const c=await createClient(),a=await clientLogin(c.input.code);for(const action of ['firmware_confirmed','installation_confirmed'])assert.equal((await call('/activity',{method:'POST',data:{action},cookie:a.cookie})).status,200);const log=await call('/admin/audit?clientId='+c.id);assert.ok(log.json.items.some(x=>x.detail.includes('أكد العميل')));});
test('login throttling is persisted across app instances',async()=>{let r;for(let n=0;n<21;n++)r=await call('/auth/client',{method:'POST',data:{code:'999999999'},cookie:null,ip:'203.0.113.200'});assert.equal(r.status,429);const app2=createApp({db,env});const response=await app2(new Request('https://zen.example/api/auth/client',{method:'POST',headers:{origin:'https://zen.example','X-Zen-Request':'1','content-type':'application/json'},body:'{"code":"999999999"}'}),{ip:'203.0.113.200'});assert.equal(response.status,429);});
test('owner password change revokes all admin sessions',async()=>{const r=await call('/admin/password',{method:'POST',data:{currentPassword:initialPassword,newPassword:replacementPassword}});assert.equal(r.status,200);assert.equal((await call('/admin/clients')).status,401);const logged=await call('/auth/admin',{method:'POST',cookie:null,data:{username:'meshari',password:replacementPassword}});assert.equal(logged.status,200);adminCookie=logged.cookie;});
test('public catalogue lists published free and paid metadata without protected material',async()=>{
 const free=await script({accessTier:'free',priceHalalas:0}),paid=await script({accessTier:'paid',priceHalalas:12500}),draft=await script({published:false,accessTier:'free'});
 const r=await call('/catalog',{cookie:null});assert.equal(r.status,200);assert.ok(r.json.some(x=>x.id===free.id&&x.accessTier==='free'));assert.ok(r.json.some(x=>x.id===paid.id&&x.priceHalalas===12500));assert.ok(!r.json.some(x=>x.id===draft.id));for(const item of r.json)for(const key of ['fileData','fileName','sha256','installation','usage','requirements'])assert.ok(!(key in item));
});
test('anonymous free downloads return exact bytes and cannot access paid or draft IDs',async()=>{
 const free=await script({accessTier:'free'}),paid=await script(),draft=await script({accessTier:'free',published:false});
 const detail=await call('/free-scripts/'+free.id,{cookie:null});assert.equal(detail.status,200);const r=await call('/free-scripts/'+free.id+'/download',{cookie:null});assert.equal(r.status,200);assert.equal(sha256(Buffer.from(await r.response.arrayBuffer())),free.sha256);
 for(const id of [paid.id,draft.id])for(const suffix of ['','/download'])assert.equal((await call('/free-scripts/'+id+suffix,{cookie:null})).status,404);
});
test('moving free script to paid immediately closes public download and requires entitlement',async()=>{
 const free=await script({accessTier:'free'}),c=await createClient(),session=await clientLogin(c.input.code);
 assert.equal((await call('/scripts/'+free.id+'/download',{cookie:session.cookie})).status,200);
 assert.equal((await call('/admin/scripts/'+free.id,{method:'PUT',data:{...scriptData({accessTier:'paid',priceHalalas:5000}),revision:free.revision}})).status,200);
 assert.equal((await call('/free-scripts/'+free.id+'/download',{cookie:null})).status,404);assert.equal((await call('/scripts/'+free.id+'/download',{cookie:session.cookie})).status,404);
});
test('paid updates are available to entitled active customers but never after expiry',async()=>{
 const s=await script({accessTier:'paid'}),c=await createClient({allowedScriptIds:[s.id]}),session=await clientLogin(c.input.code);
 const updated=await call('/admin/scripts/'+s.id,{method:'PUT',data:{...scriptData({version:'2.0',fileBase64:Buffer.from('// Version 2').toString('base64')}),revision:s.revision}});assert.equal(updated.status,200);
 assert.equal((await call('/scripts/'+s.id,{cookie:session.cookie})).json.version,'2.0');await pg.query("UPDATE zen_clients SET expires_at=now()-interval '1 day' WHERE id=$1",[c.id]);assert.equal((await call('/scripts/'+s.id+'/download',{cookie:session.cookie})).status,401);
});
test('renewal rotates code atomically, revokes sessions and does not log full code',async()=>{
 const c=await createClient(),session=await clientLogin(c.input.code),code=String(++seq);const r=await call('/admin/clients/'+c.id+'/extend',{method:'POST',data:{days:30,code,revision:c.revision}});assert.equal(r.status,200);assert.ok(new Date(r.json.expiresAt)>new Date(c.expiresAt));assert.equal((await call('/me',{cookie:session.cookie})).status,401);assert.equal((await clientLogin(c.input.code)).status,401);assert.equal((await clientLogin(code)).status,200);const log=await call('/admin/audit?clientId='+c.id);assert.ok(log.json.items.some(x=>x.action==='code_renewed'));assert.ok(!JSON.stringify(log.json).includes(code));
});
test('duplicate, unchanged or stale renewal codes do not extend the subscription',async()=>{
 const c=await createClient(),other=await createClient();for(const [code,revision,status] of [[other.input.code,c.revision,409],[c.input.code,c.revision,422],[String(++seq),999,409]]){assert.equal((await call('/admin/clients/'+c.id+'/extend',{method:'POST',data:{days:30,code,revision}})).status,status);const current=await call('/admin/clients/'+c.id);assert.equal(current.json.expiresAt,c.expiresAt);assert.equal(current.json.revision,c.revision);}
});
test('tier and amount validation rejects invalid combinations',async()=>{for(const overrides of [{accessTier:'unknown'},{accessTier:'free',priceHalalas:1},{priceHalalas:-1},{priceHalalas:1.2}])assert.equal((await call('/admin/scripts',{method:'POST',data:scriptData(overrides)})).status,422);});
test('subscription summary counts only published accessible files and rejects expired sessions',async()=>{
 const free=await script({accessTier:'free'}),paid=await script(),hidden=await script({published:false});
 const c=await createClient({allowedScriptIds:[paid.id,hidden.id]}),session=await clientLogin(c.input.code);
 const result=await call('/me/subscription',{cookie:session.cookie});
 assert.equal(result.status,200);assert.equal(result.json.status,'active');assert.ok(result.json.remainingDays>=29);assert.ok(result.json.availableScripts>=2);
 const before=result.json.availableScripts;
 await call('/admin/clients/'+c.id,{method:'PUT',data:{...c.input,code:'',allowedScriptIds:[],revision:c.revision}});
 assert.equal((await call('/me/subscription',{cookie:session.cookie})).json.availableScripts,before-1);
 assert.equal((await call('/me/subscription',{cookie:null})).status,401);
 const owner=await call('/me/subscription');assert.equal(owner.json.status,'owner');assert.equal(owner.json.expiresAt,null);
 await pg.query("UPDATE zen_clients SET expires_at=now()-interval '1 second' WHERE id=$1",[c.id]);
 assert.equal((await call('/me/subscription',{cookie:session.cookie})).status,401);
});
test('lifetime subscriptions remain active, include future paid files and are still revocable',async()=>{
 const c=await createClient({expiresAt:null,allScripts:true});assert.equal(c.expiresAt,null);assert.equal(c.status,'active');
 const session=await clientLogin(c.input.code);assert.equal(session.status,200);
 const details=await call('/me/subscription',{cookie:session.cookie});assert.equal(details.json.lifetime,true);assert.equal(details.json.remainingDays,null);
 const future=await script({accessTier:'paid'});
 assert.equal((await call('/scripts/'+future.id+'/download',{cookie:session.cookie})).status,200);
 const active=await call('/admin/clients?status=active&q='+encodeURIComponent(c.name));assert.ok(active.json.items.some(x=>x.id===c.id));
 const expired=await call('/admin/clients?status=expired');assert.ok(!expired.json.items.some(x=>x.id===c.id));
 const extended=await call('/admin/clients/'+c.id+'/extend',{method:'POST',data:{days:30,revision:c.revision}});assert.equal(extended.status,200);assert.equal(extended.json.expiresAt,null);
 const stop=await call('/admin/clients/'+c.id,{method:'PUT',data:{...c.input,code:'',active:false,revision:extended.json.revision}});assert.equal(stop.status,200);
 assert.equal((await call('/scripts/'+future.id+'/download',{cookie:session.cookie})).status,401);
 assert.equal((await clientLogin(c.input.code)).status,401);
});
