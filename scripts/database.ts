import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs/promises';
import {initialConfig,defaults} from '../server/workflow';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL before running database commands.');
const pool = new pg.Pool({connectionString:url, connectionTimeoutMillis:15000});
try {
 if (process.argv[2] === 'inspect') {
  const result = await pool.query("SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema,table_name,ordinal_position");
  console.log(JSON.stringify(result.rows,null,2));
 } else if (process.argv[2] === 'migrate') {
  const client = await pool.connect();
  try {await client.query('BEGIN'); await client.query('SELECT pg_advisory_xact_lock(810182026)'); await client.query(await fs.readFile(new URL('../database/001_initial.sql',import.meta.url),'utf8')); await client.query(await fs.readFile(new URL('../database/002_document_contents.sql',import.meta.url),'utf8')); for(const [name,perms] of Object.entries(defaults)) await client.query('INSERT INTO bc.roles(name,permissions) VALUES($1,$2) ON CONFLICT DO NOTHING',[name,JSON.stringify(perms)]); await client.query('INSERT INTO bc.processes(name,enabled,config) VALUES($1,true,$2) ON CONFLICT DO NOTHING',['Site Plan / Possession Letter',initialConfig]); await client.query('COMMIT'); console.log('Building Control migration complete.');} catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();}
 } else throw new Error('Use inspect or migrate.');
} catch(e) {console.error('Database operation failed:',(e as {code?:string}).code||'CONNECTION_OR_QUERY_ERROR');process.exitCode=1;} finally {await pool.end();}
