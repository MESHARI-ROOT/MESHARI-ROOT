import { randomUUID } from 'node:crypto';
import { ApiError, normalizeCode, sha256, codeHash, randomToken, passwordHash, verifyPassword, ipHint, deviceHint } from './security.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILE_LIMIT = 2*1024*1024;
const JSON_LIMIT = 3*1024*1024;
const scriptColumns = 'id,title,category,version,description,requirements,installation,usage,changelog,published,access_tier,price_halalas,file_name,file_size,sha256,created_at,updated_at,revision';
const camel = row => Object.fromEntries(Object.entries(row).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),v]));
const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json; charset=utf-8',...headers}});
const textField = (v,name,min,max) => { if(typeof v!=='string'||v.trim().length<min||v.trim().length>max) throw new ApiError(422,`${name}: العدد المسموح من ${min} إلى ${max} حرفًا.`); return v.trim(); };
const bool = v => {if(typeof v!=='boolean')throw new ApiError(422,'قيمة اختيار غير صالحة.');return v;};
const idCheck = id => {if(!UUID.test(id??''))throw new ApiError(404,'العنصر غير موجود.');return id;};
const version = n => {if(!Number.isSafeInteger(n)||n<1)throw new ApiError(422,'حدّث الصفحة ثم أعد المحاولة.');return n;};
function expiry(value) {const d=new Date(value);if(typeof value!=='string'||!Number.isFinite(+d)||+d>Date.now()+3650*86400000)throw new ApiError(422,'تاريخ انتهاء الاشتراك غير صالح.');return d.toISOString();}
function clientDto(row) { const {code_hash,code_hint,...safe}=row;return {...camel(safe),maskedCode:'••••••'+code_hint,status:!row.active?'disabled':new Date(row.expires_at)<=new Date()?'expired':'active'}; }
async function body(req) {
  if(!req.headers.get('content-type')?.startsWith('application/json'))throw new ApiError(415,'صيغة الطلب غير مدعومة.');
  if(Number(req.headers.get('content-length'))>JSON_LIMIT)throw new ApiError(413,'الملف أكبر من الحد المسموح.');
  let size=0;const chunks=[];const reader=req.body?.getReader();if(!reader)throw new ApiError(400,'الطلب فارغ.');
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>JSON_LIMIT){await reader.cancel();throw new ApiError(413,'الملف أكبر من الحد المسموح.');}chunks.push(Buffer.from(value));}
  try {const b=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!b||typeof b!=='object'||Array.isArray(b))throw 0;return b;}catch{throw new ApiError(400,'تعذّر قراءة بيانات الطلب.');}
}
export function createApp({db,env=process.env,logger=console}) {
  // Public download throttling has its own ephemeral salt until admin setup exists.
  const publicRateSalt=randomToken();
  const cookieName=env.ZEN_LOCAL_DEV==='1'?'zen_local':'__Host-zen';
  const cookie=(token,seconds=28800)=>`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${env.ZEN_LOCAL_DEV==='1'?'':'; Secure'}`;
  const tokenFrom=req=>(req.headers.get('cookie')??'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)??'';
  const query=async(c,sql,args=[]) => (await c.query(sql,args)).rows;
  async function ready(){
    if((env.AUTH_PEPPER??'').length<32)throw new ApiError(503,'الخدمة تحتاج إعداد الإدارة وقاعدة البيانات. راجع دليل النشر.');
    let rows=await query(db,'SELECT id FROM zen_admin WHERE id=1');
    if(!rows.length){
      if(!/^scrypt\$32768\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(env.ADMIN_PASSWORD_HASH??''))throw new ApiError(503,'حساب الإدارة لم يُهيّأ بعد.');
      await db.query('INSERT INTO zen_admin(id,username,password_hash) VALUES(1,$1,$2) ON CONFLICT(id) DO NOTHING',[env.ADMIN_USER||'meshari',env.ADMIN_PASSWORD_HASH]);
    }
  }
  async function audit(c,ctx,actor,clientId,action,detail='') {
    await c.query('INSERT INTO zen_audit(actor,client_id,action,detail,ip_hint,device) VALUES($1,$2,$3,$4,$5,$6)',[actor.slice(0,150),clientId,action,String(detail).slice(0,400),ctx.ipHint,ctx.device]);
  }
  async function limit(key,max,seconds,isPublic=false) {
    const hashed=codeHash(key,isPublic?(env.AUTH_PEPPER||publicRateSalt):env.AUTH_PEPPER);
    const [r]=await query(db,`INSERT INTO zen_limits(key,attempts,resets_at) VALUES($1,1,now()+($2::int*interval '1 second'))
      ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN zen_limits.resets_at<=now() THEN 1 ELSE zen_limits.attempts+1 END,
      resets_at=CASE WHEN zen_limits.resets_at<=now() THEN now()+($2::int*interval '1 second') ELSE zen_limits.resets_at END RETURNING attempts`,[hashed,seconds]);
    if(r.attempts>max)throw new ApiError(429,'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.');
  }
  async function auth(req,c=db) {
    const token=tokenFrom(req);if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new ApiError(401,'سجّل الدخول للمتابعة.');
    const [s]=await query(c,`SELECT s.*,c.name,c.active,c.expires_at AS subscription_expires_at FROM zen_sessions s LEFT JOIN zen_clients c ON c.id=s.client_id WHERE token_hash=$1 AND s.expires_at>now()`,[sha256(token)]);
    if(!s)throw new ApiError(401,'انتهت الجلسة أو ألغتها الإدارة. سجّل الدخول مرة أخرى.');
    if(s.role==='client'&&(!s.active||new Date(s.subscription_expires_at)<=new Date()))throw new ApiError(401,'الاشتراك منتهٍ أو موقوف. تواصل مع مشاري لتجديده.');
    await c.query('UPDATE zen_sessions SET last_seen_at=now() WHERE id=$1',[s.id]);
    return s;
  }
  const admin=s=>{if(s.role!=='admin')throw new ApiError(403,'هذه الصلاحية متاحة للإدارة فقط.');};
  async function accessible(c,s,id,includeFile=false){
    const rows=await query(c,`SELECT ${scriptColumns}${includeFile?',file_data':''} FROM zen_scripts t WHERE id=$1 AND ($2::boolean OR (published=true AND EXISTS(SELECT 1 FROM zen_clients c WHERE c.id=$3 AND c.active=true AND c.expires_at>now() AND (t.access_tier='free' OR c.all_scripts OR EXISTS(SELECT 1 FROM zen_permissions p WHERE p.client_id=c.id AND p.script_id=t.id)))))`,[id,s.role==='admin',s.client_id]);
    if(!rows.length)throw new ApiError(404,'السكربت غير موجود أو غير متاح لاشتراكك.');return rows[0];
  }
  async function permissions(c,id,ids){
    if(!Array.isArray(ids)||ids.length>500||ids.some(x=>!UUID.test(x)))throw new ApiError(422,'قائمة السكربتات غير صالحة.');
    const unique=[...new Set(ids)];
    if(unique.length){const rows=await query(c,'SELECT id FROM zen_scripts WHERE id=ANY($1::uuid[])',[unique]);if(rows.length!==unique.length)throw new ApiError(422,'أحد السكربتات المحددة لم يعد موجودًا.');}
    await c.query('DELETE FROM zen_permissions WHERE client_id=$1',[id]);
    for(const sid of unique)await c.query('INSERT INTO zen_permissions(client_id,script_id) VALUES($1,$2)',[id,sid]);
  }
  async function client(c,id){
    const [r]=await query(c,'SELECT * FROM zen_clients WHERE id=$1',[id]);if(!r)throw new ApiError(404,'العميل غير موجود.');
    const p=await query(c,'SELECT script_id FROM zen_permissions WHERE client_id=$1',[id]);
    return {...clientDto(r),allowedScriptIds:p.map(x=>x.script_id)};
  }
  function parseClient(b,create){
    const name=textField(b.name,'اسم العميل',2,150), notes=textField(b.notes??'','الملاحظات',0,2000), expiresAt=expiry(b.expiresAt);
    if(create&&new Date(expiresAt)<=new Date())throw new ApiError(422,'اختر مدة اشتراك تبدأ من الآن.');
    if(!Number.isInteger(b.maxSessions)||b.maxSessions<1||b.maxSessions>5)throw new ApiError(422,'عدد الجلسات من 1 إلى 5.');
    return {name,notes,expiresAt,active:bool(b.active),allScripts:bool(b.allScripts),maxSessions:b.maxSessions,code:create||b.code?normalizeCode(b.code):null};
  }
  function parseScript(b,create){
    const data={};for(const [field,label,min,max] of [['title','الاسم',2,150],['category','التصنيف',1,80],['version','الإصدار',1,40],['description','الوصف',0,8000],['requirements','المتطلبات',0,8000],['installation','التركيب',0,20000],['usage','الاستخدام',0,20000],['changelog','التحديثات',0,8000]])data[field]=textField(b[field]??'',label,min,max);
    data.published=bool(b.published);
    data.accessTier=b.accessTier??'paid';
    if(!['free','paid'].includes(data.accessTier))throw new ApiError(422,'اختر مجاني أو مدفوع.');
    data.priceHalalas=b.priceHalalas??0;
    if(!Number.isSafeInteger(data.priceHalalas)||data.priceHalalas<0||data.priceHalalas>100000000||data.accessTier==='free'&&data.priceHalalas!==0)throw new ApiError(422,'سعر غير صالح. يجب أن يكون سعر المجاني صفرًا.');
    if(create||b.fileBase64){
      data.fileName=textField(b.fileName,'اسم الملف',1,180);
      if(/[\x00-\x1f\/\\]/.test(data.fileName)||! /\.(gpc|gpc2|txt|bin|zpk|zip)$/i.test(data.fileName))throw new ApiError(422,'ارفع ملف gpc أو gpc2 أو txt أو bin أو zpk أو zip.');
      if(typeof b.fileBase64!=='string'||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b.fileBase64))throw new ApiError(422,'محتوى الملف غير صالح.');
      data.file=Buffer.from(b.fileBase64,'base64');if(!data.file.length||data.file.length>FILE_LIMIT)throw new ApiError(413,'الحد الأقصى للملف 2 ميجابايت.');
      data.sha256=sha256(data.file);
    }return data;
  }
  async function route(req,ctx){
    const url=new URL(req.url),path=url.pathname.replace(/\/$/,''),method=req.method;
    const publicRead=method==='GET'&&(path==='/api/catalog'||/^\/api\/free-scripts\/[^/]+(?:\/download)?$/.test(path));
    if(!publicRead)await ready();
    if(path==='/api/health'&&method==='GET')return json({ready:true,version:'3.0.0'});
    if(['POST','PUT','DELETE','PATCH'].includes(method)){
      if(req.headers.get('origin')!==url.origin||req.headers.get('X-Zen-Request')!=='1')throw new ApiError(403,'مصدر الطلب غير معتمد.');
    }
    if(path==='/api/auth/client'&&method==='POST'){
      await limit('login-ip:'+ctx.ip,20,600);const b=await body(req),code=normalizeCode(b.code);
      return db.transaction(async c=>{
        const [r]=await query(c,'SELECT * FROM zen_clients WHERE code_hash=$1 FOR UPDATE',[codeHash(code,env.AUTH_PEPPER)]);
        if(!r||!r.active||new Date(r.expires_at)<=new Date()){
          await audit(c,ctx,r?.name??'زائر',r?.id??null,'login_failed','رمز غير صالح أو اشتراك غير متاح');
          return json({error:'رمز الدخول غير صالح أو الاشتراك منتهٍ أو موقوف.'},401);
        }
        const token=randomToken(),sessionId=randomUUID();
        const old=await query(c,'SELECT id FROM zen_sessions WHERE client_id=$1 AND expires_at>now() ORDER BY created_at DESC',[r.id]);
        for(const s of old.slice(r.max_sessions-1))await c.query('DELETE FROM zen_sessions WHERE id=$1',[s.id]);
        await c.query("INSERT INTO zen_sessions(id,token_hash,role,client_id,expires_at,ip_hint,device) VALUES($1,$2,'client',$3,now()+interval '12 hours',$4,$5)",[sessionId,sha256(token),r.id,ctx.ipHint,ctx.device]);
        await c.query('UPDATE zen_clients SET last_login_at=now(),login_count=login_count+1 WHERE id=$1',[r.id]);
        await audit(c,ctx,r.name,r.id,'login_success');
        return json({role:'client',name:r.name,expiresAt:r.expires_at},200,{'Set-Cookie':cookie(token,43200)});
      });
    }
    if(path==='/api/auth/admin'&&method==='POST'){
      await limit('admin-ip:'+ctx.ip,12,900);const b=await body(req);
      const [a]=await query(db,'SELECT * FROM zen_admin WHERE id=1');
      const validPassword=await verifyPassword(b.password,a.password_hash);
      if(b.username!==a.username||!validPassword){await audit(db,ctx,'زائر',null,'admin_login_failed');return json({error:'اسم المستخدم أو كلمة المرور غير صحيحة.'},401);}
      const token=randomToken();
      await db.transaction(async c=>{
        await c.query("INSERT INTO zen_sessions(id,token_hash,role,expires_at,ip_hint,device) VALUES($1,$2,'admin',now()+interval '8 hours',$3,$4)",[randomUUID(),sha256(token),ctx.ipHint,ctx.device]);
        await audit(c,ctx,a.username,null,'admin_login_success');
      });
      return json({role:'admin',name:a.username},200,{'Set-Cookie':cookie(token)});
    }
    if(path==='/api/auth/logout'&&method==='POST'){
      await db.query('DELETE FROM zen_sessions WHERE token_hash=$1',[sha256(tokenFrom(req))]);
      return json({ok:true},200,{'Set-Cookie':cookie('',0)});
    }
    // Public catalogue deliberately excludes files, hashes and private instructions.
    if(path==='/api/catalog'&&method==='GET'){
      await limit('catalog:'+ctx.ip,120,60,true);
      const rows=await query(db,'SELECT id,title,category,version,description,access_tier,price_halalas,updated_at FROM zen_scripts WHERE published=true ORDER BY updated_at DESC,id');
      return json(rows.map(camel));
    }
    const freeMatch=path.match(/^\/api\/free-scripts\/([^/]+)(\/download)?$/);
    if(freeMatch&&method==='GET'){
      await limit('public-download:'+ctx.ip,60,60,true);
      const [r]=await query(db,`SELECT ${scriptColumns}${freeMatch[2]?',file_data':''} FROM zen_scripts WHERE id=$1 AND published=true AND access_tier='free'`,[idCheck(freeMatch[1])]);
      if(!r)throw new ApiError(404,'السكربت المجاني غير متاح.');
      if(!freeMatch[2])return json(camel(r));
      return new Response(Buffer.from(r.file_data),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="script${r.file_name.match(/\.[a-z0-9]+$/i)?.[0]??'.bin'}"; filename*=UTF-8''${encodeURIComponent(r.file_name).replace(/'/g,'%27')}`,'X-Content-SHA256':r.sha256}});
    }
    const s=await auth(req);
    await limit('session:'+s.id,240,60);
    if(path==='/api/me'&&method==='GET')return json({role:s.role,name:s.name??'مشاري',clientId:s.client_id,expiresAt:s.subscription_expires_at,sessionExpiresAt:s.expires_at});
    if(path==='/api/scripts'&&method==='GET'){
      const rows=await query(db,`SELECT ${scriptColumns} FROM zen_scripts t WHERE $1::boolean OR (published=true AND EXISTS(SELECT 1 FROM zen_clients c WHERE c.id=$2 AND c.active=true AND c.expires_at>now() AND (t.access_tier='free' OR c.all_scripts OR EXISTS(SELECT 1 FROM zen_permissions p WHERE p.client_id=c.id AND p.script_id=t.id)))) ORDER BY updated_at DESC`,[s.role==='admin',s.client_id]);
      return json(rows.map(camel));
    }
    let match=path.match(/^\/api\/scripts\/([^/]+)(\/download)?$/);
    if(match&&method==='GET'){
      const r=await accessible(db,s,idCheck(match[1]),!!match[2]);
      if(!match[2])return json(camel(r));
      await audit(db,ctx,s.name??'مشاري',s.client_id,'download',r.title+' · '+r.version);
      return new Response(Buffer.from(r.file_data),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="script${r.file_name.match(/\.[a-z0-9]+$/i)?.[0]??'.bin'}"; filename*=UTF-8''${encodeURIComponent(r.file_name).replace(/'/g,'%27')}`,'X-Content-SHA256':r.sha256}});
    }
    if(path==='/api/activity'&&method==='POST'){
      const b=await body(req);const actions={device_connected:'اتصال جهاز أبلغ عنه المتصفح',device_disconnected:'فصل جهاز أبلغ عنه المتصفح',installation_confirmed:'أكد العميل إتمام التركيب في الأداة الرسمية',firmware_confirmed:'أكد العميل إتمام تحديث القطعة في الأداة الرسمية'};
      if(!actions[b.action])throw new ApiError(422,'نوع النشاط غير صالح.');
      await audit(db,ctx,s.name??'مشاري',s.client_id,b.action,actions[b.action]);return json({ok:true});
    }
    if(!path.startsWith('/api/admin/'))throw new ApiError(404,'الصفحة غير موجودة.');
    admin(s);
    if(path==='/api/admin/dashboard'&&method==='GET'){
      const [r]=await query(db,`SELECT count(*)::int AS total,count(*) FILTER(WHERE active AND expires_at>now())::int AS active,
        count(*) FILTER(WHERE expires_at<=now())::int AS expired,count(*) FILTER(WHERE NOT active)::int AS disabled,
        count(*) FILTER(WHERE active AND expires_at>now() AND expires_at<=now()+interval '7 days')::int AS expiring FROM zen_clients`);
      const [online]=await query(db,`SELECT count(DISTINCT s.client_id)::int AS online FROM zen_sessions s JOIN zen_clients c ON c.id=s.client_id WHERE s.expires_at>now() AND s.last_seen_at>now()-interval '3 minutes' AND c.active AND c.expires_at>now()`);
      const [activity]=await query(db,"SELECT count(*) FILTER(WHERE action='login_success')::int AS logins,count(*) FILTER(WHERE action='download')::int AS downloads FROM zen_audit WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'Asia/Riyadh') AT TIME ZONE 'Asia/Riyadh'");
      const expiring=await query(db,"SELECT id,name,expires_at FROM zen_clients WHERE active AND expires_at>now() AND expires_at<=now()+interval '7 days' ORDER BY expires_at LIMIT 10");
      return json({...r,...online,todayLogins:activity.logins,todayDownloads:activity.downloads,expiringClients:expiring.map(camel)});
    }
    if(path==='/api/admin/clients'&&method==='GET'){
      const page=Math.max(1,Math.min(10000,Number(url.searchParams.get('page'))||1)),search=(url.searchParams.get('q')??'').slice(0,150),status=url.searchParams.get('status')??'all';
      const filter=`(name ILIKE $1 OR code_hint=$2) AND ($3='all' OR ($3='active' AND active AND expires_at>now()) OR ($3='expired' AND expires_at<=now()) OR ($3='disabled' AND NOT active) OR ($3='expiring' AND active AND expires_at>now() AND expires_at<now()+interval '7 days'))`;
      const [count]=await query(db,`SELECT count(*)::int AS total FROM zen_clients WHERE ${filter}`,['%'+search+'%',search,status]);
      const rows=await query(db,`SELECT c.*,EXISTS(SELECT 1 FROM zen_sessions s WHERE s.client_id=c.id AND s.expires_at>now() AND s.last_seen_at>now()-interval '3 minutes') AS online FROM zen_clients c WHERE ${filter} ORDER BY created_at DESC,id LIMIT 20 OFFSET $4`,['%'+search+'%',search,status,(page-1)*20]);
      return json({items:rows.map(clientDto),total:count.total,page,pages:Math.max(1,Math.ceil(count.total/20))});
    }
    if(path==='/api/admin/clients'&&method==='POST'){
      const b=await body(req),v=parseClient(b,true),id=randomUUID();
      return db.transaction(async c=>{
        await c.query('INSERT INTO zen_clients(id,name,code_hash,code_hint,active,all_scripts,expires_at,max_sessions,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,v.name,codeHash(v.code,env.AUTH_PEPPER),v.code.slice(-3),v.active,v.allScripts,v.expiresAt,v.maxSessions,v.notes]);
        await permissions(c,id,b.allowedScriptIds??[]);await audit(c,ctx,'مشاري',id,'client_created',v.name);
        return json(await client(c,id),201);
      });
    }
    match=path.match(/^\/api\/admin\/clients\/([^/]+)(\/(extend|revoke))?$/);
    if(match){
      const id=idCheck(match[1]);
      if(method==='GET'&&!match[2])return json(await client(db,id));
      if(method==='POST'&&match[3]==='revoke'){
        const current=await client(db,id);await db.transaction(async c=>{await c.query('DELETE FROM zen_sessions WHERE client_id=$1',[id]);await audit(c,ctx,'مشاري',id,'sessions_revoked',current.name);});return json({ok:true});
      }
      if(method==='POST'&&match[3]==='extend'){
        const b=await body(req);version(b.revision);const newCode=b.code?normalizeCode(b.code):null;if(!Number.isInteger(b.days)||b.days<1||b.days>3650)throw new ApiError(422,'مدة التمديد من يوم إلى 3650 يومًا.');
        return db.transaction(async c=>{
          if(newCode){const [current]=await query(c,'SELECT code_hash FROM zen_clients WHERE id=$1 FOR UPDATE',[id]);if(current?.code_hash===codeHash(newCode,env.AUTH_PEPPER))throw new ApiError(422,'اختر رمزًا جديدًا مختلفًا عن الرمز الحالي.');}
          const rows=await query(c,"UPDATE zen_clients SET expires_at=GREATEST(expires_at,now())+($1::int*interval '1 day'),active=true,revision=revision+1,code_hash=COALESCE($4,code_hash),code_hint=COALESCE($5,code_hint) WHERE id=$2 AND revision=$3 RETURNING name",[b.days,id,b.revision,newCode?codeHash(newCode,env.AUTH_PEPPER):null,newCode?.slice(-3)??null]);
          if(!rows.length)throw new ApiError(409,'تغيرت بيانات العميل. حدّث القائمة قبل التمديد.');
          if(newCode){await c.query('DELETE FROM zen_sessions WHERE client_id=$1',[id]);await audit(c,ctx,'مشاري',id,'code_renewed','تم إصدار رمز تجديد وإلغاء الجلسات السابقة');}
          await audit(c,ctx,'مشاري',id,'subscription_extended',rows[0].name+' · '+b.days+' يوم');return json(await client(c,id));
        });
      }
      if(method==='PUT'&&!match[2]){
        const b=await body(req),v=parseClient(b,false);version(b.revision);
        return db.transaction(async c=>{
          const rows=await query(c,`UPDATE zen_clients SET name=$1,active=$2,all_scripts=$3,expires_at=$4,max_sessions=$5,notes=$6,revision=revision+1,
            code_hash=COALESCE($7,code_hash),code_hint=COALESCE($8,code_hint) WHERE id=$9 AND revision=$10 RETURNING id`,[v.name,v.active,v.allScripts,v.expiresAt,v.maxSessions,v.notes,v.code?codeHash(v.code,env.AUTH_PEPPER):null,v.code?.slice(-3)??null,id,b.revision]);
          if(!rows.length)throw new ApiError(409,'تغيرت البيانات في جلسة أخرى. حدّث القائمة.');
          await permissions(c,id,b.allowedScriptIds??[]);
          if(v.code||!v.active||new Date(v.expiresAt)<=new Date())await c.query('DELETE FROM zen_sessions WHERE client_id=$1',[id]);
          else await c.query('DELETE FROM zen_sessions WHERE client_id=$1 AND id NOT IN(SELECT id FROM zen_sessions WHERE client_id=$1 ORDER BY created_at DESC LIMIT $2)',[id,v.maxSessions]);
          await audit(c,ctx,'مشاري',id,'client_updated',v.name+(v.code?' · تغيير رمز الدخول':''));return json(await client(c,id));
        });
      }
      if(method==='DELETE'&&!match[2]){
        const b=await body(req);version(b.revision);
        return db.transaction(async c=>{const rows=await query(c,'DELETE FROM zen_clients WHERE id=$1 AND revision=$2 RETURNING name',[id,b.revision]);if(!rows.length)throw new ApiError(409,'تغيرت البيانات. حدّث القائمة.');await audit(c,ctx,'مشاري',id,'client_deleted',rows[0].name);return json({ok:true});});
      }
    }
    if(path==='/api/admin/audit'&&method==='GET'){
      const page=Math.max(1,Math.min(10000,Number(url.searchParams.get('page'))||1)),clientId=url.searchParams.get('clientId')||null,action=url.searchParams.get('action')||null;
      if(clientId)idCheck(clientId);
      const filter='($1::uuid IS NULL OR client_id=$1) AND ($2::text IS NULL OR action=$2)';
      const [count]=await query(db,`SELECT count(*)::int AS total FROM zen_audit WHERE ${filter}`,[clientId,action]);
      const rows=await query(db,`SELECT * FROM zen_audit WHERE ${filter} ORDER BY id DESC LIMIT 30 OFFSET $3`,[clientId,action,(page-1)*30]);
      return json({items:rows.map(camel),total:count.total,page,pages:Math.max(1,Math.ceil(count.total/30))});
    }
    if(path==='/api/admin/sessions'&&method==='GET'){
      const rows=await query(db,`SELECT s.id,s.client_id,c.name,s.role,s.created_at,s.last_seen_at,s.expires_at,s.ip_hint,s.device FROM zen_sessions s LEFT JOIN zen_clients c ON c.id=s.client_id WHERE s.expires_at>now() AND (s.role='admin' OR (c.active AND c.expires_at>now())) ORDER BY s.last_seen_at DESC LIMIT 200`);
      return json(rows.map(camel));
    }
    match=path.match(/^\/api\/admin\/sessions\/([^/]+)$/);
    if(match&&method==='DELETE'){
      const id=idCheck(match[1]);await db.transaction(async c=>{const rows=await query(c,'DELETE FROM zen_sessions WHERE id=$1 RETURNING client_id',[id]);if(rows.length)await audit(c,ctx,'مشاري',rows[0].client_id,'session_revoked');});return json({ok:true});
    }
    if(path==='/api/admin/password'&&method==='POST'){
      await limit('password:'+s.id,5,600);const b=await body(req);
      const [a]=await query(db,'SELECT password_hash FROM zen_admin WHERE id=1');if(!await verifyPassword(b.currentPassword,a.password_hash))throw new ApiError(422,'كلمة المرور الحالية غير صحيحة.');
      const hashed=await passwordHash(b.newPassword);
      await db.transaction(async c=>{await c.query('UPDATE zen_admin SET password_hash=$1,updated_at=now() WHERE id=1',[hashed]);await c.query("DELETE FROM zen_sessions WHERE role='admin'",[]);await audit(c,ctx,'مشاري',null,'password_changed');});
      return json({ok:true},200,{'Set-Cookie':cookie('',0)});
    }
    if(path==='/api/admin/scripts'&&method==='POST'){
      const b=await body(req),v=parseScript(b,true),id=randomUUID();
      return db.transaction(async c=>{await c.query('INSERT INTO zen_scripts(id,title,category,version,description,requirements,installation,usage,changelog,published,file_name,file_size,sha256,file_data,access_tier,price_halalas) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',[id,v.title,v.category,v.version,v.description,v.requirements,v.installation,v.usage,v.changelog,v.published,v.fileName,v.file.length,v.sha256,v.file,v.accessTier,v.priceHalalas]);await audit(c,ctx,'مشاري',null,'script_created',v.title);return json(camel((await query(c,`SELECT ${scriptColumns} FROM zen_scripts WHERE id=$1`,[id]))[0]),201);});
    }
    match=path.match(/^\/api\/admin\/scripts\/([^/]+)$/);
    if(match&&method==='PUT'){
      const id=idCheck(match[1]),b=await body(req),v=parseScript(b,false);version(b.revision);
      return db.transaction(async c=>{
        const rows=await query(c,`UPDATE zen_scripts SET title=$1,category=$2,version=$3,description=$4,requirements=$5,installation=$6,usage=$7,changelog=$8,published=$9,updated_at=now(),revision=revision+1,file_name=COALESCE($10,file_name),file_size=COALESCE($11,file_size),sha256=COALESCE($12,sha256),file_data=COALESCE($13,file_data),access_tier=$16,price_halalas=$17 WHERE id=$14 AND revision=$15 RETURNING ${scriptColumns}`,[v.title,v.category,v.version,v.description,v.requirements,v.installation,v.usage,v.changelog,v.published,v.fileName??null,v.file?.length??null,v.sha256??null,v.file??null,id,b.revision,v.accessTier,v.priceHalalas]);
        if(!rows.length)throw new ApiError(409,'تغير السكربت. حدّث القائمة قبل الحفظ.');await audit(c,ctx,'مشاري',null,'script_updated',v.title);return json(camel(rows[0]));
      });
    }
    if(match&&method==='DELETE'){
      const id=idCheck(match[1]),b=await body(req);version(b.revision);
      return db.transaction(async c=>{const rows=await query(c,'DELETE FROM zen_scripts WHERE id=$1 AND revision=$2 RETURNING title',[id,b.revision]);if(!rows.length)throw new ApiError(409,'تغير السكربت. حدّث القائمة.');await audit(c,ctx,'مشاري',null,'script_deleted',rows[0].title);return json({ok:true});});
    }
    throw new ApiError(404,'الصفحة غير موجودة.');
  }
  return async (req,context={})=>{
    let response;
    try {
      if(new URL(req.url).protocol!=='https:'&&env.ZEN_LOCAL_DEV!=='1')throw new ApiError(400,'الاتصال الآمن HTTPS مطلوب.');
      const ip=String(context.ip||'unknown').slice(0,100);
      response=await route(req,{ip,ipHint:ipHint(ip),device:deviceHint(req.headers.get('user-agent')??'')});
    } catch(e) {
      if(e.code==='23505')response=json({error:'رمز الدخول مستخدم لعميل آخر. اختر رمزًا مختلفًا.'},409);
      else if(e instanceof ApiError)response=json({error:e.message},e.status);
      else {logger.error('ZEN_API_ERROR',{code:e.code??'unknown',name:e.name});response=json({error:'تعذّر الوصول إلى الخدمة. تحقّق من إعداد قاعدة البيانات أو حاول لاحقًا.'},503);}
    }
    response.headers.set('Cache-Control','no-store');response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('X-Frame-Options','DENY');
    if(response.status===429)response.headers.set('Retry-After','600');
    return response;
  };
}
