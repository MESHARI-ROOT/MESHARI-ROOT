import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {isIP} from 'node:net';
const csp="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
export function httpServer({app,origin,directory='dist',trustRailway=false}){
 const base=new URL(origin);if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw new Error('PUBLIC_ORIGIN must be an origin');
 const root=resolve(directory);
 return createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), hid=(self)');res.setHeader('Content-Security-Policy',csp);
  try{
   // Prefix with a fixed deployment origin; never let Host rewrite the CSRF origin.
   const url=new URL(base.origin+(req.url||'/'));
   if(url.pathname.startsWith('/api/')){
    let body;let length=0;if(!['GET','HEAD'].includes(req.method)){const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>3*1024*1024){res.writeHead(413,{'Cache-Control':'no-store'});res.end();return;}chunks.push(chunk);}body=Buffer.concat(chunks);}
    const request=new Request(url,{method:req.method,headers:req.headers,...(body?{body}:{} )});
    const real=String(req.headers['x-real-ip']||'');const ip=trustRailway&&isIP(real)?real:req.socket.remoteAddress;
    const response=await app(request,{ip});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
   const pathname=decodeURIComponent(url.pathname);if(pathname.includes('\0')||pathname.includes('\\')||pathname.split('/').some(p=>p.startsWith('.'))){res.writeHead(404);res.end();return;}
   const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
   if(!file.startsWith(root+sep)){res.writeHead(404);res.end();return;}
   const info=await stat(file);if(!info.isFile())throw Object.assign(new Error(),{code:'ENOENT'});
   res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Content-Length':info.size});res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch(error){if(res.headersSent){res.destroy();return;}res.writeHead(error.code==='ENOENT'||error instanceof URIError?404:500,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end('تعذّر تنفيذ الطلب.');}
 });
}
