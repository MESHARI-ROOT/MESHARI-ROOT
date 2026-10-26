import {platformSupport} from './platform.js';
export class ZenDevice {
  constructor(hid=globalThis.navigator?.hid,onChange=()=>{}){this.hid=hid;this.device=null;this.onChange=onChange;hid?.addEventListener('disconnect',event=>{if(event.device===this.device){this.device=null;onChange('disconnected');}});}
  get supported(){return !!this.hid&&globalThis.isSecureContext!==false&&!platformSupport().mobile;}
  async connect(){
    if(!this.supported)throw new Error('فحص USB متاح في Chrome أو Edge على الكمبيوتر عبر HTTPS. تستطيع متابعة الخطوات باستخدام أداة Cronus الرسمية.');
    const devices=await this.hid.requestDevice({filters:[]});
    const device=devices.find(d=>/cronus|\bzen\b/i.test(d.productName));
    if(!devices.length)throw new Error('لم يتم اختيار جهاز. اختر Cronus ZEN ثم اضغط اتصال.');
    if(!device)throw new Error('الجهاز المختار ليس Cronus ZEN. أعد المحاولة واختر القطعة الصحيحة.');
    try{if(!device.opened)await device.open();}catch{throw new Error('تعذّر فتح القطعة. أغلق البرامج الأخرى التي تستخدمها وتحقق من كابل البيانات.');}
    // Release immediately: the official updater/Studio needs exclusive access.
    try{await device.close();}catch{throw new Error('تعذّر تحرير اتصال القطعة. افصل USB وأعد توصيله قبل فتح الأداة الرسمية.');}
    this.device=device;this.onChange('connected');
    return {name:device.productName,vendorId:device.vendorId,productId:device.productId};
  }
}
