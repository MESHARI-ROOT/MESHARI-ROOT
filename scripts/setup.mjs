import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {writeFile,access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {passwordHash} from '../server/security.mjs';
try{await access('.env');console.error('.env already exists. Keep AUTH_PEPPER unchanged; do not replace an existing production configuration.');process.exit(1);}catch{}
if(!process.stdin.isTTY){console.error('Run npm run setup in an interactive terminal.');process.exit(1);}
let muted=false;const output=new Writable({write(chunk,encoding,callback){if(!muted)process.stdout.write(chunk);callback();}});
const rl=createInterface({input:process.stdin,output,terminal:true});
try{
  const username=(await rl.question('Admin username [meshari]: ')).trim()||'meshari';
  if(!/^[a-zA-Z0-9_.-]{3,60}$/.test(username))throw new Error('Username: 3-60 letters, numbers, dots, underscores or hyphens.');
  process.stdout.write('Admin password (12-128 characters, hidden): ');muted=true;const password=await rl.question('');muted=false;process.stdout.write('\n');
  process.stdout.write('Confirm password (hidden): ');muted=true;const confirm=await rl.question('');muted=false;process.stdout.write('\n');
  if(password!==confirm)throw new Error('Passwords do not match.');
  const hash=await passwordHash(password);await writeFile('.env',`ADMIN_USER=${username}\nADMIN_PASSWORD_HASH='${hash}'\nAUTH_PEPPER=${randomBytes(48).toString('hex')}\n`,{flag:'wx',mode:0o600});
  console.log('Created private .env. Import it into your linked Netlify project with: npx netlify env:import .env');
  console.log('Keep this file private and backed up. Never upload it in a public folder.');
}catch(error){console.error(error.message);process.exitCode=1;}finally{rl.close();}
