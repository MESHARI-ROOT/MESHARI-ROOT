import {$,$$,escape as e,icon,date,daysLeft,size,riyadhInput,expiryFromInput,api,toast,modal,confirmAction,submit,empty,csvDownload,actions,statusBadge} from './ui.js';
const main=()=>$('#main');
const listState={page:1,q:'',status:'all'},logState={page:1,action:'',clientId:''};
let scripts=[];
const title=(eyebrow,heading,description,buttons='')=>`<div class="page-title"><div><span class="eyebrow">${eyebrow}</span><h1>${heading}</h1><p>${description}</p></div><div class="row">${buttons}</div></div>`;
const refreshButton='<button class="button ghost small" id="refresh-page">'+icon('refresh')+'تحديث</button>';
function pagination(data){return `<div class="pagination"><span>${data.total} نتيجة · صفحة ${data.page} من ${data.pages}</span><div class="row gap-sm"><button class="button small ghost" id="prev-page" ${data.page<=1?'disabled':''}>السابق</button><button class="button small ghost" id="next-page" ${data.page>=data.pages?'disabled':''}>التالي</button></div></div>`;}
const field=(label,name,value='',type='text',extra='')=>`<label class="field">${label}<input name="${name}" type="${type}" value="${e(value)}" ${extra}></label>`;
const textArea=(label,name,value='',max=8000)=>`<label class="field">${label}<textarea name="${name}" maxlength="${max}" rows="4">${e(value)}</textarea></label>`;
const safely=fn=>async()=>{try{await fn();}catch(error){toast(error.message,true);}};
const button=(label,id,primary=false,ic='plus')=>`<button class="button ${primary?'primary':'ghost'}" id="${id}">${icon(ic)}${label}</button>`;

