import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import {localizedPayload, type LocalizedFormRecord} from './localized-works-model';
const mocks=vi.hoisted(()=>({client:vi.fn()}));
vi.mock('./supabase/client',()=>({createClient:mocks.client}));
const form:LocalizedFormRecord={id:'',name:'Booster',city:'Porangaba',stain:'553_AR_0002N',kind:'BOOSTER',units:'1',capacity:'',material:'',power:'',flow:'0.4',hmt:'28',hydraulic:'NOT_STARTED',electrical:'NOT_STARTED',structural:'NOT_STARTED',budget:'NOT_BUDGETED',contractualCode:'',notes:'',planRowKey:'attack-2026-09',referenceDate:'2026-10-14'};
const payload=localizedPayload(form);
function mockDb(role='ADMIN',active=true){
 const query={select:vi.fn(),eq:vi.fn(),order:vi.fn(),range:vi.fn(),maybeSingle:vi.fn()};
 query.select.mockReturnValue(query);query.eq.mockReturnValue(query);query.order.mockReturnValue(query);
 query.range.mockResolvedValue({data:[],error:null});query.maybeSingle.mockResolvedValue({data:{role,active},error:null});
 const db={auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:'user-id'}},error:null})},from:vi.fn().mockReturnValue(query),rpc:vi.fn().mockResolvedValue({data:'30000000-0000-4000-8000-000000000001',error:null})};
 mocks.client.mockReturnValue(db);return {db,query};
}
beforeEach(()=>{vi.resetModules();vi.stubEnv('NEXT_PUBLIC_SBON17B_LOCALIZED_WORKS_ENABLED','true');mocks.client.mockReset();});
afterEach(()=>vi.unstubAllEnvs());
describe('localized Supabase integration',()=>{
 it('blocks every remote call when the environment is not released',async()=>{
  vi.stubEnv('NEXT_PUBLIC_SBON17B_LOCALIZED_WORKS_ENABLED','false');const service=await import('./localized-works-remote');
  await expect(service.saveNewLocalizedWork(payload.work,payload.update)).rejects.toThrow('liberação');
  await expect(service.listLocalizedWorksForContract('contract')).rejects.toThrow('liberação');
  await expect(service.listLocalizedWorkHistory('work')).rejects.toThrow('liberação');
  expect(mocks.client).not.toHaveBeenCalled();
 });
 for(const role of ['ADMIN','EDITOR'])it(`${role} submits an atomic creation RPC`,async()=>{
  const {db}=mockDb(role);const service=await import('./localized-works-remote');
  await service.saveNewLocalizedWork(payload.work,payload.update);
  expect(db.rpc).toHaveBeenCalledWith('create_sbon17b_localized_work',{p_work:payload.work,p_update:payload.update});
 });
 for(const role of ['GESTOR','DIRETORIA'])it(`${role} cannot create or append`,async()=>{
  const {db}=mockDb(role);const service=await import('./localized-works-remote');
  await expect(service.saveNewLocalizedWork(payload.work,payload.update)).rejects.toThrow('permissão');
  await expect(service.saveLocalizedWorkUpdate('work',payload.update)).rejects.toThrow('permissão');expect(db.rpc).not.toHaveBeenCalled();
 });
 it('rejects inactive profiles and expired sessions',async()=>{
  const {db}=mockDb('ADMIN',false);const service=await import('./localized-works-remote');
  await expect(service.saveNewLocalizedWork(payload.work,payload.update)).rejects.toThrow('permissão');
  db.auth.getUser.mockResolvedValue({data:{user:null},error:null});
  await expect(service.saveLocalizedWorkUpdate('work',payload.update)).rejects.toThrow('Entre novamente');expect(db.rpc).not.toHaveBeenCalled();
 });
 it('appends using the canonical UUID without updating a parent or history row',async()=>{
  const {db}=mockDb('EDITOR');const service=await import('./localized-works-remote');
  await service.saveLocalizedWorkUpdate('real-work-uuid',payload.update);
  expect(db.rpc).toHaveBeenCalledWith('add_sbon17b_localized_work_update',{p_work_id:'real-work-uuid',p_update:payload.update});
  expect(db.from).toHaveBeenCalledTimes(1);expect(db.from).toHaveBeenCalledWith('profiles');
 });
 it('paginates canonical rows beyond the Supabase 500-row query size',async()=>{
  const {query,db}=mockDb();const service=await import('./localized-works-remote');
  query.range.mockResolvedValueOnce({data:Array.from({length:500},(_,id)=>({id:String(id)})),error:null}).mockResolvedValueOnce({data:[{id:'last'}],error:null});
  const rows=await service.loadLocalizedWorks(db as unknown as Parameters<typeof service.loadLocalizedWorks>[0],'contract-id');
  expect(rows).toHaveLength(501);expect(query.eq).toHaveBeenCalledWith('contract_id','contract-id');
  expect(query.range.mock.calls).toEqual([[0,499],[500,999]]);
 });
 it('loads history in stable date/time/UUID order and exposes further pages',async()=>{
  const {query}=mockDb('GESTOR');const service=await import('./localized-works-remote');
  query.range.mockResolvedValueOnce({data:Array.from({length:21},(_,id)=>({id:String(id)})),error:null});
  const page=await service.listLocalizedWorkHistory('work',20);
  expect(page.rows).toHaveLength(20);expect(page.hasMore).toBe(true);expect(query.range).toHaveBeenCalledWith(20,40);
  expect(query.order.mock.calls).toEqual([['reference_date',{ascending:false}],['created_at',{ascending:false}],['id',{ascending:false}]]);
 });
 it('rejects invalid offsets and propagates read failures instead of showing an empty registry',async()=>{
  const {query}=mockDb();const service=await import('./localized-works-remote');
  await expect(service.listLocalizedWorkHistory('work',-1)).rejects.toThrow('Página');
  query.range.mockResolvedValue({data:null,error:{message:'network'}});
  await expect(service.listLocalizedWorksForContract('contract')).rejects.toThrow('network');
 });
 it('propagates RPC failures without a success result',async()=>{
  const {db}=mockDb();const service=await import('./localized-works-remote');db.rpc.mockResolvedValue({data:null,error:{message:'constraint'}});
  await expect(service.saveNewLocalizedWork(payload.work,payload.update)).rejects.toThrow('constraint');
 });
});
