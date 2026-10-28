import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';

// Credentials belong in GitHub Actions secrets, never workflow source or logs.
const names = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'ADMIN_USER', 'ADMIN_PASSWORD_HASH', 'AUTH_PEPPER'];
const missing = names.filter(name => !process.env[name]?.trim());
if (missing.length) {
  console.error('Missing GitHub Actions secrets: ' + missing.join(', '));
  process.exit(1);
}
const dir = await mkdtemp(join(tmpdir(), 'meshari-worker-secrets-'));
try {
  const path = join(dir, 'secrets.json');
  const secrets = Object.fromEntries(names.slice(2).map(name => [name, process.env[name]]));
  await writeFile(path, JSON.stringify(secrets), {mode: 0o600});
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--secrets-file', path, '--var', 'ZEN_MIGRATION_MODE:1'], {stdio: 'inherit'});
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
  process.exitCode = code;
  if (!code) console.log('Destination deployed in migration mode. Import and verify existing private data before opening customer access.');
} finally {
  await rm(dir, {recursive: true, force: true});
}
