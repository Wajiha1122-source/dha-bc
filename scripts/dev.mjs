import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const apiPort = Number(process.env.PORT || 3001);
let frontend;
let backend;
let stopping = false;

async function request(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return { ok: response.ok, text: await response.text() };
  } catch { return null; }
}

async function occupied(port) {
  const results = await Promise.all(['127.0.0.1', '::1'].map(host => new Promise(resolve => {
    const socket = createConnection({ host, port });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(1000, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  })));
  return results.some(Boolean);
}

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  if (frontend) await frontend.close();
  if (backend && backend.exitCode === null) backend.kill();
  process.exitCode = code;
}

process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());

try {
  const page = await request('http://localhost:5173/');
  const existingFrontend = page?.ok && page.text.includes('DHA Multan');
  if (!existingFrontend && await occupied(5173)) {
    throw new Error('Port 5173 is occupied, but it is not serving this application at localhost. Close the old frontend terminal (Ctrl+C), then run start.cmd again. No unrelated process was stopped.');
  }

  const status = await request(`http://127.0.0.1:${apiPort}/api/status`);
  let existingBackend = status?.ok && status.text.includes('dha-building-control');
  if (!existingBackend && await occupied(apiPort)) {
    // Recognize versions started before the database-independent status route existed.
    const legacy = await request(`http://127.0.0.1:${apiPort}/api/health`);
    existingBackend = legacy?.ok && legacy.text.includes('"ok":true');
    if (!existingBackend) throw new Error(`Port ${apiPort} is occupied by an unresponsive or unrelated API. Close its old terminal (Ctrl+C), then run start.cmd again.`);
  }

  if (!existingBackend) {
    console.log('Starting the Building Control API...');
    backend = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { stdio: 'inherit', env: process.env });
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (backend.exitCode !== null) throw new Error('The API exited during startup. Check the error above.');
      const result = await request(`http://127.0.0.1:${apiPort}/api/status`);
      if (result?.ok && result.text.includes('dha-building-control')) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error('The API did not become ready. Check .env and the API output above.');
    backend.once('exit', code => {
      if (!stopping) { console.error(`The API stopped (exit ${code}). Stopping this launcher’s frontend.`); void stop(1); }
    });
  } else console.log('Reusing the running Building Control API.');

  if (!existingFrontend) {
    console.log('Starting the localhost frontend...');
    frontend = await createServer({ server: { host: 'localhost', port: 5173, strictPort: true } });
    await frontend.listen();
  } else console.log('Reusing the running Building Control frontend.');

  const verified = await request('http://localhost:5173/');
  const proxy = await request('http://localhost:5173/api/status');
  let proxyReady = proxy?.ok && proxy.text.includes('dha-building-control');
  if (!proxyReady && existingBackend) {
    const legacyProxy = await request('http://localhost:5173/api/health');
    proxyReady = legacyProxy?.ok && legacyProxy.text.includes('"ok":true');
  }
  if (!verified?.ok || !verified.text.includes('DHA Multan') || !proxyReady) {
    throw new Error('The frontend/API connection could not be verified. Check the output above.');
  }
  console.log('\nReady: http://localhost:5173');
  if (frontend || backend) console.log('Keep this CMD window open. Press Ctrl+C to stop the services started here.');
  else console.log('Already running. Keep the original application terminal open.');
} catch (error) {
  console.error('\n' + error.message);
  await stop(1);
}
