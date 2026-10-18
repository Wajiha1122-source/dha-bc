import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';

const source = new URL('../.env', import.meta.url);
const destination = new URL('../.env.render', import.meta.url);
const local = parse(await fs.readFile(source, 'utf8'));
if (!local.DATABASE_URL) throw new Error('Local DATABASE_URL is missing.');
// Preserve a previously generated deployment secret, so repeat runs do not
// invalidate hosted sessions. Never print secrets into command output.
let existing = {};
try { existing = parse(await fs.readFile(destination, 'utf8')); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const settings = {
  DATABASE_URL: local.DATABASE_URL,
  SESSION_SECRET: existing.SESSION_SECRET || randomBytes(48).toString('base64url'),
  NODE_ENV: 'production',
  HOST: '0.0.0.0',
  TRUST_PROXY: '1',
  STORAGE_DIR: '/var/data/building-control',
};
await fs.writeFile(destination, Object.entries(settings).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
console.log('Created private .env.render for importing into Render Environment settings. It is excluded from Git.');
