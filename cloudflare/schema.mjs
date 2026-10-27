const now="(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";
export const schema=`
CREATE TABLE IF NOT EXISTS zen_admin(id INTEGER PRIMARY KEY CHECK(id=1),username TEXT NOT NULL,password_hash TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT ${now});
CREATE TABLE IF NOT EXISTS zen_clients(id TEXT PRIMARY KEY,name TEXT NOT NULL,code_hash TEXT NOT NULL UNIQUE,code_hint TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,all_scripts INTEGER NOT NULL DEFAULT 0,expires_at TEXT,max_sessions INTEGER NOT NULL DEFAULT 1 CHECK(max_sessions BETWEEN 1 AND 5),notes TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT ${now},last_login_at TEXT,login_count INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS zen_scripts(id TEXT PRIMARY KEY,title TEXT NOT NULL,category TEXT NOT NULL,version TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',requirements TEXT NOT NULL DEFAULT '',installation TEXT NOT NULL DEFAULT '',usage TEXT NOT NULL DEFAULT '',changelog TEXT NOT NULL DEFAULT '',published INTEGER NOT NULL DEFAULT 0,file_name TEXT NOT NULL,file_size INTEGER NOT NULL CHECK(file_size BETWEEN 1 AND 1800000),sha256 TEXT NOT NULL,file_data BLOB NOT NULL,created_at TEXT NOT NULL DEFAULT ${now},updated_at TEXT NOT NULL DEFAULT ${now},revision INTEGER NOT NULL DEFAULT 1,access_tier TEXT NOT NULL DEFAULT 'paid' CHECK(access_tier IN ('free','paid')),price_halalas INTEGER NOT NULL DEFAULT 0 CHECK(price_halalas BETWEEN 0 AND 100000000),CHECK(access_tier<>'free' OR price_halalas=0));
CREATE TABLE IF NOT EXISTS zen_permissions(client_id TEXT REFERENCES zen_clients(id) ON DELETE CASCADE,script_id TEXT REFERENCES zen_scripts(id) ON DELETE CASCADE,PRIMARY KEY(client_id,script_id));
CREATE TABLE IF NOT EXISTS zen_sessions(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,role TEXT NOT NULL CHECK(role IN ('admin','client')),client_id TEXT REFERENCES zen_clients(id) ON DELETE CASCADE,created_at TEXT NOT NULL DEFAULT ${now},expires_at TEXT NOT NULL,last_seen_at TEXT NOT NULL DEFAULT ${now},ip_hint TEXT NOT NULL,device TEXT NOT NULL,CHECK((role='client' AND client_id IS NOT NULL) OR (role='admin' AND client_id IS NULL)));
CREATE TABLE IF NOT EXISTS zen_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,client_id TEXT,action TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '',ip_hint TEXT NOT NULL,device TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT ${now});
CREATE TABLE IF NOT EXISTS zen_limits(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,resets_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS zen_sessions_client ON zen_sessions(client_id);
CREATE INDEX IF NOT EXISTS zen_sessions_expiry ON zen_sessions(expires_at);
CREATE INDEX IF NOT EXISTS zen_audit_date ON zen_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS zen_audit_client ON zen_audit(client_id,created_at DESC);
CREATE INDEX IF NOT EXISTS zen_scripts_catalog ON zen_scripts(published,access_tier,updated_at DESC);
`;
