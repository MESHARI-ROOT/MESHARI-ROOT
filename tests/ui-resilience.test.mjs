import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {api,viewGuard,invalidateView} from '../public/ui.js';
import {mountInstallScripts} from '../public/install-scripts.js';
import {mascot} from '../public/motion.js';

test('retry preserves paid subscriber endpoint after a temporary failure',async()=>{
 const dom=new JSDOM('<main id="picker"></main>');const old={document:globalThis.document,fetch:globalThis.fetch};globalThis.document=dom.window.document;
 const calls=[];globalThis.fetch=async url=>{calls.push(url);return calls.length===1?new Response(JSON.stringify({error:'temporary'}),{status:503,headers:{'Content-Type':'application/json'}}):new Response(JSON.stringify([{id:'paid',title:'Paid',version:'1',accessTier:'paid'}]),{headers:{'Content-Type':'application/json'}});};
 try{await mountInstallScripts(document.querySelector('main'),true);document.querySelector('#retry-install-files').click();await new Promise(r=>setImmediate(r));assert.deepEqual(calls,['/api/scripts','/api/scripts']);assert.match(document.querySelector('main').textContent,/Paid/);}
 finally{Object.assign(globalThis,old);dom.window.close();}
});
test('old page responses are rejected after navigation or a newer refresh',()=>{
 const first=viewGuard();assert.equal(first(),true);const second=viewGuard();assert.equal(first(),false);assert.equal(second(),true);invalidateView();assert.equal(second(),false);
});
test('stalled API request times out with an actionable error',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));
 try{await assert.rejects(api('/health',{timeoutMs:5}),error=>error.status===503&&error.message.includes('وقتًا طويلًا'));}finally{globalThis.fetch=old;}
});
test('logo contains a single source image instead of overlapping cut-out hands',()=>{
 const dom=new JSDOM(mascot('fixture'));try{assert.equal(dom.window.document.querySelectorAll('image').length,1);assert.equal(dom.window.document.querySelectorAll('clipPath,.hand-layer').length,0);assert.equal(dom.window.document.querySelectorAll('feDisplacementMap').length,1);}finally{dom.window.close();}
});
test('download timeout also covers a stalled file body',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async(_url,{signal})=>new Response(new ReadableStream({start(controller){signal.addEventListener('abort',()=>controller.error(new DOMException('aborted','AbortError')),{once:true});}}));
 try{await assert.rejects(api('/scripts/fixture/download',{raw:true,timeoutMs:5}),error=>error.status===503&&error.message.includes('وقتًا طويلًا'));}finally{globalThis.fetch=old;}
});
