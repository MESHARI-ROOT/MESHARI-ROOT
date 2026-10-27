import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--test','--test-concurrency=1','tests/integration.test.mjs','tests/cloudflare-storage.test.mjs'],{stdio:'inherit',env:{...process.env,ZEN_TEST_SQLITE:'1'}});process.exit(result.status??1);
