import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
async function walk(dir){for(const f of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+f.name;if(f.isDirectory())await walk(path);else if(/\.(mjs|js)$/.test(path)){const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(r.status)throw new Error(r.stderr);}}}
for(const dir of ['public','server','cloudflare','netlify/functions','scripts','tests'])await walk(dir);
const html=await readFile('public/index.html','utf8');if(/<script(?![^>]*src=)/.test(html))throw new Error('Unexpected inline script');
console.log('JavaScript syntax and external-script entry checks passed.');
