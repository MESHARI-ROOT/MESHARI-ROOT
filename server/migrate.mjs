import {readFile,readdir} from 'node:fs/promises';
const directory=new URL('../netlify/database/migrations/',import.meta.url);
export async function migrations(){return (await readdir(directory)).filter(x=>/^\d+.*\.sql$/.test(x)).sort();}
export async function migrate(db){
 await db.transaction(async client=>{
  await client.query('SELECT pg_advisory_xact_lock(637184023)');
  const existing=await client.query("SELECT to_regclass('public.zen_clients') AS app,to_regclass('public.zen_schema_migrations') AS history");
  if(existing.rows[0].app&&!existing.rows[0].history)throw new Error('Existing database needs verified migration history; use the transfer tool before starting');
  await client.query('CREATE TABLE IF NOT EXISTS zen_schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
  const applied=new Set((await client.query('SELECT name FROM zen_schema_migrations')).rows.map(x=>x.name));
  for(const name of await migrations())if(!applied.has(name)){await client.query(await readFile(new URL(name,directory),'utf8'));await client.query('INSERT INTO zen_schema_migrations(name) VALUES($1)',[name]);}
 });
}
