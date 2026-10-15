import {describe,it,expect} from 'vitest';
import {manchaSchema,localizedWorkSchema,networkSectionSchema,contractorMeasurementSchema,validateProjectLinks} from './management-catalog';
const pid='00000000-0000-4000-8000-000000000001';
const wid='00000000-0000-4000-8000-000000000002';
const base={workId:wid,projectId:pid,system:'WATER',kind:'BOOSTER',title:'Booster',units:1,powerCv:4,capacityM3:null,budgetStatus:'NOT_BUDGETED',estimatedBrl:null,approvedBrl:null,contractualItemCode:null};
describe('Phase 2 registration validation',()=>{
  it('accepts a project with stain ID and explicit system',()=>{
    expect(manchaSchema.parse({projectId:pid,stainId:'553_AF_292',municipality:'Porangaba',segment:'WATER',referenceNote:null}).stainId).toBe('553_AF_292');
  });
  it('accepts a localized structure without assigned budget',()=>{
    expect(localizedWorkSchema.parse(base).approvedBrl).toBeNull();
  });
  it('prevents marking a not-budgeted structure as budgeted by adding money',()=>{
    expect(localizedWorkSchema.safeParse({...base,estimatedBrl:500}).success).toBe(false);
  });
  it('allows null network length without treating it as zero',()=>{
    expect(networkSectionSchema.parse({sectionId:wid,projectId:pid,system:'WATER',designation:'Trecho 1',material:'PEAD',diameterMm:63,stage:'APPROVED',lengthM:null}).lengthM).toBeNull();
  });
  it('rejects contractor measurement exceeding validated length',()=>{
    expect(contractorMeasurementSchema.safeParse({measurementId:wid,projectId:pid,system:'WATER',contractor:'Estática',referenceMonth:'2026-10',validatedM:100,measuredM:120,rateBrlPerKm:10000,paidBrl:null}).success).toBe(false);
  });
  it('detects mismatch between works and project system',()=>{
    const m=manchaSchema.parse({projectId:pid,stainId:'AF-01',municipality:'Quadra',segment:'WATER',referenceNote:null});
    const w=localizedWorkSchema.parse({...base,system:'SEWER'});
    expect(validateProjectLinks([m],[],[w],[])).toContain(`${wid}: sistema diverge do cadastro da mancha`);
  });
});
