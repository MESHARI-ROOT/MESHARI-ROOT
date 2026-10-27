// The existing API keeps PostgreSQL on Netlify/Railway. This narrow dialect
// adapter is only used by the serialized Cloudflare SQLite Durable Object.
const clock="strftime('%Y-%m-%dT%H:%M:%fZ','now')";
export function translate(sql,args=[]){
 let text=sql.replace(/date_trunc\('day',now\(\) AT TIME ZONE 'Asia\/Riyadh'\) AT TIME ZONE 'Asia\/Riyadh'/g,"strftime('%Y-%m-%dT%H:%M:%fZ','now','+3 hours','start of day','-3 hours')");
 text=text.replace(/GREATEST\(expires_at,now\(\)\)\+\(\$(\d+)::int\*interval '1 day'\)/g,(_,n)=>`strftime('%Y-%m-%dT%H:%M:%fZ',max(expires_at,${clock}),printf('+%d days',$${n}))`);
 text=text.replace(/now\(\)\+\(\$(\d+)::int\*interval '1 second'\)/g,(_,n)=>`strftime('%Y-%m-%dT%H:%M:%fZ','now',printf('+%d seconds',$${n}))`);
 text=text.replace(/now\(\)([+-])interval '(\d+) (seconds?|minutes?|hours?|days?)'/g,(_,sign,n,unit)=>`strftime('%Y-%m-%dT%H:%M:%fZ','now','${sign}${n} ${unit}')`);
 text=text.replace(/=ANY\(\$(\d+)::uuid\[\]\)/g,(_,n)=>` IN (SELECT value FROM json_each($${n}))`);
 text=text.replace(/::(?:boolean|uuid|text|int)\b/g,'').replace(/\bFOR UPDATE\b/gi,'').replace(/\bILIKE\b/gi,'LIKE').replace(/now\(\)/g,clock);
 const bindings=[];text=text.replace(/\$(\d+)/g,(_,n)=>{const value=args[Number(n)-1];bindings.push(Array.isArray(value)?JSON.stringify(value):typeof value==='boolean'?Number(value):value instanceof Date?value.toISOString():value??null);return '?';});
 return {sql:text,bindings};
}
export function sqliteDatabase(storage){
 const db={async query(sql,args=[]){const q=translate(sql,args);try{const cursor=storage.sql.exec(q.sql,...q.bindings);const rows=cursor.toArray().map(row=>{if(row.id!==undefined){for(const key of ['active','all_scripts','published','online'])if(key in row)row[key]=!!row[key];}return row;});return {rows,rowCount:cursor.rowsWritten??rows.length};}catch(error){if(/UNIQUE constraint failed/i.test(error.message))error.code='23505';throw error;}},transaction:fn=>storage.transaction(()=>fn(db))};
 return db;
}