export async function renderAdmin(view,query='',logout=()=>{}){
  if(view==='admin')return dashboard();
  if(view==='clients')return clients();
  if(view==='manage-scripts')return scriptList();
  if(view==='activity'){logState.clientId=new URLSearchParams(query).get('clientId')||'';return activity();}
  if(view==='sessions')return sessions();
  if(view==='settings')return settings(logout);
}
async function dashboard(){
  const [stats,log]=await Promise.all([api('/admin/dashboard'),api('/admin/audit')]);
  main().innerHTML=title('YOUR CONTROL ROOM','حيّاك مشاري 👋','اشتراكات عملائك ونشاطهم، من مكان واحد.',button('إضافة عميل','add-client',true)+refreshButton)+
  `<div class="metrics">${[['إجمالي العملاء',stats.total,'users',`${stats.disabled} حساب موقوف`],['اشتراكات نشطة',stats.active,'shield',`${stats.expired} اشتراك منتهٍ`],['تنتهي خلال 7 أيام',stats.expiring,'clock','تابع التجديد قبل انتهاء المدة'],['نشاط حديث',stats.online,'activity','عملاء نشطوا خلال آخر 3 دقائق']].map(([label,value,ic,note],i)=>`<article class="metric ${i===1?'accent':''}"><div class="metric-label">${label}${icon(ic)}</div><strong>${value}</strong><small>${note}</small></article>`).join('')}</div>
  <div class="notice neutral row between"><span>اليوم بتوقيت السعودية: <b>${stats.todayLogins}</b> عملية دخول · <b>${stats.todayDownloads}</b> تنزيل</span><span class="small">آخر تحديث: ${date(new Date())}</span></div>
  <div class="dashboard-grid"><section class="panel"><div class="panel-heading"><h2>آخر النشاطات</h2><a class="small" href="#activity">عرض السجل ←</a></div><div class="activity-list">${log.items.length?log.items.slice(0,6).map(x=>`<div class="activity-item"><span class="activity-icon">${icon(x.action.includes('login')?'users':x.action==='download'?'download':'activity')}</span><div><strong>${e(x.actor)}</strong><p>${e(actions[x.action]??x.action)}</p></div><time>${date(x.createdAt)}</time></div>`).join(''):empty('السجل يبدأ من هنا','ستظهر عمليات دخول العملاء وتنزيلاتهم تلقائيًا.')}</div></section>
  <section class="panel"><div class="panel-heading"><h2>قريبًا ينتهي اشتراكهم</h2>${icon('clock')}</div>${stats.expiringClients.length?stats.expiringClients.map(c=>`<div class="expiring-item"><span class="avatar">${e(c.name.slice(0,1))}</span><div><strong>${e(c.name)}</strong><small>متبقي ${daysLeft(c.expiresAt)} يوم · ${date(c.expiresAt,true)}</small></div><button class="button small ghost" data-edit="${c.id}">إدارة</button></div>`).join(''):empty('كل شيء تحت السيطرة','لا توجد اشتراكات تنتهي خلال الأيام السبعة القادمة.')}<hr><a class="button ghost full" href="#clients">إدارة جميع العملاء ${icon('arrow')}</a></section></div>`;
  $('#add-client').onclick=safely(()=>editClient(null,dashboard));$('#refresh-page').onclick=safely(dashboard);$$('[data-edit]').forEach(el=>el.onclick=safely(()=>editClient(el.dataset.edit,dashboard)));
}
async function clients(){
  const params=new URLSearchParams(listState),data=await api('/admin/clients?'+params);
  main().innerHTML=title('CUSTOMERS & SUBSCRIPTIONS','العملاء والاشتراكات','أنت تحدد الرمز، المدة، والسكربتات المسموحة لكل عميل.',button('إضافة عميل','add-client',true)+refreshButton)+
  `<div class="toolbar"><form class="search-form" id="client-search"><input class="control" name="q" aria-label="البحث عن عميل" placeholder="اسم العميل أو آخر 3 أرقام من رمزه…" value="${e(listState.q)}"><button class="button ghost" aria-label="بحث">${icon('search')}</button></form><select class="control" id="client-status" aria-label="حالة الاشتراك">${[['all','جميع الحالات'],['active','نشط'],['expiring','قارب على الانتهاء'],['expired','منتهي'],['disabled','موقوف']].map(([v,t])=>`<option value="${v}" ${v===listState.status?'selected':''}>${t}</option>`).join('')}</select><button class="button ghost small" id="export-clients">${icon('download')}تصدير النتائج</button></div>
  ${data.items.length?`<div class="table-wrap"><table><thead><tr><th>العميل</th><th>رمز الدخول</th><th>الاشتراك</th><th>ينتهي في</th><th>آخر دخول</th><th>إدارة</th></tr></thead><tbody>${data.items.map(c=>`<tr><td><div class="table-person"><span class="avatar">${e(c.name.slice(0,1))}</span><div><strong>${c.online&&c.status==='active'?'<span class="online-indicator" title="نشاط خلال آخر 3 دقائق"></span>':''}${e(c.name)}</strong><small>${c.loginCount} عملية دخول · ${c.maxSessions} جلسة مسموحة</small></div></div></td><td dir="ltr">${e(c.maskedCode)}</td><td>${statusBadge(c.status)}</td><td>${date(c.expiresAt)}<br><span class="muted small">${c.status==='active'?'متبقي '+daysLeft(c.expiresAt)+' يوم':'—'}</span></td><td class="muted">${date(c.lastLoginAt)}</td><td><div class="row gap-sm"><button class="button small ghost" data-edit="${c.id}">إدارة</button><button class="button small ghost" data-extend="${c.id}">تمديد</button><a class="text-button" href="#activity?clientId=${c.id}">السجل</a></div></td></tr>`).join('')}</tbody></table></div>${pagination(data)}`:empty('لا يوجد عملاء مطابقون','أضف عميلك الأول وحدد له رمزًا من 9 أرقام ومدة اشتراك.')}`;
  $('#add-client').onclick=safely(()=>editClient(null,clients));$('#refresh-page').onclick=safely(clients);
  $('#client-search').onsubmit=ev=>{ev.preventDefault();listState.q=new FormData(ev.currentTarget).get('q');listState.page=1;safely(clients)();};
  $('#client-status').onchange=ev=>{listState.status=ev.target.value;listState.page=1;safely(clients)();};
  $$('[data-edit]').forEach(b=>b.onclick=safely(()=>editClient(b.dataset.edit,clients)));
  $$('[data-extend]').forEach(b=>b.onclick=()=>extend(data.items.find(c=>c.id===b.dataset.extend),clients));
  if($('#prev-page'))$('#prev-page').onclick=safely(async()=>{listState.page--;await clients();});
  if($('#next-page'))$('#next-page').onclick=safely(async()=>{listState.page++;await clients();});
  $('#export-clients').onclick=safely(async()=>{
    const all=[];for(let page=1;page<=500;page++){const batch=await api('/admin/clients?'+new URLSearchParams({...listState,page}));all.push(...batch.items);if(page>=batch.pages)break;}
    csvDownload('meshari-clients.csv',['الاسم','آخر الرمز','الحالة','الانتهاء','آخر دخول','عدد الدخول'],all.map(c=>[c.name,c.maskedCode,c.status,date(c.expiresAt),date(c.lastLoginAt),c.loginCount]));toast('تم تصدير النتائج.');
  });
}
async function editClient(id,onSaved){
  const [c,available]=await Promise.all([id?api('/admin/clients/'+id):Promise.resolve(null),api('/scripts')]);
  const expires=c?.expiresAt??new Date(Date.now()+30*86400000).toISOString();
  const d=modal(c?'إدارة اشتراك '+c.name:'عميل جديد','الرمز يحدده مشاري. لن يُعرض كاملًا بعد حفظه.',`<form id="client-form"><div class="field-grid">
    ${field('اسم العميل','name',c?.name??'','text','required minlength="2" maxlength="150" autocomplete="off"')}
    <label class="field">${c?'رمز جديد — اختياري':'رمز الدخول الذي تختاره'}<input name="code" type="text" inputmode="numeric" pattern="[0-9٠-٩۰-۹]{9}" minlength="9" maxlength="9" autocomplete="off" dir="ltr" placeholder="${c?e(c.maskedCode):'9 أرقام'}" ${c?'':'required'}><small>${c?'اتركه فارغًا للإبقاء على الرمز الحالي. تغييره يلغي جميع جلسات العميل.':'الأصفار في البداية محفوظة. مثال على الصيغة: 012345678'}</small></label>
    <label class="field">مدة سريعة<select id="duration"><option value="">تاريخ مخصص${c?' / إبقاء التاريخ':''}</option>${[1,7,30,90,180,365].map(n=>`<option value="${n}" ${!c&&n===30?'selected':''}>${n} يوم من الآن</option>`).join('')}</select></label>
    ${field('نهاية الاشتراك — توقيت السعودية','expiresAt',riyadhInput(expires),'datetime-local','required')}
    <label class="field">عدد الجلسات المتزامنة<select name="maxSessions">${[1,2,3,4,5].map(n=>`<option ${n===(c?.maxSessions??1)?'selected':''}>${n}</option>`).join('')}</select><small>الدخول الجديد يستبدل أقدم جلسة عند بلوغ الحد.</small></label>
    <div><label class="check"><input type="checkbox" name="active" ${!c||c.active?'checked':''}><span>الاشتراك مفعّل<small>إيقافه يلغي الجلسات الحالية ويمنع الدخول.</small></span></label></div>
    <div class="span-all"><label class="check"><input type="checkbox" name="allScripts" ${c?.allScripts?'checked':''}><span>كل السكربتات المنشورة<small>يشمل السكربتات التي تضيفها مستقبلًا.</small></span></label><div class="check-list" id="permissions">${available.length?available.map(s=>`<label class="check"><input type="checkbox" name="script" value="${s.id}" ${c?.allowedScriptIds.includes(s.id)?'checked':''}><span>${e(s.title)} <small>${e(s.category)} · ${s.published?'منشور':'مسودة'}</small></span></label>`).join(''):'<span class="muted small">لا توجد سكربتات بعد. يمكنك إضافتها ثم تعديل صلاحيات العميل.</span>'}</div></div>
    <div class="span-all">${textArea('ملاحظات خاصة بالإدارة','notes',c?.notes??'',2000)}</div></div>
    <div class="modal-foot"><button class="button primary" type="submit">${icon('check')}حفظ الاشتراك</button>${c?'<button class="button ghost small" type="button" id="revoke-client">إلغاء جلساته</button><button class="text-button" type="button" id="delete-client">حذف العميل</button>':''}</div></form>`);
  const form=$('#client-form');const toggle=()=>{$('#permissions').hidden=form.elements.allScripts.checked;};form.elements.allScripts.onchange=toggle;toggle();
  $('#duration').onchange=ev=>{if(ev.target.value)form.elements.expiresAt.value=riyadhInput(Date.now()+Number(ev.target.value)*86400000);};
  form.onsubmit=ev=>{ev.preventDefault();submit(form,async()=>{
    const f=new FormData(form);const data={name:f.get('name'),code:f.get('code'),expiresAt:expiryFromInput(f.get('expiresAt')),maxSessions:Number(f.get('maxSessions')),active:f.has('active'),allScripts:f.has('allScripts'),allowedScriptIds:f.getAll('script'),notes:f.get('notes'),...(c?{revision:c.revision}:{})};
    const saved=await api('/admin/clients'+(c?'/'+c.id:''),{method:c?'PUT':'POST',data});d.close();await onSaved();toast('تم حفظ اشتراك '+saved.name);
    if(data.code){const credential=modal('رمز '+saved.name,'احفظه وشاركه مع عميلك بالطريقة التي تختارها.',`<div class="credential-code">${e(data.code)}</div><p class="muted small">صالح حتى ${date(saved.expiresAt)} بتوقيت السعودية.</p><button class="button primary full" id="copy-code">نسخ الرمز</button>`);$('#copy-code').onclick=safely(async()=>{await navigator.clipboard.writeText(data.code);toast('تم نسخ الرمز.');credential.close();});}
  });};
  if(c){
    $('#revoke-client').onclick=safely(async()=>{await api('/admin/clients/'+c.id+'/revoke',{method:'POST',data:{}});toast('أُلغيت جلسات العميل. يمكنه الدخول مجددًا إذا كان الاشتراك نشطًا.');});
    $('#delete-client').onclick=safely(async()=>{d.close();if(await confirmAction('حذف العميل؟','سيُحذف اشتراك '+c.name+' وصلاحياته وجلساته. تبقى أحداثه في سجل النشاط.','حذف العميل')){await api('/admin/clients/'+c.id,{method:'DELETE',data:{revision:c.revision}});await onSaved();toast('تم حذف العميل.');}});
  }
}
function extend(c,onSaved){
  const d=modal('تمديد اشتراك '+c.name,'تضاف المدة إلى نهاية الاشتراك الحالي، أو من الآن إذا كان منتهيًا. يتم تفعيل الاشتراك.',`<form id="extend-form">${field('عدد الأيام الإضافية','days',30,'number','required min="1" max="3650"')}<p class="small muted">التاريخ الحالي: ${date(c.expiresAt)}</p><button class="button primary full" type="submit">تأكيد التمديد</button></form>`);
  const form=$('#extend-form');form.onsubmit=ev=>{ev.preventDefault();submit(form,async()=>{await api('/admin/clients/'+c.id+'/extend',{method:'POST',data:{days:Number(form.elements.days.value),revision:c.revision}});d.close();await onSaved();toast('تم تمديد الاشتراك.');});};
}
async function scriptList(){
  scripts=await api('/scripts');
  main().innerHTML=title('YOUR SCRIPT VAULT','إدارة السكربتات','ارفع الملف واكتب شرحه، ثم حدّد العملاء المسموح لهم به.',button('إضافة سكربت','add-script',true)+refreshButton)+
  `<div class="notice neutral">الملفات محفوظة في الخادم؛ التنزيل متاح فقط للحسابات المصرّح لها. الحد الأقصى للملف 2 ميجابايت.</div>`+
  (scripts.length?`<div class="script-grid">${scripts.map(s=>`<article class="script-card"><div class="script-top"><span class="file-icon">${icon('script')}</span><span class="badge ${s.published?'':'gray'}">${s.published?'منشور':'مسودة'}</span></div><h3>${e(s.title)}</h3><p>${e(s.description||'لم تتم إضافة وصف.')}</p><div class="script-meta">${e(s.category)} · ${e(s.version)} · <span dir="ltr">${size(s.fileSize)}</span></div><div class="script-footer"><button class="button small primary" data-script-edit="${s.id}">تعديل السكربت</button><a class="button small ghost" href="#script/${s.id}">معاينة</a></div></article>`).join('')}</div>`:empty('مكتبتك جاهزة لاستقبال أول سكربت','أضف اسم السكربت وملفه، واكتب المتطلبات وطريقة التركيب والاستخدام.'));
  $('#add-script').onclick=()=>editScript(null);$('#refresh-page').onclick=safely(scriptList);$$('[data-script-edit]').forEach(el=>el.onclick=()=>editScript(scripts.find(s=>s.id===el.dataset.scriptEdit)));
}
function editScript(s){
  const d=modal(s?'تعديل '+s.title:'إضافة سكربت','اكتب شرحًا واضحًا؛ سيظهر للعميل داخل واجهة التركيب.',`<form id="script-form"><div class="field-grid">${field('اسم السكربت','title',s?.title??'','text','required minlength="2" maxlength="150"')}${field('التصنيف','category',s?.category??'','text','required maxlength="80"')}${field('رقم الإصدار','version',s?.version??'1.0','text','required maxlength="40"')}<label class="field">ملف السكربت<input name="file" type="file" accept=".gpc,.gpc2,.txt,.bin,.zpk,.zip" ${s?'':'required'}><small>${s?'الحالي: '+e(s.fileName)+' — اختيار ملف جديد يستبدله.':'الحد الأقصى 2 ميجابايت.'}</small></label></div>${textArea('وصف مختصر','description',s?.description)}${textArea('المتطلبات والتوافق','requirements',s?.requirements)}${textArea('طريقة التركيب خطوة بخطوة','installation',s?.installation,20000)}${textArea('طريقة الاستخدام والإعدادات','usage',s?.usage,20000)}${textArea('ما الجديد في هذا الإصدار؟','changelog',s?.changelog)}<label class="check"><input type="checkbox" name="published" ${s?.published?'checked':''}><span>نشر السكربت للعملاء المصرّح لهم</span></label><div class="modal-foot"><button class="button primary" type="submit">حفظ السكربت</button>${s?'<button type="button" class="text-button" id="delete-script">حذف السكربت</button>':''}</div></form>`);
  const form=$('#script-form');form.onsubmit=ev=>{ev.preventDefault();submit(form,async()=>{
    const f=new FormData(form),data={};for(const name of ['title','category','version','description','requirements','installation','usage','changelog'])data[name]=f.get(name);data.published=f.has('published');if(s)data.revision=s.revision;
    const file=form.elements.file.files[0];if(file){if(file.size>2097152)throw new Error('الحد الأقصى للملف 2 ميجابايت.');data.fileName=file.name;data.fileBase64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('تعذّرت قراءة الملف.'));reader.readAsDataURL(file);});}
    await api('/admin/scripts'+(s?'/'+s.id:''),{method:s?'PUT':'POST',data});d.close();await scriptList();toast('تم حفظ السكربت.');
  });};
  if(s)$('#delete-script').onclick=safely(async()=>{d.close();if(await confirmAction('حذف السكربت؟','سيُحذف الملف والشرح وصلاحيات الوصول المرتبطة به.','حذف السكربت')){await api('/admin/scripts/'+s.id,{method:'DELETE',data:{revision:s.revision}});await scriptList();toast('تم حذف السكربت.');}});
}
async function activity(){
  const data=await api('/admin/audit?'+new URLSearchParams(logState));
  main().innerHTML=title('ACCESS & ACTIVITY','سجل الدخول والنشاط','عمليات الدخول والتنزيل وتغييرات الإدارة. يُحتفظ بالسجل لمدة 90 يومًا.',refreshButton)+
  `<div class="toolbar"><select class="control" id="activity-action" aria-label="نوع النشاط"><option value="">كل النشاطات</option>${Object.entries(actions).map(([v,t])=>`<option value="${v}" ${logState.action===v?'selected':''}>${t}</option>`).join('')}</select>${logState.clientId?'<a class="button small ghost" href="#activity">إلغاء تصفية العميل</a>':''}<button class="button small ghost" id="export-log">${icon('download')}تصدير هذه الصفحة</button></div>`+
  (data.items.length?`<div class="table-wrap"><table><thead><tr><th>الوقت — السعودية</th><th>صاحب النشاط</th><th>العملية</th><th>التفاصيل</th><th>المتصفح والشبكة</th></tr></thead><tbody>${data.items.map(x=>`<tr><td>${date(x.createdAt)}</td><td><strong>${e(x.actor)}</strong></td><td><span class="badge ${x.action.includes('failed')?'red':'gray'}">${e(actions[x.action]??x.action)}</span></td><td class="muted">${e(x.detail||'—')}</td><td><span dir="ltr">${e(x.device)}</span><br><span class="muted small" dir="ltr">${e(x.ipHint)}</span></td></tr>`).join('')}</tbody></table></div>${pagination(data)}`:empty('لا توجد عمليات مطابقة','جرّب تغيير نوع النشاط أو العودة إلى جميع العملاء.'))+
  '<p class="hint">اسم العميل يُعرف من رمزه الصحيح. الرمز المجهول يُسجل كزائر. عنوان الشبكة معروض جزئيًا؛ نشاط الجهاز وتأكيد التركيب بلاغات من متصفح العميل.</p>';
  $('#refresh-page').onclick=safely(activity);$('#activity-action').onchange=ev=>{logState.action=ev.target.value;logState.page=1;safely(activity)();};
  if($('#prev-page'))$('#prev-page').onclick=safely(async()=>{logState.page--;await activity();});if($('#next-page'))$('#next-page').onclick=safely(async()=>{logState.page++;await activity();});
  $('#export-log').onclick=()=>csvDownload('meshari-activity.csv',['الوقت','العميل','العملية','التفاصيل','المتصفح','الشبكة'],data.items.map(x=>[date(x.createdAt),x.actor,actions[x.action]??x.action,x.detail,x.device,x.ipHint]));
}
async function sessions(){
  const data=await api('/admin/sessions');
  main().innerHTML=title('SESSION CONTROL','الجلسات الحالية','تابع الأجهزة المسجّلة، وألغِ أي جلسة عند الحاجة.',refreshButton)+
  (data.length?`<div class="table-wrap"><table><thead><tr><th>الحساب</th><th>الجهاز</th><th>بدأت في</th><th>آخر نشاط</th><th>تنتهي في</th><th>إجراء</th></tr></thead><tbody>${data.map(s=>`<tr><td><strong>${e(s.name??'مشاري — الإدارة')}</strong><br><span class="muted small">${s.role==='admin'?'مدير النظام':'عميل'}</span></td><td dir="ltr">${e(s.device)}<br><span class="muted small">${e(s.ipHint)}</span></td><td>${date(s.createdAt)}</td><td>${date(s.lastSeenAt)}</td><td>${date(s.expiresAt)}</td><td><button class="button small danger" data-revoke="${s.id}">إلغاء الجلسة</button></td></tr>`).join('')}</tbody></table></div>`:empty('لا توجد جلسات','ستظهر هنا الجلسات عند تسجيل الدخول.'))+'<p class="hint">الجلسة لا تعني أن الصفحة مفتوحة الآن. آخر نشاط يعكس آخر طلب وصل إلى الخادم. تعرض القائمة أحدث 200 جلسة.</p>';
  $('#refresh-page').onclick=safely(sessions);$$('[data-revoke]').forEach(el=>el.onclick=safely(async()=>{if(await confirmAction('إلغاء الجلسة؟','سيحتاج صاحبها إلى تسجيل الدخول من جديد.','إلغاء الجلسة')){await api('/admin/sessions/'+el.dataset.revoke,{method:'DELETE',data:{}});await sessions();toast('تم إلغاء الجلسة.');}}));
}
function settings(logout){
  main().innerHTML=title('OWNER ACCOUNT','حساب مشاري','صلاحيات الإدارة متاحة لحساب المالك فقط.')+`<div class="detail-grid"><section class="panel"><div class="panel-heading"><h2>تغيير كلمة مرور الإدارة</h2>${icon('lock')}</div><form id="password-form">${field('كلمة المرور الحالية','currentPassword','','password','required autocomplete="current-password"')}${field('كلمة المرور الجديدة','newPassword','','password','required minlength="12" maxlength="128" autocomplete="new-password"')}${field('تأكيد كلمة المرور الجديدة','confirmPassword','','password','required minlength="12" maxlength="128" autocomplete="new-password"')}<p class="hint">12 حرفًا على الأقل. بعد التغيير تُلغى جميع جلسات الإدارة.</p><hr><button class="button primary" type="submit">حفظ كلمة المرور</button></form></section><section class="panel"><h2>سياسة الاشتراكات</h2><p class="muted small">كل عميل يدخل برمز من 9 أرقام تحدده أنت. يُفحص تاريخ الانتهاء والصلاحيات في الخادم عند كل طلب.</p><hr><h3>ما الذي يمكنك التحكم به؟</h3><p class="muted small">إيقاف العميل، تمديد اشتراكه، تغيير رمزه، تحديد سكربتاته، ضبط الجلسات، ومتابعة نشاطه.</p><hr><p class="muted small">الأوقات بتوقيت السعودية. سجل النشاط لمدة 90 يومًا. الرموز وكلمات المرور لا تُحفظ كنصوص مكشوفة.</p></section></div>`;
  const form=$('#password-form');form.onsubmit=ev=>{ev.preventDefault();submit(form,async()=>{if(form.elements.newPassword.value!==form.elements.confirmPassword.value)throw new Error('كلمتا المرور غير متطابقتين.');await api('/admin/password',{method:'POST',data:{currentPassword:form.elements.currentPassword.value,newPassword:form.elements.newPassword.value}});toast('تم تغيير كلمة المرور. سجّل الدخول بالكلمة الجديدة.');logout();});};
}
