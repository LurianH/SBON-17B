// Read-only verification using existing accounts. No create/update/delete RPCs or fixture data.
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const roles=['ADMIN','EDITOR','GESTOR','DIRETORIA'];
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert(url&&key,'Configure the project URL and public key locally; do not publish credentials.');
const endpoint=new URL(url);
assert(endpoint.protocol==='https:'&&endpoint.hostname==='urydcysiqhixxlvkjyyo.supabase.co','Unexpected Supabase project: stop and review the target.');
const reports=[];
for(const role of roles){
 const email=process.env[`SBON_TEST_${role}_EMAIL`],password=process.env[`SBON_TEST_${role}_PASSWORD`];
 assert(email&&password,`Missing local test-account settings for ${role}.`);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:session,error:loginError}=await db.auth.signInWithPassword({email,password});
 assert(!loginError&&session.user,`${role}: sign-in failed.`);
 try{
  const {data:profile,error:profileError}=await db.from('profiles').select('role,active').eq('id',session.user.id).single();
  assert(!profileError&&profile?.active&&profile.role===role,`${role}: profile not active or mismatched.`);
  const {data:contract,error:contractError}=await db.from('contracts').select('id').eq('code','SBON 17B').eq('active',true).single();
  assert(!contractError&&contract,`${role}: active contract unavailable.`);
  const {data:plan,error:planError}=await db.from('engineering_attack_plan_2026').select('row_key,stain_id').order('row_key');
  assert(!planError&&plan?.length===16,`${role}: canonical plan unavailable.`);
  assert(plan.filter(row=>row.stain_id==='271_AR_0001N').length===2,`${role}: duplicate fronts were lost.`);
  const {data:works,error:worksError}=await db.from('engineering_localized_work_current').select('id,current_update').eq('contract_id',contract.id).eq('active',true).limit(1);
  assert(!worksError&&works,`${role}: registry read failed.`);
  const {error:historyError}=await db.from('engineering_localized_work_updates').select('id').limit(1);
  assert(!historyError,`${role}: permanent history read failed.`);
  if(works.length)assert(works[0].current_update,`${role}: work lacks initial snapshot.`);
  reports.push({role,profile:'active',plan:'16 fronts',registry:'readable',history:'readable'});
 }finally{await db.auth.signOut({scope:'local'});}
}
const anon=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
for(const table of ['engineering_attack_plan_2026','engineering_localized_works','engineering_localized_work_updates','engineering_localized_work_current']){
 const {data,error}=await anon.from(table).select('*').limit(1);
 assert(error||!data?.length,`Anonymous access is unexpectedly allowed on ${table}.`);
}
console.log(JSON.stringify({project:endpoint.hostname,mode:'read-only',reports,anonymous:'denied',writePermissions:'tested in isolated PostgreSQL; inspect live RLS/grants separately'},null,2));
