import {cp,mkdir,rm,readdir} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
const files=await readdir('dist');
if(!files.includes('index.html'))throw new Error('Missing entry point');
console.log('Built public UI in dist/. Deploy the project with Functions and Database for working authentication.');
