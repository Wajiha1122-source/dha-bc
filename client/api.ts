export type User={id:string;username:string;name:string;role:string;must_change_password:boolean;permissions:string[];notifications:boolean};
let csrf='';
async function readResponse(response:Response){
 const text=await response.text();
 let body:any;
 try{body=JSON.parse(text);}catch{throw new Error(response.status>=500?'The server is temporarily unavailable. Please try again shortly.':'The server returned an unexpected response. Please refresh and try again.');}
 if(!response.ok)throw new Error(body.error||'The request could not be completed.');
 return body;
}
export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{
 if(options.body instanceof FormData){const status=await fetch('/api/status').then(readResponse);const file=options.body.get('file');if(file instanceof File&&file.size>status.maxUploadBytes)throw new Error(`Maximum file size is ${status.maxUploadBytes/1024/1024} MB on this server.`);}
 const response=await fetch('/api'+path,{...options,headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),'X-CSRF-Token':csrf,...options.headers}});
 const body=await readResponse(response);
 if(body.csrf)csrf=body.csrf;
 return body;
}
export const write=(path:string,data:unknown,method='POST')=>api(path,{method,body:JSON.stringify(data)});
