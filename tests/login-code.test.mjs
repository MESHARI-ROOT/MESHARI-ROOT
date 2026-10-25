import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {codeFields,bindCodeInput} from '../public/login-code.js';
function setup(){const dom=new JSDOM('<form>'+codeFields()+'</form>');const form=dom.window.document.querySelector('form');bindCodeInput(form,{readText:async()=> '٠١٢٣٤٥٦٧٨'});return {dom,form,inputs:[...form.querySelectorAll('[data-digit]')]};}
test('pasted Arabic digits preserve leading zero and submit one nine-digit value',async()=>{const {form,inputs}=setup();await form.querySelector('#paste-code').onclick();assert.equal(form.elements.code.value,'012345678');assert.equal(inputs[8].value,'8');assert.equal(form.checkValidity(),true);});
test('typing, backspace and invalid pasted text cannot leave a stale code',async()=>{const {dom,form,inputs}=setup();await form.querySelector('#paste-code').onclick();inputs[8].value='';inputs[8].dispatchEvent(new dom.window.Event('input'));inputs[8].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Backspace',cancelable:true}));assert.equal(inputs[7].value,'');assert.equal(form.elements.code.value,'0123456');assert.equal(form.checkValidity(),false);inputs[0].value='x';inputs[0].dispatchEvent(new dom.window.Event('input'));assert.equal(inputs[0].value,'');});
