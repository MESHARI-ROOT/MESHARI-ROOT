import {Buffer} from 'node:buffer';
import {sha256} from '../server/security.mjs';
const tables=['zen_admin','zen_clients','zen_scripts','zen_permissions','zen_audit'];
export function decodeRow(row){const result={};for(const [key,value] of Object.entries(row))result[key]=key==='file_data'?Buffer.from(value.base64,'base64'):typeof value==='boolean'?Number(value):value;return result;}
export function verifyFiles(rows){for(const row of rows){const bytes=Buffer.from(row.file_data);if(bytes.length!==row.file_size||bytes.length>1800000||sha256(bytes)!==row.sha256)throw new Error('FILE_INTEGRITY_FAILED');}}
function insert(sql,table,row){const keys=Object.keys(row),allowed=new Set(sql.exec('PRAGMA table_info('+table+')').toArray().map(x=>x.name));if(keys.some(key=>!allowed.has(key)))throw new Error('UNKNOWN_COLUMN');sql.exec('INSERT INTO '+table+' ('+keys.map(x=>'"'+x+'"').join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')',...Object.values(row));}
export async function seedDatabase(storage,bundle){
 const rows=bundle.rows.map(decodeRow);verifyFiles(rows);if(rows.some(x=>x.access_tier!=='free'||!x.published))throw new Error('NONPUBLIC_SEED_REJECTED');
 await storage.transaction(async()=>{for(const row of rows)insert(storage.sql,'zen_scripts',row);await storage.put('seed-version',1);});
}
export async function importDatabase(storage,bundle,pepper){
 if(bundle.format!=='meshari-cloudflare-v1'||bundle.pepperFingerprint!==sha256(pepper))throw new Error('PEPPER_MISMATCH');
 if(await storage.get('migration-complete'))throw new Error('ALREADY_IMPORTED');
 if(storage.sql.exec('SELECT count(*) AS total FROM zen_clients').toArray()[0].total||storage.sql.exec("SELECT count(*) AS total FROM zen_scripts WHERE access_tier='paid'").toArray()[0].total)throw new Error('TARGET_NOT_EMPTY');
 for(const table of tables)if(!Array.isArray(bundle.tables?.[table])||bundle.tables[table].length!==bundle.counts?.[table])throw new Error('BAD_COUNTS');
 if(bundle.tables.zen_admin.length!==1||bundle.tables.zen_admin[0].id!==1)throw new Error('ADMIN_REQUIRED');
 const decoded=Object.fromEntries(tables.map(table=>[table,bundle.tables[table].map(decodeRow)]));verifyFiles(decoded.zen_scripts);
 return storage.transaction(async()=>{
  for(const table of ['zen_sessions','zen_limits','zen_permissions','zen_audit','zen_scripts','zen_clients','zen_admin'])storage.sql.exec('DELETE FROM '+table);
  for(const table of tables){for(const row of decoded[table])insert(storage.sql,table,row);const count=storage.sql.exec('SELECT count(*) AS total FROM '+table).toArray()[0].total;if(count!==bundle.counts[table])throw new Error('COUNT_MISMATCH');}
  verifyFiles(storage.sql.exec('SELECT file_data,file_size,sha256 FROM zen_scripts').toArray());await storage.put('migration-complete',true);return bundle.counts;
 });
}
