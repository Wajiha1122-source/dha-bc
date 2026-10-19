import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pool} from '../server/db';
const root=path.resolve(process.env.STORAGE_DIR||'private-storage');
try{
 const {rows}=await pool.query('SELECT d.id,d.storage_key,d.size FROM bc.documents d LEFT JOIN bc.document_contents c ON c.document_id=d.id WHERE c.document_id IS NULL');
 let copied=0,missing=0,oversized=0;
 for(const doc of rows){
  if(!/^[a-f0-9-]+\.(pdf|jpg|png|webp)$/.test(doc.storage_key))throw new Error('Invalid storage key');
  let content:Buffer;
  try{content=await fs.readFile(path.join(root,doc.storage_key));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT'){missing++;continue;}throw e;}
  if(content.length!==doc.size)throw new Error('Document size mismatch');
  await pool.query('INSERT INTO bc.document_contents(document_id,content) VALUES($1,$2) ON CONFLICT DO NOTHING',[doc.id,content]);
  copied++;if(content.length>4*1024*1024)oversized++;
 }
 console.log({copied,missing,oversized});
 if(missing||oversized){console.error('Some existing documents require attention before Vercel cutover.');process.exitCode=1;}
}finally{await pool.end();}
