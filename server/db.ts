import 'dotenv/config';
import pg from 'pg';
import type {Request} from 'express';
export const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:15000,max:10});
export type DB=Pick<pg.PoolClient,'query'>;
export async function transaction<T>(fn:(db:pg.PoolClient)=>Promise<T>):Promise<T>{const db=await pool.connect();try{await db.query('BEGIN');const result=await fn(db);await db.query('COMMIT');return result}catch(e){await db.query('ROLLBACK');throw e}finally{db.release()}}
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
export function fail(status:number,message:string):never{throw new HttpError(status,message)}
export async function audit(db:DB,actor:string|null,action:string,application:string|null,details:unknown={}){await db.query('INSERT INTO bc.audit(actor_id,action,application_id,details) VALUES($1,$2,$3,$4)',[actor,action,application,JSON.stringify(details)])}
export type Staff={id:string;username:string;name:string;role:string;permissions:string[];must_change_password:boolean;notifications:boolean;password_hash:string};
declare global{namespace Express{interface Request{user:Staff}}}
declare module 'express-session'{interface SessionData{userId:string;csrf:string;createdAt:number}}
export const permitted=(req:Request,p:string)=>req.user.permissions.includes(p);
export function requirePermission(req:Request,p:string){if(!permitted(req,p))fail(403,'You do not have permission for this action.')}
export function accessClause(req:Request,start=1,alias='a'):{sql:string;values:unknown[]}{if(permitted(req,'view_all'))return {sql:'TRUE',values:[]};const queues:string[]=[];if(permitted(req,'approve'))queues.push('approval');if(permitted(req,'handover'))queues.push('ready','completed');return {sql:`(${alias}.created_by=$${start} OR ${alias}.assigned_to=$${start} OR ${alias}.status=ANY($${start+1}::text[]))`,values:[req.user.id,queues]}}
export async function application(req:Request,db:DB=pool,lock=false){const scope=accessClause(req,2);const result=await db.query(`SELECT a.*,p.name process_name,u.name assignee_name FROM bc.applications a JOIN bc.processes p ON p.id=a.process_id LEFT JOIN bc.users u ON u.id=a.assigned_to WHERE a.id=$1 AND ${scope.sql}${lock?' FOR UPDATE OF a':''}`,[req.params.id,...scope.values]);if(!result.rows[0])fail(404,'Application not found or access is restricted.');return result.rows[0]}
export async function notify(db:DB,appId:string,message:string,roles:string[]=[],assigned?:string|null){await db.query(`INSERT INTO bc.notifications(user_id,application_id,message) SELECT id,$1,$2 FROM bc.users WHERE active AND notifications AND (role=ANY($3::text[]) OR id=$4) ON CONFLICT(user_id,application_id,message) DO NOTHING`,[appId,message,roles,assigned||null])}
