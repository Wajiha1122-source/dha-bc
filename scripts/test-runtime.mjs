import {execFileSync,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
// Exercise emitted JavaScript with Node, without tsx's extension resolution.
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.api.json','--noEmit','false','--outDir','.runtime-check'],{stdio:'inherit'});
const source=`
 const {default:app}=await import('./.runtime-check/api/index.js');
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 try {
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/status');
  const status=await response.json();
  if(response.status!==200||status.application!=='dha-building-control'||status.maxUploadBytes!==4194304)throw new Error('Invalid status response');
  console.log('Compiled Vercel API imports and serves status successfully.');
 } finally {await new Promise(resolve=>server.close(resolve));}
`;
const result=spawnSync(process.execPath,['--input-type=module','-e',source],{stdio:'inherit',timeout:30000,env:{...process.env,NODE_ENV:'production',VERCEL:'1',VERCEL_ENV:'production',VERCEL_URL:'test.vercel.app',VERCEL_PROJECT_PRODUCTION_URL:'test.vercel.app',APP_ORIGIN:'https://test.vercel.app',DATABASE_URL:'postgresql://invalid:invalid@127.0.0.1:1/invalid',SESSION_SECRET:'runtime-test-only-'.repeat(4)}});
assert.equal(result.status,0,'Compiled serverless entry point must run in plain Node');
