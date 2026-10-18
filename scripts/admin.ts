import 'dotenv/config';
import {randomBytes} from 'node:crypto';
import argon2 from 'argon2';
import {createInterface} from 'node:readline/promises';
import fs from 'node:fs/promises';
import {pool,transaction,audit} from '../server/db';
const status=(state:string)=>fs.writeFile('.admin-setup-status.json',JSON.stringify({state,updatedAt:new Date().toISOString()}));
const username='admin.'+randomBytes(4).toString('hex');
const password='A9!'+randomBytes(24).toString('base64url');
try{await status('starting');if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error('INTERACTIVE_TERMINAL_REQUIRED');await transaction(async db=>{await db.query('SELECT pg_advisory_xact_lock(810182027)');const {rows}=await db.query("SELECT count(*)::int n FROM bc.users WHERE role='Administrator'");if(rows[0].n)throw new Error('An administrator already exists. Initial setup is disabled.');const result=await db.query("INSERT INTO bc.users(username,name,role,password_hash) VALUES($1,'System Administrator','Administrator',$2) RETURNING id",[username,await argon2.hash(password,{type:argon2.argon2id})]);await audit(db,result.rows[0].id,'Initial administrator created',null)});await status('account-created');
 process.stdout.write('\nInitial administrator created. Save these credentials in your approved password manager.\n\nUsername: '+username+'\nTemporary password: '+password+'\n\nChange the password at first sign-in.\n');const terminal=createInterface({input:process.stdin,output:process.stdout});await terminal.question('Press Enter after saving the credentials to clear this screen.');terminal.close();process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
}catch(e){const error=e as Error&{code?:string};const reason=error.message==='INTERACTIVE_TERMINAL_REQUIRED'?'INTERACTIVE_TERMINAL_REQUIRED':error.message==='An administrator already exists. Initial setup is disabled.'?'ADMINISTRATOR_ALREADY_EXISTS':error.code||'SETUP_FAILED';await status(reason);console.error('Administrator setup: '+reason+'. Run this command in an interactive local terminal and check database connectivity.');process.exitCode=1}finally{await pool.end()}
