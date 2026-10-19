import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import pg from 'pg';
import argon2 from 'argon2';
import {initialConfig,defaults} from '../server/workflow';

test('PostgreSQL HTTP integration: authentication, roles, documents, workflow, reports and handover',{skip:!process.env.TEST_DATABASE_URL,timeout:600000},async()=>{
 const schema='bc_test_'+randomBytes(8).toString('hex');
 const real=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,connectionTimeoutMillis:20000});
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'bc-integration-'));
 process.env.NODE_ENV='test';process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;process.env.SESSION_SECRET=randomBytes(48).toString('hex');process.env.APP_ORIGIN='http://localhost:5173';process.env.STORAGE_DIR=directory;
 const {pool}=await import('../server/db');
 const rewrite=(q:any)=>typeof q==='string'?q.replace(/\bbc\b/g,schema):{...q,text:q.text.replace(/\bbc\b/g,schema)};
 (pool as any).query=(q:any,...args:any[])=>(real.query as any)(rewrite(q),...args);
 (pool as any).connect=async()=>{const client=await real.connect();if(!(client as any).bcWrapped){const query=client.query.bind(client);(client as any).query=(q:any,...args:any[])=>(query as any)(rewrite(q),...args);(client as any).bcWrapped=true}return client};
 let server:any;
 try{
 await real.query((await fs.readFile(new URL('../database/001_initial.sql',import.meta.url),'utf8')).replace(/\bbc\b/g,schema));
 await pool.query(await fs.readFile(new URL('../database/002_document_contents.sql',import.meta.url),'utf8'));
 const {DatabaseRateStore}=await import('../server/rate-store');
 const limiter=new DatabaseRateStore('integration:');
 const increments=await Promise.all(Array.from({length:6},()=>limiter.increment('ip')));
 assert.deepEqual(increments.map(x=>x.totalHits).sort((a,b)=>a-b),[1,2,3,4,5,6]);
 await pool.query("UPDATE bc.rate_limits SET expires_at=now()-interval '1 minute'");
 assert.equal((await limiter.increment('ip')).totalHits,1);
 for(const [name,perms] of Object.entries(defaults))await pool.query('INSERT INTO bc.roles(name,permissions) VALUES($1,$2)',[name,JSON.stringify(perms)]);
 const processResult=await pool.query('INSERT INTO bc.processes(name,enabled,config) VALUES($1,true,$2) RETURNING id',['Site Plan / Possession Letter',initialConfig]);
 const temporary='A1!'+randomBytes(24).toString('hex');const permanent='B2!'+randomBytes(24).toString('hex');
 const admin=await pool.query("INSERT INTO bc.users(username,name,role,password_hash) VALUES('integration.admin','Integration Administrator','Administrator',$1) RETURNING id",[await argon2.hash(temporary)]);
 const {app}=await import('../server/index');server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const client=()=>{let cookie='';let csrf='';return async(route:string,method='GET',body?:any,expected=200,token=true)=>{const response=await fetch(base+'/api'+route,{method,headers:{Origin:'http://localhost:5173',...(cookie?{Cookie:cookie}:{}),...(token?{'X-CSRF-Token':csrf}:{}),...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];const json=await response.json();assert.equal(response.status,expected,method+' '+route+': '+JSON.stringify(json));if(json.csrf)csrf=json.csrf;return json}};
 const request=client();await request('/auth/me');await request('/applications','GET',undefined,401);await request('/auth/login','POST',{username:'integration.admin',password:'wrong'},401);await request('/auth/login','POST',{username:'integration.admin',password:temporary});await request('/applications','GET',undefined,403);await request('/auth/password','POST',{current:temporary,password:permanent});
 await request('/profile','PATCH',{notifications:false},403,false);
 const application={process_id:processResult.rows[0].id,client_name:'Integration client',contact:'03001234567',plot_number:'TEST-42',sector:'A',phase:'1',submitted_on:new Date().toISOString().slice(0,10),owner_available:true,assigned_to:admin.rows[0].id,remarks:'Disposable test schema only',extra:{}};
 await request('/applications','POST',{...application,owner_available:false},400);
 const created=await request('/applications','POST',application,201);const prefix='/applications/'+created.id;
 assert.match(created.reference,/^BC-\d{4}-\d+$/);
 await request(prefix+'/transition','POST',{to:'scrutiny',reason:''});await request(prefix+'/transition','POST',{to:'processing',reason:''},409);
 const upload=async(kind:string,requirement?:string,invalid=false)=>{const form=new FormData();form.set('kind',kind);if(requirement)form.set('requirement_id',requirement);form.set('file',new Blob([invalid?'not a pdf':'%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'],{type:'application/pdf'}),'document.pdf');return request(prefix+'/documents','POST',form,invalid?400:201)};
 await upload('requirement','application',true);
 for(const r of initialConfig.requirements.slice(0,5)){await upload('requirement',r.id);await request(prefix+'/scrutiny','POST',{requirement_id:r.id,status:'Verified',remarks:'Checked against submission'})}
 await upload('requirement','challan');await request(prefix+'/transition','POST',{to:'processing',reason:''},409);await request(prefix+'/scrutiny','POST',{requirement_id:'challan',status:'Verified',remarks:'Revised version verified'});
 await request(prefix+'/transition','POST',{to:'processing',reason:''});await request(prefix+'/transition','POST',{to:'approval',reason:''});
 const receiverPassword='R3!'+randomBytes(24).toString('hex');await request('/users','POST',{username:'integration.receiver',name:'Receiving User',role:'Receiving Staff',password:receiverPassword},201);
 const receiver=client();await receiver('/auth/me');await receiver('/auth/login','POST',{username:'integration.receiver',password:receiverPassword});await receiver('/auth/password','POST',{current:receiverPassword,password:'S4!'+randomBytes(24).toString('hex')});await receiver(prefix,'GET',undefined,404);await receiver('/users','GET',undefined,403);
 await request(prefix+'/transition','POST',{to:'approved',reason:''});await request(prefix+'/handover','POST',{recipient_name:'A'},400);await request(prefix+'/transition','POST',{to:'ready',reason:''},409);await request(prefix+'/transition','POST',{to:'preparation',reason:''});await request(prefix+'/transition','POST',{to:'ready',reason:''},409);await upload('final');await request(prefix+'/transition','POST',{to:'ready',reason:''});await upload('acknowledgement');
 const detail=await request(prefix);assert.equal(detail.documents.filter((d:any)=>d.requirement_id==='challan').length,2);assert.equal(detail.decisions.find((d:any)=>d.requirement_id==='challan').status,'Verified');
 if(process.env.DOCUMENT_STORAGE==='database'){
  const saved=await pool.query('SELECT content FROM bc.document_contents');
  assert.equal(saved.rowCount,detail.documents.length);
  assert.ok(saved.rows.every(row=>row.content.toString().startsWith('%PDF-1.4')));
  assert.deepEqual(await fs.readdir(directory),[]);
 }
 const handover={recipient_name:'Verified Recipient',verification:'Identity and authority checked by counter staff',delivered_copy:'Original site plan',retained_copy:'Office copy',acknowledgement_id:detail.documents.find((d:any)=>d.kind==='acknowledgement').id,final_document_id:detail.documents.find((d:any)=>d.kind==='final').id};
 await request(prefix+'/handover','POST',handover);await request(prefix+'/handover','POST',handover,409);assert.equal((await request(prefix)).application.status,'completed');assert.equal((await request('/dashboard')).counts.completed,1);assert.equal((await request('/reports')).completed,1);assert.equal((await request('/applications?q=TEST-42')).total,1);assert.ok((await request('/audit')).items.length>10);
 await assert.rejects(pool.query('DELETE FROM bc.audit'),/append-only/);
 await request('/auth/logout','POST',{});await request('/applications','GET',undefined,401);
 }finally{if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();if(!/^bc_test_[a-f0-9]{16}$/.test(schema))throw new Error('Invalid disposable schema');await real.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await real.end();if(path.dirname(path.resolve(directory))!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('bc-integration-'))throw new Error('Invalid test storage directory');await fs.rm(directory,{recursive:true,force:true})}
});
