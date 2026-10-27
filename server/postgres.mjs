import {Pool} from 'pg';
export function postgresDatabase(connectionString=process.env.DATABASE_URL){
 if(!connectionString)throw new Error('DATABASE_URL is required');
 const pool=new Pool({connectionString,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
 pool.on('error',()=>console.error('POSTGRES_POOL_ERROR'));
 return {query:(sql,args=[])=>pool.query(sql,args),async transaction(fn){const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}},close:()=>pool.end()};
}
