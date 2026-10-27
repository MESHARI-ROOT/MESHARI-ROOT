import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from '../server/migrate.mjs';
import {transferDatabase} from '../scripts/transfer-database.mjs';
import {httpServer} from '../server/http.mjs';
const adapt=db=>({query:(sql,args=[])=>sql.startsWith('SELECT pg_advisory')||sql.startsWith('SET TRANSACTION')?Promise.resolve({rows:[]}):(!args.length&&sql.includes(';')?db.exec(sql).then(results=>results.at(-1)||{rows:[]}):db.query(sql,args)),async transaction(fn){return db.transaction(tx=>fn(adapt(tx)));}});
test('standalone migration is repeatable and transfer preserves lifetime customers and private file bytes',async()=>{
 const source=new PGlite(),target=new PGlite();try{
  const src=adapt(source),dst=adapt(target);await migrate(src);await migrate(src);
  await source.query("INSERT INTO zen_clients(id,name,code_hash,code_hint,expires_at,active,all_scripts) VALUES('11111111-1111-4111-8111-111111111111','Lifetime fixture','fixture-hash','123',NULL,true,true)");
  const original=(await source.query('SELECT id,sha256,file_data FROM zen_scripts ORDER BY id LIMIT 1')).rows[0];
  await source.query("UPDATE zen_scripts SET access_tier='paid' WHERE id=$1",[original.id]);
  const counts=await transferDatabase(src,dst);assert.equal(counts.zen_clients,1);assert.equal(counts.zen_scripts,15);
  assert.equal((await target.query('SELECT expires_at FROM zen_clients')).rows[0].expires_at,null);
  const copied=(await target.query('SELECT access_tier,sha256,file_data FROM zen_scripts WHERE id=$1',[original.id])).rows[0];assert.equal(copied.access_tier,'paid');assert.equal(copied.sha256,original.sha256);assert.deepEqual(Buffer.from(copied.file_data),Buffer.from(original.file_data));
  await migrate(dst);await assert.rejects(transferDatabase(src,dst),/TARGET_NOT_EMPTY/);
 }finally{await source.close();await target.close();}
});
test('corrupt source file rolls back the entire destination import',async()=>{
 const source=new PGlite(),target=new PGlite();try{await migrate(adapt(source));await source.query("UPDATE zen_scripts SET sha256='invalid'");await assert.rejects(transferDatabase(adapt(source),adapt(target)),/SOURCE_FILE_INTEGRITY_FAILED/);assert.equal((await target.query("SELECT to_regclass('public.zen_clients') AS name")).rows[0].name,null);}finally{await source.close();await target.close();}
});
test('standalone HTTP serves UI safely and does not trust a forged Host or client IP',async()=>{
 let received;const server=httpServer({origin:'https://zen.example',app:async(request,context)=>{received={url:request.url,ip:context.ip,body:await request.text(),origin:request.headers.get('origin')};return Response.json({ok:true});}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(await page.text(),/MESHARI-ALOTAIBI/);
  assert.equal((await fetch(base+'/.env')).status,404);assert.equal((await fetch(base+'/server/app.mjs')).status,404);
  const result=await fetch(base+'/api/test',{method:'POST',headers:{Host:'attacker.example','X-Real-IP':'8.8.8.8',Origin:'https://attacker.example','Content-Type':'application/json'},body:'{}'});assert.equal(result.status,200);assert.equal(received.url,'https://zen.example/api/test');assert.equal(received.origin,'https://attacker.example');assert.notEqual(received.ip,'8.8.8.8');assert.equal(received.body,'{}');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
