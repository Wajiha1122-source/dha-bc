import 'dotenv/config';
import {pool} from '../server/db';
try {
 const result=await pool.query("SELECT (SELECT count(*)::int FROM bc.users WHERE role='Administrator' AND active) administrators,(SELECT count(*)::int FROM bc.applications) applications,(SELECT count(*)::int FROM bc.processes WHERE enabled) enabled_processes");
 console.log(JSON.stringify(result.rows[0]));
 for(const url of ['http://localhost:5173','http://127.0.0.1:3001/api/health']){
  try{const response=await fetch(url,{signal:AbortSignal.timeout(20000)});console.log(url+': HTTP '+response.status)}catch{console.log(url+': unavailable')}
 }
}catch{console.error('Database status unavailable.');process.exitCode=1}finally{await pool.end()}
