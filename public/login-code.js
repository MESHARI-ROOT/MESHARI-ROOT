export const normalizeDigits=value=>String(value).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/\s/g,'');
export function codeFields(){return `<fieldset class="code-fieldset"><legend>رمز الدخول من 9 أرقام</legend><div class="code-boxes" dir="ltr">${Array.from({length:9},(_,i)=>`<input type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" required autocomplete="off" aria-label="الرقم ${i+1} من 9" data-digit="${i}">`).join('')}</div><input type="hidden" name="code"><button type="button" class="button ghost paste-code" id="paste-code">لصق الرمز</button><p class="code-message" id="code-message" role="status"></p></fieldset>`;}
export function bindCodeInput(form,clipboard){
  const inputs=[...form.querySelectorAll('[data-digit]')],hidden=form.elements.namedItem('code'),message=form.querySelector('#code-message');
  const sync=()=>{hidden.value=inputs.map(x=>x.value).join('');message.textContent='';};
  const distribute=(raw,start=0)=>{const value=normalizeDigits(raw);if(!/^\d+$/.test(value)||value.length>inputs.length-start){message.textContent='أدخل رمزًا من 9 أرقام فقط.';return false;}for(let i=start;i<inputs.length;i++)inputs[i].value=value[i-start]||'';sync();inputs[Math.min(start+value.length,8)].focus();return true;};
  inputs.forEach((input,i)=>{
    input.addEventListener('input',()=>{const value=normalizeDigits(input.value);input.value=/^\d$/.test(value)?value:'';sync();if(input.value&&i<8)inputs[i+1].focus();});
    input.addEventListener('keydown',event=>{if(event.key==='Backspace'&&!input.value&&i>0){event.preventDefault();inputs[i-1].value='';inputs[i-1].focus();sync();}else if(event.key==='ArrowLeft'&&i>0){event.preventDefault();inputs[i-1].focus();}else if(event.key==='ArrowRight'&&i<8){event.preventDefault();inputs[i+1].focus();}});
    input.addEventListener('paste',event=>{event.preventDefault();const text=event.clipboardData?.getData('text')||'';distribute(text,normalizeDigits(text).length===9?0:i);});
  });
  form.querySelector('#paste-code').onclick=async()=>{try{if(!clipboard?.readText)throw new Error();distribute(await clipboard.readText());}catch{message.textContent='اضغط داخل أول خانة ثم الصق الرمز من لوحة المفاتيح.';inputs[0].focus();}};
}
