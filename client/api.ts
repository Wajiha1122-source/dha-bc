export type User={id:string;username:string;name:string;role:string;must_change_password:boolean;permissions:string[];notifications:boolean};
let csrf='';
export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{
 const response=await fetch('/api'+path,{...options,headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),'X-CSRF-Token':csrf,...options.headers}});
 const body=await response.json();
 if(!response.ok)throw new Error(body.error||'The request could not be completed.');
 if(body.csrf)csrf=body.csrf;
 return body;
}
export const write=(path:string,data:unknown,method='POST')=>api(path,{method,body:JSON.stringify(data)});
