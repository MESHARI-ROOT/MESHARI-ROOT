export function platformSupport(nav=globalThis.navigator,secure=globalThis.isSecureContext){
 const ua=nav?.userAgent||'';
 const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(ua)||(/Macintosh/i.test(ua)&&(nav?.maxTouchPoints||0)>1);
 const hid=!!nav?.hid&&secure!==false;
 return {mobile,hid,canConnect:!mobile&&hid};
}
export function platformNotice(p=platformSupport()){
 if(p.mobile)return '<aside class="platform-notice" role="status"><strong>التركيب يحتاج كمبيوتر</strong><p>أنت تتصفح من جوال أو جهاز لوحي. يمكنك قراءة التعليمات وتصفّح المكتبة؛ افتح الرابط على الكمبيوتر بمتصفح Google Chrome أو Edge لتوصيل قطعة Zen.</p><button class="button ghost" id="copy-desktop-link">نسخ رابط الموقع للكمبيوتر</button><span id="copy-link-status" role="status"></span></aside>';
 if(!p.canConnect)return '<aside class="platform-notice" role="status"><strong>افتح الموقع بمتصفح Chrome أو Edge على الكمبيوتر</strong><p>فحص USB غير متاح في هذا المتصفح. الشرح والمكتبة متاحان، وتركيب السكربتات عبر Zen Studio يحتاج Windows.</p></aside>';
 return '<aside class="platform-notice compatible" role="status"><strong>متصفحك يدعم فحص قطعة Zen</strong><p>وصّل كابل البيانات، ثم اضغط «فحص اتصال القطعة» واختر جهازك. برنامج Zen Studio للكمبيوتر يحتاج Windows؛ لن يبدأ تركيب أو تحديث تلقائيًا.</p></aside>';
}
export function bindPlatformNotice(){const b=document.querySelector('#copy-desktop-link');if(b)b.onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/#home');document.querySelector('#copy-link-status').textContent='تم نسخ الرابط';}catch{document.querySelector('#copy-link-status').textContent='انسخ الرابط من شريط عنوان المتصفح.';}};}
