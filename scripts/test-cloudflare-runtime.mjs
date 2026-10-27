import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {passwordHash,sha256} from '../server/security.mjs';
const temp=await mkdtemp(join(tmpdir(),'meshari-cf-test-')),config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
const password='local-fixture-password-only-123';config.main=resolve(config.main);config.assets.directory=resolve(config.assets.directory);config.name='meshari-runtime-fixture';config.vars={ADMIN_USER:'fixture',ADMIN_PASSWORD_HASH:await passwordHash(password),AUTH_PEPPER:'local-fixture-pepper-only-1234567890123456789',ZEN_LOCAL_DEV:'1'};delete config.triggers;
const path=join(temp,'wrangler.json');await writeFile(path,JSON.stringify(config),{mode:0o600});
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8791','--inspector-port','0','--config',path,'--persist-to',join(temp,'state')],{env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
let log='';const ready=new Promise((res,rej)=>{const timer=setTimeout(()=>rej(new Error('Runtime startup timed out')),45000);for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{log+=data.toString();if(log.includes('Ready on')){clearTimeout(timer);res();}});child.on('exit',code=>{clearTimeout(timer);rej(new Error('Runtime exited '+code));});});
const base='http://127.0.0.1:8791';
async function call(path,{method='GET',body,cookie,origin=base}={}){const response=await fetch(base+'/api'+path,{method,headers:{Origin:origin,'X-Zen-Request':'1',...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {response,status:response.status,json:response.headers.get('Content-Type')?.includes('json')?await response.clone().json():null,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
try{await ready;
 assert.equal((await fetch(base+'/__bootstrap/free-seed.json')).status,404);
 assert.equal((await call('/health')).status,200);assert.equal((await call('/catalog')).json.length,15);
 const admin=await call('/auth/admin',{method:'POST',body:{username:'fixture',password}});assert.equal(admin.status,200,JSON.stringify(admin.json));
 const client=await call('/admin/clients',{method:'POST',cookie:admin.cookie,body:{name:'Lifetime fixture',code:'123456789',active:true,allScripts:true,expiresAt:null,maxSessions:1,notes:'',allowedScriptIds:[]}});assert.equal(client.status,201,JSON.stringify(client.json));
 const source='// fixture only\nmain {}';const script=await call('/admin/scripts',{method:'POST',cookie:admin.cookie,body:{title:'Private fixture',category:'Test',version:'1',description:'test',requirements:'test',installation:'test',usage:'test',changelog:'test',published:true,fileName:'fixture.gpc',fileBase64:Buffer.from(source).toString('base64'),accessTier:'paid',priceHalalas:0}});assert.equal(script.status,201,JSON.stringify(script.json));
 const signed=await call('/auth/client',{method:'POST',body:{code:'123456789'}});assert.equal(signed.status,200);assert.equal((await call('/me/subscription',{cookie:signed.cookie})).json.lifetime,true);
 const file=await call('/scripts/'+script.json.id+'/download',{cookie:signed.cookie});assert.equal(file.status,200);assert.equal(sha256(Buffer.from(await file.response.arrayBuffer())),sha256(source));assert.equal((await call('/free-scripts/'+script.json.id+'/download')).status,404);
 assert.equal((await call('/admin/clients',{method:'POST',cookie:admin.cookie,origin:'https://attacker.invalid',body:{}})).status,403);
 console.log('Cloudflare runtime passed: private bootstrap, owner login, lifetime access, private paid bytes, anonymous denial, CSRF');
}catch(error){console.error('Cloudflare runtime failed:',error.message);console.error(log.slice(-3500));process.exitCode=1;}finally{child.kill('SIGTERM');}
