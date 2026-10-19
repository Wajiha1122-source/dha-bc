import 'dotenv/config';
import {spawnSync} from 'node:child_process';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const result=spawnSync(process.execPath,['--import','tsx','--test','tests/integration.test.ts'],{stdio:'inherit',env:{...process.env,TEST_DATABASE_URL:process.env.DATABASE_URL,DOCUMENT_STORAGE:'database'}});
process.exitCode=result.status??1;
