import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import {timingSafeEqual} from 'node:crypto';
import path from 'node:path';
import {ZodError} from 'zod';
import multer from 'multer';
import {pool,fail,HttpError} from './db';
import {auth} from './auth';
import {applications} from './applications';
import {documents,maxUploadBytes} from './documents';
import {administration} from './administration';
import {reports} from './reports';
import {runtimeConfig} from './config';
const config=runtimeConfig(process.env);
const {secret,origin,production}=config;
export const app=express();app.disable('x-powered-by');if(config.trustProxy)app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'","data:"],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],upgradeInsecureRequests:production?[]:null}}}));
app.use('/api',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next()});
app.get('/api/status',(_req,res)=>res.json({application:'dha-building-control',ok:true,maxUploadBytes}));
app.use(express.json({limit:'128kb'}));
const PgStore=connectPg(session);app.use(session({name:'bc.sid',secret,resave:false,saveUninitialized:false,rolling:true,store:new PgStore({pool,schemaName:'bc',tableName:'session',createTableIfMissing:false,pruneSessionInterval:process.env.VERCEL==='1'?false:900}),cookie:{httpOnly:true,secure:production,sameSite:'strict',maxAge:30*60*1000}}));
app.use('/api',rateLimit({windowMs:60*1000,limit:300,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many requests. Please pause and try again.'}}));
app.use('/api',(req,_res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)){if(req.get('origin')!==origin)fail(403,'Request origin is not permitted.');const token=req.get('X-CSRF-Token')||'';const expected=req.session.csrf||'';if(!token||token.length!==expected.length||!timingSafeEqual(Buffer.from(token),Buffer.from(expected)))fail(403,'Your session token has expired. Refresh and try again.')}if(req.session.userId&&(!req.session.createdAt||Date.now()-req.session.createdAt>8*60*60*1000)){req.session.destroy(()=>{});fail(401,'Your session has expired. Please sign in again.')}next()});
app.get('/api/health',async(_req,res)=>{await pool.query('SELECT 1 FROM bc.processes LIMIT 1');res.json({ok:true})});
app.use('/api/auth',auth);
app.use('/api',async(req,_res,next)=>{if(!req.session.userId)fail(401,'Authentication required.');const {rows}=await pool.query('SELECT u.*,r.permissions FROM bc.users u JOIN bc.roles r ON r.name=u.role WHERE u.id=$1 AND u.active',[req.session.userId]);if(!rows[0])fail(401,'Authentication required.');req.user=rows[0];if(req.user.must_change_password)fail(403,'Change your temporary password before accessing records.');next()});
app.use('/api/applications',applications);app.use('/api',documents,administration,reports);
app.use('/api',(_req,res)=>res.status(404).json({error:'API endpoint not found.'}));
if(production && process.env.VERCEL!=='1'){app.use(express.static(path.resolve('dist'),{index:false}));app.get('/{*splat}',(_req,res)=>res.sendFile(path.resolve('dist/index.html')))}
app.use((error:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{if(res.headersSent)return;if(error instanceof ZodError)return res.status(400).json({error:error.issues.map(i=>(i.path.join('.')?i.path.join('.')+': ':'')+i.message).join(' ')});if(error instanceof HttpError)return res.status(error.status).json({error:error.message});if(error instanceof multer.MulterError)return res.status(400).json({error:error.code==='LIMIT_FILE_SIZE'?`The file exceeds the ${maxUploadBytes/1024/1024} MB limit.`:'Invalid upload. Choose one supported file.'});if(error.code==='23505')return res.status(409).json({error:'This record already exists. Refresh before trying again.'});if(error.type==='entity.parse.failed')return res.status(400).json({error:'Invalid JSON request.'});console.error('Request failed:',error.code||error.name||'UnknownError');res.status(500).json({error:'The operation could not be completed. Contact your administrator if this continues.'})});
if(process.env.NODE_ENV!=='test' && process.env.VERCEL!=='1'){
 const server=app.listen(config.port,config.host,()=>console.log(`Building Control listening on ${config.host}:${config.port}`));
 process.on('SIGTERM',()=>server.close(()=>{void pool.end()}));
}
