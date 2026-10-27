export const $=(selector,root=document)=>root.querySelector(selector);
export const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const date=(value,short=false)=>value?new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{dateStyle:'medium',...(!short?{timeStyle:'short'}:{}),timeZone:'Asia/Riyadh'}).format(new Date(value)):'لم يسجّل دخولًا';
export const subscriptionExpiry=value=>value===null?'مدى الحياة':date(value);
export const daysLeft=value=>Math.max(0,Math.ceil((new Date(value)-Date.now())/86400000));
export const size=value=>value<1024?`${value} B`:value<1048576?`${(value/1024).toFixed(1)} KB`:`${(value/1048576).toFixed(2)} MB`;
export function riyadhInput(value){const parts=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Riyadh'}).formatToParts(new Date(value));const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
export const expiryFromInput=value=>new Date(value+':00+03:00').toISOString();
const icons={
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
 script:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6m-10 4-2 3 2 3m4-6 2 3-2 3"/>',
 puzzle:'<path d="M8 3h3a2.5 2.5 0 1 1 5 0h4v5a2.5 2.5 0 1 1 0 5v7h-6a2.5 2.5 0 1 0-5 0H3v-6a2.5 2.5 0 1 0 0-5V3Z"/>',
 bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7Z"/>',
 book:'<path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v15"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 activity:'<path d="M2 12h4l3-8 6 16 3-8h4"/>',
 shield:'<path d="m12 3 8 3v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 3 2 3-1 3 3 2 2-1 3 3 3-2 1-3 3-1 2-3-2-3 1-3-3-2-3 1-2-2Z"/>',
 device:'<rect x="6" y="2" width="12" height="20" rx="3"/><rect x="9" y="5" width="6" height="5" rx="1"/><path d="M10 15h4m-2-2v4m-2 3h4"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
 check:'<path d="m5 12 4 4L20 5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 arrow:'<path d="M20 12H4m6-6-6 6 6 6"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>',
 logout:'<path d="M9 3H4v18h5m4-14 5 5-5 5m-5-5h13"/>',
 lock:'<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v3"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
 external:'<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
 search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>'
};
export const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]??icons.script}</svg>`;
export const empty=(title,message,action='')=>`<div class="empty">${icon('script')}<h3>${escape(title)}</h3><p>${escape(message)}</p>${action}</div>`;
export const spinner=()=>'<div class="loading"><span class="spinner"></span>جاري التحميل…</div>';
export function toast(message,error=false){const div=document.createElement('div');div.className='toast'+(error?' error':'');div.textContent=message;$('#toasts').append(div);setTimeout(()=>div.remove(),6500);}
// Prevent a slow response from replacing a newer screen (including same-page refreshes).
let viewRevision=0;
export function invalidateView(){viewRevision++;}
export function viewGuard(){const revision=++viewRevision,hash=globalThis.location?.hash;return()=>revision===viewRevision&&hash===globalThis.location?.hash;}
export async function api(path,{method='GET',data,raw=false,timeoutMs=raw?60000:20000}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch('/api'+path,{method,signal:controller.signal,credentials:'same-origin',cache:'no-store',headers:{'X-Zen-Request':'1',...(data!==undefined?{'Content-Type':'application/json'}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{})});
    if(!response.ok){let payload;try{payload=await response.json();}catch(error){if(controller.signal.aborted)throw error;payload={error:'الخدمة غير متاحة مؤقتًا. أعد المحاولة بعد قليل.'};}const error=new Error(payload.error||'تعذّر تنفيذ الطلب.');error.status=response.status;throw error;}
    if(raw){const bytes=await response.arrayBuffer();return new Response(bytes,{status:response.status,statusText:response.statusText,headers:response.headers});}
    if(!response.headers.get('content-type')?.includes('application/json')){const error=new Error('الخدمة غير متاحة مؤقتًا. أعد المحاولة بعد قليل.');error.status=503;throw error;}
    return await response.json();
  }catch(error){
    if(error.status)throw error;
    const message=controller.signal.aborted?'استغرق الاتصال وقتًا طويلًا. أعد المحاولة.':'تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم أعد المحاولة.';
    const failure=new Error(message);failure.status=503;throw failure;
  }finally{clearTimeout(timer);}
}
export function setError(form,message){let error=$('.form-error',form);if(!error){error=document.createElement('div');error.className='form-error';error.setAttribute('role','alert');form.prepend(error);}error.textContent=message;error.hidden=!message;}
export async function submit(form,fn){const button=$('[type=submit]',form);if(button?.disabled)return;const old=button?.textContent;if(button){button.disabled=true;button.textContent='جاري الحفظ…';}setError(form,'');try{await fn();}catch(e){setError(form,e.message);}finally{if(button){button.disabled=false;button.textContent=old;}}}
export function modal(title,subtitle,html){const d=$('#modal');$('#modal-content').innerHTML=`<div class="modal-head"><div><h2>${escape(title)}</h2><p>${escape(subtitle)}</p></div><button class="close-modal" aria-label="إغلاق" type="button">×</button></div><div class="modal-body">${html}</div>`;$('.close-modal',d).onclick=()=>d.close();if(!d.open)d.showModal();return d;}
export function confirmAction(title,message,buttonText='تأكيد'){return new Promise(resolve=>{const d=modal(title,message,`<div class="row"><button class="button danger" id="confirm-yes">${escape(buttonText)}</button><button class="button ghost" id="confirm-no">تراجع</button></div>`);let done=false;const finish=value=>{if(done)return;done=true;d.close();resolve(value);};$('#confirm-yes').onclick=()=>finish(true);$('#confirm-no').onclick=()=>finish(false);d.addEventListener('close',()=>finish(false),{once:true});});}
export function csvDownload(name,headers,rows){const cell=value=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};const text='\ufeff'+[headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n');downloadBlob(name,new Blob([text],{type:'text/csv;charset=utf-8'}));}
export function downloadBlob(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
export async function downloadScript(script,free=false){const response=await api((free?'/free-scripts/':'/scripts/')+script.id+'/download',{raw:true});const data=await response.arrayBuffer();const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');const expected=response.headers.get('X-Content-SHA256');if(!expected||actual!==expected||expected!==script.sha256)throw new Error('تغير إصدار الملف أو لم تتطابق البصمة. حدّث المكتبة ثم أعد التنزيل.');downloadBlob(script.fileName,new Blob([data],{type:'application/octet-stream'}));toast('تم التحقق من الملف وبدء تنزيله.');}
export const actions={code_renewed:'إصدار رمز تجديد',login_success:'دخول العميل',login_failed:'محاولة دخول غير ناجحة',admin_login_success:'دخول الإدارة',admin_login_failed:'محاولة دخول للإدارة',download:'تنزيل سكربت',client_created:'إضافة عميل',client_updated:'تعديل اشتراك',client_deleted:'حذف عميل',subscription_extended:'تمديد اشتراك',sessions_revoked:'إلغاء جلسات العميل',session_revoked:'إلغاء جلسة',script_created:'إضافة سكربت',script_updated:'تحديث سكربت',script_deleted:'حذف سكربت',password_changed:'تغيير كلمة المرور',device_connected:'اتصال جهاز — بلاغ المتصفح',device_disconnected:'فصل جهاز — بلاغ المتصفح',installation_confirmed:'تأكيد العميل إتمام التركيب',firmware_confirmed:'تأكيد العميل إتمام تحديث القطعة'};
export const statusBadge=s=>s==='active'?'<span class="badge"><span class="dot"></span>نشط</span>':s==='expired'?'<span class="badge red">منتهي</span>':'<span class="badge gray">موقوف</span>';
