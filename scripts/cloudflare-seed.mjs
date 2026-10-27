import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {sha256} from '../server/security.mjs';
const db=new PGlite();try{
 for(const name of (await readdir('netlify/database/migrations')).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile('netlify/database/migrations/'+name,'utf8'));
 const rows=(await db.query("SELECT * FROM zen_scripts WHERE published=true AND access_tier='free' ORDER BY id")).rows.map(row=>{const bytes=Buffer.from(row.file_data);if(bytes.length>1800000||sha256(bytes)!==row.sha256)throw new Error('INVALID_FREE_SEED');return {...row,file_data:{base64:bytes.toString('base64')}};});
 await mkdir('dist/__bootstrap',{recursive:true});await writeFile('dist/__bootstrap/free-seed.json',JSON.stringify({rows}));console.log('Cloudflare public seed prepared:',rows.length,'files');
}finally{await db.close();}
