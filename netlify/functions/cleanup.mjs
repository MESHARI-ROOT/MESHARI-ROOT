import { productionDatabase } from '../../server/database.mjs';
export default async () => {
  const db=productionDatabase();
  await db.transaction(async c=>{
    await c.query('DELETE FROM zen_sessions WHERE expires_at<now()');
    await c.query('DELETE FROM zen_limits WHERE resets_at<now()');
    await c.query("DELETE FROM zen_audit WHERE created_at<now()-interval '90 days'");
  });
  return new Response(null,{status:204});
};
export const config={schedule:'0 3 * * *'};
