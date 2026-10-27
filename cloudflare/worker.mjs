import {DurableObject} from 'cloudflare:workers';
import {createApp} from '../server/app.mjs';
import {sqliteDatabase} from './sqlite.mjs';
import {schema} from './schema.mjs';
import {seedDatabase,importDatabase} from './data.mjs';
const headers={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=(), hid=(self)','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"};
export class ZenStore extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;this.db=sqliteDatabase(ctx.storage);this.app=createApp({db:this.db,env:{...env,ZEN_MAX_FILE_BYTES:'1800000',ZEN_SEARCH_MAX_CHARS:'12'}});
  this.ready=ctx.blockConcurrencyWhile(async()=>{ctx.storage.sql.exec(schema);if(!await ctx.storage.get('seed-version')){const r=await env.ASSETS.fetch('https://internal/__bootstrap/free-seed.json');if(!r.ok)throw new Error('SEED_NOT_FOUND');await seedDatabase(ctx.storage,await r.json());}});
 }
 async fetch(request){await this.ready;return this.ctx.blockConcurrencyWhile(async()=>{
  const path=new URL(request.url).pathname;
  if(path==='/api/admin/migration/import'){
   if(this.env.ZEN_MIGRATION_MODE!=='1'||request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('X-Zen-Request')!=='1')return Response.json({error:'النقل غير مفعّل.'},{status:403});
   const session=await this.app(new Request(new URL('/api/me',request.url),{headers:request.headers}),{ip:request.headers.get('x-zen-client-ip')});
   if(!session.ok||(await session.json()).role!=='admin')return Response.json({error:'دخول المالك مطلوب.'},{status:403});
   if(Number(request.headers.get('content-length'))>32*1024*1024)return new Response(null,{status:413});
   try{const reader=request.body.getReader(),chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32*1024*1024){await reader.cancel();return new Response(null,{status:413});}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}const bundle=JSON.parse(new TextDecoder().decode(bytes));const counts=await importDatabase(this.ctx.storage,bundle,this.env.AUTH_PEPPER);return Response.json({ok:true,counts,signInAgain:true},{headers:{'Cache-Control':'no-store'}});}catch(error){console.error('MIGRATION_REJECTED');return Response.json({error:'تعذّر استيراد النسخة. تحقق من خلو الوجهة وتطابق المفتاح وسلامة الملفات.'},{status:422});}
  }
  if(this.env.ZEN_MIGRATION_MODE==='1'&&!['/api/auth/admin','/api/me','/api/health','/api/auth/logout'].includes(path))return Response.json({error:'النظام تحت الصيانة لنقل البيانات.'},{status:503,headers:{'Cache-Control':'no-store'}});
  return this.app(request,{ip:request.headers.get('x-zen-client-ip')||'unknown'});
 });}
 async cleanup(){return this.alarm();}
 async alarm(){await this.ready;await this.ctx.blockConcurrencyWhile(async()=>{for(const sql of ["DELETE FROM zen_sessions WHERE expires_at<strftime('%Y-%m-%dT%H:%M:%fZ','now')","DELETE FROM zen_limits WHERE resets_at<strftime('%Y-%m-%dT%H:%M:%fZ','now')","DELETE FROM zen_audit WHERE created_at<strftime('%Y-%m-%dT%H:%M:%fZ','now','-90 days')"])this.ctx.storage.sql.exec(sql);});}
}
export default{
 async fetch(request,env){let response;const url=new URL(request.url);
  if(url.pathname.startsWith('/__bootstrap/'))response=new Response('Not found',{status:404});
  else if(url.pathname.startsWith('/api/')){const forwarded=new Request(request);forwarded.headers.set('x-zen-client-ip',request.headers.get('CF-Connecting-IP')||'unknown');response=await env.ZEN_STORE.getByName('meshari-main-v1').fetch(forwarded);}
  else response=await env.ASSETS.fetch(request);
  response=new Response(response.body,response);for(const [name,value] of Object.entries(headers))response.headers.set(name,value);return response;
 },
 async scheduled(_event,env,ctx){ctx.waitUntil(env.ZEN_STORE.getByName('meshari-main-v1').cleanup());}
};
