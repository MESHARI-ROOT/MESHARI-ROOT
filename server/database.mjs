import { getDatabase } from '@netlify/database';
export function fromPool(pool) {
  return {
    query: (sql, params=[]) => pool.query(sql, params),
    async transaction(fn) {
      const c = await pool.connect();
      try { await c.query('BEGIN'); const value = await fn(c); await c.query('COMMIT'); return value; }
      catch (e) { await c.query('ROLLBACK'); throw e; }
      finally { c.release(); }
    }
  };
}
export function productionDatabase() { return fromPool(getDatabase().pool); }
