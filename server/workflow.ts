export const roles = ['Administrator','Receiving Staff','Dealing Staff','Approving Officer','Counter Staff','Supervisor','Auditor'] as const;
export const permissions = ['view','view_all','register','scrutinize','process','approve','prepare','handover','report','audit','admin'] as const;
export type Permission = typeof permissions[number];
export const defaults: Record<string,string[]> = {
 Administrator:[...permissions], 'Receiving Staff':['view','register'], 'Dealing Staff':['view','scrutinize','process','prepare'],
 'Approving Officer':['view','approve'], 'Counter Staff':['view','handover'], Supervisor:['view','view_all','report','audit'], Auditor:['view','view_all','report','audit']
};
export type Stage = {id:string;label:string};
export type Transition = {from:string;to:string;permission:string;requiresDocuments?:boolean;requiresReason?:boolean;requiresFinal?:boolean};
export type Requirement = {id:string;label:string;mandatory:boolean;condition:'always'|'owner_absent'};
export type ProcessConfig = {stages:Stage[];transitions:Transition[];requirements:Requirement[];targetDays:number;referencePrefix:string;fields:{id:string;label:string;required:boolean}[];outputs:string[];counterRequirements:string[]};
export const initialConfig:ProcessConfig = {
 stages:[['received','Application Received'],['scrutiny','Document Scrutiny'],['returned','Returned for Correction'],['processing','Under Processing'],['approval','Pending Approval'],['approved','Approved'],['rejected','Rejected'],['preparation','Final Document Preparation'],['ready','Ready for Counter'],['completed','Handed Over / Completed']].map(([id,label])=>({id,label})),
 transitions:[
  {from:'received',to:'scrutiny',permission:'scrutinize'}, {from:'scrutiny',to:'returned',permission:'scrutinize',requiresReason:true},
  {from:'returned',to:'scrutiny',permission:'register'}, {from:'scrutiny',to:'processing',permission:'process',requiresDocuments:true},
  {from:'processing',to:'approval',permission:'process',requiresDocuments:true}, {from:'approval',to:'approved',permission:'approve',requiresDocuments:true},
  {from:'approval',to:'returned',permission:'approve',requiresReason:true},{from:'approval',to:'rejected',permission:'approve',requiresReason:true},
  {from:'approved',to:'preparation',permission:'prepare'}, {from:'preparation',to:'ready',permission:'prepare',requiresDocuments:true,requiresFinal:true}
 ],
 requirements:[['application','Application Form'],['cnic','Copy of CNIC'],['allotment','Copy of Allotment / Allocation Letter'],['authority_copy','Copy of Authority Letter'],['challan','Copy of Paid Challan'],['authority_absent','Authority Letter (if the owner is not available)']].map(([id,label])=>({id,label,mandatory:true,condition:id==='authority_absent'?'owner_absent':'always'})),
 targetDays:10,referencePrefix:'BC',fields:[],outputs:['Site Plan / Possession Letter'],counterRequirements:['Identity and authorization verified','Delivered and retained copies recorded','Scanned signed acknowledgement attached']
};
export function missingRequirements(config:ProcessConfig, ownerAvailable:boolean, decisions:Record<string,string>) {
 return config.requirements.filter(r=>r.mandatory&&(r.condition==='always'||!ownerAvailable)&&decisions[r.id]!=='Verified');
}
export function validateTransition(config:ProcessConfig, from:string,to:string,perms:string[],ownerAvailable:boolean,decisions:Record<string,string>,reason:string,hasFinal:boolean) {
 const transition=config.transitions.find(t=>t.from===from&&t.to===to);
 if (!transition||!perms.includes(transition.permission)) throw new Error('This workflow action is not permitted.');
 if(transition.requiresReason&&!reason.trim()) throw new Error('A reason is required.');
 if(transition.requiresDocuments&&missingRequirements(config,ownerAvailable,decisions).length) throw new Error('Verify all mandatory documents before forwarding this application.');
 if(transition.requiresFinal&&!hasFinal) throw new Error('Upload the final document before marking ready for counter.');
 return transition;
}
export function assertHandover(status:string,hasFinal:boolean,hasAcknowledgement:boolean) {
 if(status!=='ready') throw new Error('Only applications ready for counter can be handed over.');
 if(!hasFinal||!hasAcknowledgement) throw new Error('A final document and scanned signed acknowledgement are required.');
}
