import {createApp} from './app.mjs';
import {postgresDatabase} from './postgres.mjs';
import {migrate} from './migrate.mjs';
import {httpServer} from './http.mjs';
const origin=process.env.PUBLIC_ORIGIN||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:'');
if(!origin||(!origin.startsWith('https://')&&process.env.ZEN_LOCAL_DEV!=='1'))throw new Error('Set PUBLIC_ORIGIN to the HTTPS site origin');
const db=postgresDatabase();
try{await migrate(db);}catch(error){console.error('DATABASE_MIGRATION_FAILED',{code:error.code||'configuration'});await db.close();process.exit(1);}
const server=httpServer({app:createApp({db}),origin,trustRailway:!!process.env.RAILWAY_ENVIRONMENT_ID});
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('ZEN server ready'));
const cleanup=setInterval(()=>db.transaction(async c=>{await c.query('DELETE FROM zen_sessions WHERE expires_at<now()');await c.query('DELETE FROM zen_limits WHERE resets_at<now()');await c.query("DELETE FROM zen_audit WHERE created_at<now()-interval '90 days'");}).catch(()=>console.error('CLEANUP_FAILED')),3600000);cleanup.unref();
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{clearInterval(cleanup);const deadline=setTimeout(()=>process.exit(1),10000);deadline.unref();server.close(async()=>{await db.close();process.exit(0);});});
