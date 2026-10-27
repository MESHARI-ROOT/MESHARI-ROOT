import {readFile} from 'node:fs/promises';
import {createHash,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {postgresDatabase} from '../server/postgres.mjs';
import {migrations} from '../server/migrate.mjs';
const tables=['zen_admin','zen_clients','zen_scripts','zen_permissions','zen_audit'];
export async function transferDatabase(source,target){
 return source.transaction(async src=>{
  await src.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  return target.transaction(async dst=>{
   await dst.query('SELECT pg_advisory_xact_lock(637184023)');
   const existing=await dst.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'zen_%'");
   if(existing.rows.length)throw new Error('TARGET_NOT_EMPTY');
   const names=await migrations();
   for(const name of names)await dst.query(await readFile(new URL('../netlify/database/migrations/'+name,import.meta.url),'utf8'));
   // These rows were just seeded in this transaction, never existing customer data.
   await dst.query('DELETE FROM zen_scripts');
   const counts={};
   for(const table of tables){
    const {rows}=await src.query('SELECT * FROM '+table);counts[table]=rows.length;
    for(const row of rows){
     if(table==='zen_scripts'){const data=Buffer.from(row.file_data);if(createHash('sha256').update(data).digest('hex')!==row.sha256||data.length!==row.file_size)throw new Error('SOURCE_FILE_INTEGRITY_FAILED');row.file_data=data;}
     const columns=Object.keys(row);if(columns.some(x=>!/^\w+$/.test(x)))throw new Error('INVALID_COLUMN');
     await dst.query(`INSERT INTO ${table} (${columns.map(x=>'"'+x+'"').join(',')}) VALUES (${columns.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));
    }
    const result=await dst.query('SELECT count(*)::int AS count FROM '+table);if(result.rows[0].count!==rows.length)throw new Error('COUNT_MISMATCH');
   }
   // Verify bytes again in the destination, including private paid files.
   for(const row of (await dst.query('SELECT sha256,file_size,file_data FROM zen_scripts')).rows){const data=Buffer.from(row.file_data);if(data.length!==row.file_size||createHash('sha256').update(data).digest('hex')!==row.sha256)throw new Error('TARGET_FILE_INTEGRITY_FAILED');}
   await dst.query("SELECT setval(pg_get_serial_sequence('zen_audit','id'),COALESCE((SELECT max(id) FROM zen_audit),1),EXISTS(SELECT 1 FROM zen_audit))");
   await dst.query('CREATE TABLE zen_schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
   for(const name of names)await dst.query('INSERT INTO zen_schema_migrations(name) VALUES($1)',[name]);
   // No sessions or temporary rate-limit entries move; users sign in again.
   return counts;
  });
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const oldPepper=process.env.SOURCE_AUTH_PEPPER||'',newPepper=process.env.AUTH_PEPPER||'';
 const a=Buffer.from(oldPepper),b=Buffer.from(newPepper);
 if(a.length<32||a.length!==b.length||!timingSafeEqual(a,b))throw new Error('Use the same original AUTH_PEPPER on both services to preserve customer codes');
 if(!process.env.SOURCE_DATABASE_URL||!process.env.DATABASE_URL||process.env.SOURCE_DATABASE_URL===process.env.DATABASE_URL)throw new Error('Distinct source and empty destination databases are required');
 const source=postgresDatabase(process.env.SOURCE_DATABASE_URL),target=postgresDatabase(process.env.DATABASE_URL);
 try{console.log('Verified transfer complete',await transferDatabase(source,target));}catch(error){console.error('TRANSFER_FAILED',{code:error.code||'validation'});process.exitCode=1;}finally{await source.close();await target.close();}
}
