# Cloudflare deployment

This deployment uses Workers static assets and one SQLite Durable Object. It does not require R2, D1, an external database, or a paid plan. Free service quotas still apply; this is not a promise of unlimited hosting or a lifetime custom domain.

Run `npm ci`, `npm run test:cloudflare`, and `npm run test:cloudflare:runtime`. Authenticate using the official Wrangler CLI and deploy with `npm run deploy:cloudflare`.

Configure ADMIN_USER, ADMIN_PASSWORD_HASH and AUTH_PEPPER as Worker secrets. Preserve the original AUTH_PEPPER to keep existing customer codes valid. Never commit secrets, private backups or paid script files. Maximum uploaded script size on this deployment is 1,800,000 bytes.

The build initializes only the 15 published free scripts. Paid scripts and existing customers require a private data migration; deploying the build alone does not migrate production data.

## Private migration

Back up the source first and pause production writes. Run `npm run export:cloudflare` with SOURCE_DATABASE_URL, the original AUTH_PEPPER, and MIGRATION_OUTPUT_PATH pointing outside this repository. The exporter preserves customers, permission assignments, script bytes and hashes, administrator credentials and audit entries. Sessions are intentionally excluded.

Deploy the destination with ZEN_MIGRATION_MODE=1. Sign in to the destination as administrator, then POST the private JSON backup to `/api/admin/migration/import` from the same origin, with the session cookie and X-Zen-Request: 1. This authenticated endpoint is available only during maintenance mode, checks all file hashes and record counts, and imports once in a transaction. Never publish the backup as a static asset.

Remove ZEN_MIGRATION_MODE after successful import. Sign in again and verify the original lifetime code, free and paid script counts, permissions, and paid download SHA-256 before announcing the new site. Keep the source backup until verification is complete. If source database access is unavailable, do not claim the migration is complete.

The logo is static with no hand movement. Stars, satellites and the skippable arrival animation remain enabled, respecting reduced-motion preferences.
