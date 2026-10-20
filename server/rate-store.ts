import type {Options, Store} from 'express-rate-limit';
import {pool} from './db.js';

// Shared counters keep login limits effective across serverless instances.
export class DatabaseRateStore implements Store {
  windowMs=60000;
  constructor(public prefix:string) {}
  init(options:Options){this.windowMs=options.windowMs;}
  async increment(key:string){
    const {rows}=await pool.query(`INSERT INTO bc.rate_limits(key,hits,expires_at)
      VALUES($1,1,clock_timestamp()+$2*interval '1 millisecond')
      ON CONFLICT(key) DO UPDATE SET
      hits=CASE WHEN bc.rate_limits.expires_at<=clock_timestamp() THEN 1 ELSE bc.rate_limits.hits+1 END,
      expires_at=CASE WHEN bc.rate_limits.expires_at<=clock_timestamp() THEN clock_timestamp()+$2*interval '1 millisecond' ELSE bc.rate_limits.expires_at END
      RETURNING hits,expires_at`,[this.prefix+key,this.windowMs]);
    return {totalHits:rows[0].hits,resetTime:new Date(rows[0].expires_at)};
  }
  async decrement(key:string){await pool.query('UPDATE bc.rate_limits SET hits=greatest(0,hits-1) WHERE key=$1',[this.prefix+key]);}
  async resetKey(key:string){await pool.query('DELETE FROM bc.rate_limits WHERE key=$1',[this.prefix+key]);}
}
