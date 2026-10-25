CREATE TABLE IF NOT EXISTS zen_admin (
 id integer PRIMARY KEY CHECK(id=1), username text NOT NULL,
 password_hash text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS zen_clients (
 id uuid PRIMARY KEY, name varchar(150) NOT NULL,
 code_hash text UNIQUE NOT NULL, code_hint varchar(3) NOT NULL,
 active boolean NOT NULL DEFAULT true, all_scripts boolean NOT NULL DEFAULT false,
 expires_at timestamptz NOT NULL, max_sessions integer NOT NULL DEFAULT 1 CHECK(max_sessions BETWEEN 1 AND 5),
 notes varchar(2000) NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
 last_login_at timestamptz, login_count integer NOT NULL DEFAULT 0, revision integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS zen_scripts (
 id uuid PRIMARY KEY, title varchar(150) NOT NULL, category varchar(80) NOT NULL,
 version varchar(40) NOT NULL, description text NOT NULL DEFAULT '', requirements text NOT NULL DEFAULT '',
 installation text NOT NULL DEFAULT '', usage text NOT NULL DEFAULT '', changelog text NOT NULL DEFAULT '',
 published boolean NOT NULL DEFAULT false, file_name varchar(180) NOT NULL, file_size integer NOT NULL,
 sha256 varchar(64) NOT NULL, file_data bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), revision integer NOT NULL DEFAULT 1,
 CHECK(file_size BETWEEN 1 AND 2097152)
);
CREATE TABLE IF NOT EXISTS zen_permissions (
 client_id uuid REFERENCES zen_clients ON DELETE CASCADE,
 script_id uuid REFERENCES zen_scripts ON DELETE CASCADE, PRIMARY KEY(client_id,script_id)
);
CREATE TABLE IF NOT EXISTS zen_sessions (
 id uuid PRIMARY KEY, token_hash text NOT NULL UNIQUE, role varchar(10) NOT NULL CHECK(role IN ('admin','client')),
 client_id uuid REFERENCES zen_clients ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 last_seen_at timestamptz NOT NULL DEFAULT now(), ip_hint varchar(80) NOT NULL, device varchar(180) NOT NULL,
 CHECK ((role='client' AND client_id IS NOT NULL) OR (role='admin' AND client_id IS NULL))
);
CREATE INDEX IF NOT EXISTS zen_sessions_client ON zen_sessions(client_id);
CREATE INDEX IF NOT EXISTS zen_sessions_expiry ON zen_sessions(expires_at);
CREATE TABLE IF NOT EXISTS zen_audit (
 id bigserial PRIMARY KEY, actor varchar(150) NOT NULL, client_id uuid,
 action varchar(60) NOT NULL, detail varchar(400) NOT NULL DEFAULT '',
 ip_hint varchar(80) NOT NULL, device varchar(180) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zen_audit_date ON zen_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS zen_audit_client ON zen_audit(client_id,created_at DESC);
CREATE TABLE IF NOT EXISTS zen_limits (
 key text PRIMARY KEY, attempts integer NOT NULL, resets_at timestamptz NOT NULL
);
