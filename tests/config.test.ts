import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runtimeConfig} from '../server/config';
const base={DATABASE_URL:'postgresql://example.invalid/test',SESSION_SECRET:'s'.repeat(64)};
test('Vercel production uses stable production origin and proxy cookies',()=>{const c=runtimeConfig({...base,VERCEL:'1',VERCEL_ENV:'production',VERCEL_URL:'build.vercel.app',VERCEL_PROJECT_PRODUCTION_URL:'office.vercel.app',APP_ORIGIN:'http://localhost:5173'});assert.equal(c.production,true);assert.equal(c.origin,'https://office.vercel.app');assert.equal(c.trustProxy,true)});
test('Vercel preview uses its own origin',()=>{const c=runtimeConfig({...base,VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'preview.vercel.app',VERCEL_PROJECT_PRODUCTION_URL:'office.vercel.app'});assert.equal(c.origin,'https://preview.vercel.app')});
test('Render overrides copied local settings that caused the port-scan timeout',()=>{
 const c=runtimeConfig({...base,RENDER:'true',NODE_ENV:'development',HOST:'127.0.0.1',PORT:'3001',APP_ORIGIN:'http://localhost:5173',TRUST_PROXY:'0',RENDER_EXTERNAL_URL:'https://dha-example.onrender.com'});
 assert.equal(c.host,'0.0.0.0');assert.equal(c.production,true);assert.equal(c.origin,'https://dha-example.onrender.com');assert.equal(c.trustProxy,true);assert.equal(c.port,3001);
});
test('Render without explicit NODE_ENV or PORT uses production and default public port',()=>{
 const c=runtimeConfig({...base,RENDER:'true',RENDER_EXTERNAL_URL:'https://dha-example.onrender.com'});
 assert.equal(c.production,true);assert.equal(c.host,'0.0.0.0');assert.equal(c.port,10000);
});
test('local development keeps loopback and localhost defaults',()=>{const c=runtimeConfig(base);assert.equal(c.host,'127.0.0.1');assert.equal(c.origin,'http://localhost:5173');assert.equal(c.trustProxy,false)});
test('Render accepts generated 256-bit secret and public port',()=>{const c=runtimeConfig({...base,SESSION_SECRET:'a'.repeat(43)+'=',NODE_ENV:'production',RENDER:'true',RENDER_EXTERNAL_URL:'https://dha-example.onrender.com',PORT:'10000'});assert.equal(c.host,'0.0.0.0');assert.equal(c.port,10000);assert.equal(c.origin,'https://dha-example.onrender.com');assert.equal(c.trustProxy,true)});
test('custom domain overrides Render origin and normalizes trailing slash',()=>{const c=runtimeConfig({...base,NODE_ENV:'production',RENDER_EXTERNAL_URL:'https://example.onrender.com',APP_ORIGIN:'https://office.example.com/'});assert.equal(c.origin,'https://office.example.com')});
test('missing database produces actionable error without exposing secrets',()=>{assert.throws(()=>runtimeConfig({...base,DATABASE_URL:''}),/Missing DATABASE_URL/)});
test('missing and placeholder session secrets fail closed',()=>{for(const secret of ['', 'short', 'REPLACE_WITH_AT_LEAST_48_RANDOM_CHARACTERS'])assert.throws(()=>runtimeConfig({...base,SESSION_SECRET:secret}),/SESSION_SECRET/)});
test('production requires HTTPS origin and rejects URL paths',()=>{assert.throws(()=>runtimeConfig({...base,NODE_ENV:'production'}),/APP_ORIGIN/);assert.throws(()=>runtimeConfig({...base,NODE_ENV:'production',APP_ORIGIN:'http://example.com'}),/HTTPS/);assert.throws(()=>runtimeConfig({...base,APP_ORIGIN:'https://example.com/path'}),/origin/)});
