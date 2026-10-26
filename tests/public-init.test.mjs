import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createApp} from '../server/app.mjs';
import {ZenDevice} from '../public/device.js';
test('published free catalog works before admin setup; private routes and files stay blocked',async()=>{
 const db=new PGlite();try{
 for(const f of (await readdir('netlify/database/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('netlify/database/migrations/'+f,'utf8'));
 const app=createApp({db,env:{},logger:{error(){}}});const get=p=>app(new Request('https://example.com/api'+p),{ip:'test'});
 const response=await get('/catalog');assert.equal(response.status,200);const list=await response.json();assert.equal(list.length,15);
 const id=list[0].id;assert.equal((await get('/free-scripts/'+id+'/download')).status,200);
 await db.query("UPDATE zen_scripts SET access_tier='paid' WHERE id=$1",[id]);assert.equal((await get('/free-scripts/'+id+'/download')).status,404);
 await db.query("UPDATE zen_scripts SET access_tier='free',published=false WHERE id=$1",[id]);assert.equal((await get('/free-scripts/'+id)).status,404);
 for(const p of ['/me','/scripts','/admin/dashboard','/health'])assert.equal((await get(p)).status,503);
 assert.equal((await db.query('SELECT * FROM zen_admin')).rows.length,0);
 }finally{await db.close();}
});
test('restore recognizes only previously permitted Zen devices without opening permission prompt',async()=>{
 let prompts=0;const zen={productName:'Cronus ZEN'};const hid={addEventListener(){},getDevices:async()=>[{productName:'Keyboard'},zen],requestDevice:async()=>{prompts++;return[];}};
 const device=new ZenDevice(hid);assert.equal((await device.restore()).name,'Cronus ZEN');assert.equal(prompts,0);
 hid.getDevices=async()=>[];assert.equal(await device.restore(),null);assert.equal(device.device,null);
});
