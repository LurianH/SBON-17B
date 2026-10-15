import {describe, expect, it} from 'vitest';
import {localizedPayload, localizedRecordFromDatabase, localizedDbUpdateSchema, type LocalizedFormRecord, type LocalizedWorkRow} from './localized-works-model';
import {parseLocalizedDraftWorks, readLocalizedDraft} from './localized-works-drafts';

const booster: LocalizedFormRecord = {id:'draft',name:'Alto da Serra',city:'Porangaba',stain:'553_AR_0002N',planRowKey:'attack-2026-09',kind:'BOOSTER',units:'1',capacity:'',material:'',power:'',flow:'0.4',hmt:'28',hydraulic:'IN_PROGRESS',electrical:'NOT_STARTED',structural:'NOT_STARTED',budget:'NOT_BUDGETED',contractualCode:'',notes:'',referenceDate:'2026-10-14'};
describe('localized works payloads and previous drafts', () => {
 it('keeps unknown values null and links the precise canonical front', () => {
  const result=localizedPayload(booster);
  expect(result.work).toMatchObject({plan_row_key:'attack-2026-09',engineering_project_id:null});
  expect(result.update).toMatchObject({flow_lps:0.4,head_mca:28,pump_power_cv:null,approved_budget_brl:null});
 });
 it('records reservoir capacity and material and rejects missing capacity', () => {
  expect(localizedPayload({...booster,kind:'RESERVOIR',capacity:'50',material:'PRFV'}).update).toMatchObject({capacity_m3:50,material:'PRFV'});
  expect(()=>localizedPayload({...booster,kind:'RESERVOIR'})).toThrow('capacidade');
 });
 it('computes EEE project status from hydraulic, electrical and structural statuses', () => {
  const eee={...booster,kind:'EEE' as const,stain:'553_AF_1850',planRowKey:'attack-2026-03',hydraulic:'APPROVED' as const,electrical:'COMPLETED' as const,structural:'IN_PROGRESS' as const};
  expect(localizedPayload(eee).update.project_status).toBe('IN_PROGRESS');
  expect(localizedPayload({...eee,structural:'COMPLETED'}).update.project_status).toBe('COMPLETED');
  expect(localizedPayload({...eee,electrical:'APPROVED',structural:'APPROVED'}).update.project_status).toBe('APPROVED');
 });
 it('preserves execution, approved budget and project UUID on a new snapshot', () => {
  const result=localizedPayload({...booster,physical:'COMPLETED',budget:'APPROVED',approvedBudget:'1250.55',engineeringProjectId:'20000000-0000-4000-8000-000000000001'});
  expect(result.update.physical_status).toBe('COMPLETED');expect(result.update.approved_budget_brl).toBe(1250.55);
  expect(result.work.engineering_project_id).toBe('20000000-0000-4000-8000-000000000001');
 });
 it('rejects mismatched fronts, invalid dates and nonfinite numbers', () => {
  expect(()=>localizedPayload({...booster,city:'Quadra'})).toThrow('divergente');
  expect(()=>localizedPayload({...booster,referenceDate:'2026-02-30'})).toThrow();
  expect(()=>localizedPayload({...booster,flow:'NaN'})).toThrow();
  expect(()=>localizedPayload({...booster,flow:'Infinity'})).toThrow();
 });
 it('cannot put an approved amount in an unapproved budget', () => expect(()=>localizedPayload({...booster,approvedBudget:'100'})).toThrow('Valor aprovado'));
 it('maps a canonical row without losing UUID, status, date or zero values', () => {
  const input: LocalizedWorkRow={id:'30000000-0000-4000-8000-000000000001',contract_id:'10000000-0000-4000-8000-000000000001',engineering_project_id:null,plan_row_key:'attack-2026-09',mancha_id:booster.stain,municipality:'Porangaba',segment_type:'WATER',kind:'BOOSTER',designation:booster.name,quantity:1,active:true,created_at:'2026-10-14T10:00:00Z',created_by:'author',current_update:{...localizedPayload(booster).update,id:'snapshot',localized_work_id:'work',created_by:'author',created_at:'2026-10-14T10:00:00Z',pump_power_cv:0}};
  expect(localizedRecordFromDatabase(input)).toMatchObject({id:input.id,referenceDate:'2026-10-14',power:'0',capacity:'',physical:'NOT_STARTED',hydraulic:'IN_PROGRESS'});
 });
 it('reads the previous v1 draft without reclassifying its UUID as a database identity', () => {
  const old={...booster,id:'30000000-0000-4000-8000-000000000001'};
  expect(readLocalizedDraft(JSON.stringify({version:1,works:[old]}),[])).toEqual([old]);
  expect(()=>parseLocalizedDraftWorks([old,old])).toThrow('duplicados');
 });
 it('rejects corrupt optional draft fields and leaves unknown stored formats intact', () => {
  expect(()=>parseLocalizedDraftWorks([{...booster,physical:'APPROVED'}])).toThrow();
  expect(()=>parseLocalizedDraftWorks([{...booster,engineeringProjectId:'mancha'}])).toThrow();
  expect(readLocalizedDraft('{"version":2,"works":[]}',[booster])).toEqual([booster]);
 });
 it('ignores client-supplied snapshot authors and timestamps', () => {
  const input={...localizedPayload(booster).update,created_by:'spoofed',created_at:'2000-01-01'};
  expect(localizedDbUpdateSchema.parse(input)).not.toHaveProperty('created_by');
  expect(localizedDbUpdateSchema.parse(input)).not.toHaveProperty('created_at');
 });
});
