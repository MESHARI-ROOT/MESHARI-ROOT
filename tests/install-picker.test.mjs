import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountInstallScripts} from '../public/install-scripts.js';
for(const authenticated of [false,true])test(`install picker uses ${authenticated?'subscription-protected':'public free'} endpoints`,async()=>{
 const dom=new JSDOM('<main><section id="picker"></section></main>');
 const previous={document:globalThis.document,fetch:globalThis.fetch};globalThis.document=dom.window.document;
 const calls=[],file={id:'fixture',title:'ملف اختبار',version:'1',accessTier:authenticated?'paid':'free',fileName:'example.gpc'};
 globalThis.fetch=async url=>{calls.push(url);return new Response(JSON.stringify(url.endsWith('/fixture')?file:[file]),{headers:{'Content-Type':'application/json'}});};
 try{
  const root=document.querySelector('#picker');await mountInstallScripts(root,authenticated);
  assert.equal(calls[0],authenticated?'/api/scripts':'/api/catalog');
  root.querySelector('[data-script-id]').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls[1],authenticated?'/api/scripts/fixture':'/api/free-scripts/fixture');
  assert.ok(root.querySelector('#download-selected'));assert.ok(root.textContent.includes(file.title));
 }finally{globalThis.document=previous.document;globalThis.fetch=previous.fetch;dom.window.close();}
});
