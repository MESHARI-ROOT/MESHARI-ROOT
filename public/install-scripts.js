import {api,escape as e,downloadScript} from './ui.js';
export async function mountInstallScripts(root,authenticated=false){
 root.innerHTML='<h2>اختر سكربتك — ملفات كود 7</h2><p role="status">جاري عرض السكربتات…</p>';
 try{
  const rows=(await api(authenticated?'/scripts':'/catalog')).filter(s=>authenticated||s.accessTier==='free').sort((a,b)=>a.title.localeCompare(b.title,undefined,{numeric:true}));
  if(!root.isConnected)return;
  root.innerHTML=`<div class="panel-heading"><h2>اختر سكربتك — ملفات كود 7</h2><span class="badge gold">${rows.length} سكربت</span></div><p>${authenticated?'ملفات اشتراكك متاحة هنا، بما فيها الملفات المدفوعة المصرّح بها.':'الملفات المجانية ظاهرة أمامك.'} اضغط اسم السكربت لعرض متطلباته وتنزيله.</p><div class="install-picks">${rows.map(s=>`<button class="button ghost" data-script-id="${e(s.id)}" aria-pressed="false">${e(s.title)} <small>${e(s.version)}</small></button>`).join('')}</div><div id="selected-install-file" role="status">${rows.length?'اختر أحد السكربتات أعلاه.':'لا توجد ملفات مجانية منشورة بعد.'}</div>`;
  let chosen=null;
  for(const button of root.querySelectorAll('[data-script-id]'))button.onclick=async()=>{
   chosen=button.dataset.scriptId;const id=chosen,target=root.querySelector('#selected-install-file');
   root.querySelectorAll('[data-script-id]').forEach(b=>{b.classList.toggle('primary',b===button);b.setAttribute('aria-pressed',String(b===button));});target.textContent='جاري تحميل تفاصيل السكربت…';
   try{const s=await api((authenticated?'/scripts/':'/free-scripts/')+encodeURIComponent(id));if(!root.isConnected||chosen!==id)return;
    target.innerHTML=`<hr><h3>${e(s.title)}</h3><p>${e(s.description)}</p><p><strong>المتطلبات:</strong> ${e(s.requirements)}</p><p>${e(s.installation)}</p><div class="row"><button class="button primary" id="download-selected">تنزيل ${e(s.fileName)}</button><a class="button ghost" href="https://zenstudio.collectivemindsstore.com/" target="_blank" rel="noopener noreferrer">فتح Zen Studio Live</a></div><p class="hint">بعد التنزيل افتح الملف في Zen Studio، افحصه بالمترجم، ثم برمج خانة الذاكرة. التنزيل لا يركّبه تلقائيًا على القطعة.</p><p id="selected-download-status" role="status"></p>`;
    target.querySelector('#download-selected').onclick=async ev=>{const b=ev.currentTarget,msg=target.querySelector('#selected-download-status');b.disabled=true;try{await downloadScript(s,!authenticated);msg.textContent='تم تنزيل الملف والتحقق من بصمته. أكمل برمجته في Zen Studio.';}catch(error){msg.textContent=error.message;}finally{b.disabled=false;}};
   }catch(error){if(chosen===id&&target.isConnected)target.textContent=error.message;}
  };
 }catch(error){if(root.isConnected){root.innerHTML=`<h2>تعذّر عرض السكربتات</h2><p>${e(error.message)}</p><button class="button ghost" id="retry-install-files">إعادة المحاولة</button>`;root.querySelector('button').onclick=()=>mountInstallScripts(root,authenticated);}}
}
