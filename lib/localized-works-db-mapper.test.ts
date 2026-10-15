import {describe,it,expect} from 'vitest';
import {attackPlan2026} from './attack-plan-2026';
import {prepareLocalizedWorkForDatabase} from './localized-works-db-mapper';
const uuidA='11111111-1111-4111-8111-111111111111';
const uuidB='22222222-2222-4222-8222-222222222222';
const water=attackPlan2026.find(r=>r.segment==='WATER')!;
const input={
 name:'Booster de teste',rowKey:water.rowKey,kind:'BOOSTER' as const,quantity:1,
 capacityM3:null,powerCv:null,flowLps:0.4,hmtMca:28,material:null,
 hydraulic:'NOT_STARTED' as const,electrical:null,structural:null,
 budget:'NOT_BUDGETED' as const,contractualCode:null,notes:null,referenceDate:'2026-10-14',
};
const link={contractId:uuidA,engineeringProjectId:uuidB,projectContractId:uuidA,
 projectMunicipality:water.municipality,projectSegment:water.segment,projectActive:true};
describe('camada DB sem escrita',()=>{
 it('cria payload vinculado ao projeto',()=>{const r=prepareLocalizedWorkForDatabase(input,link);expect(r.parent.engineering_project_id).toBe(uuidB);expect(r.update.flow_lps).toBe(0.4);});
 it('bloqueia contrato divergente',()=>expect(()=>prepareLocalizedWorkForDatabase(input,{...link,projectContractId:uuidB})).toThrow('Contrato'));
 it('bloqueia cidade divergente',()=>expect(()=>prepareLocalizedWorkForDatabase(input,{...link,projectMunicipality:'Conchas'})).toThrow('Município'));
 it('bloqueia sistema divergente',()=>expect(()=>prepareLocalizedWorkForDatabase(input,{...link,projectSegment:water.segment==='WATER'?'SEWER':'WATER'})).toThrow('Sistema'));
 it('bloqueia projeto inativo',()=>expect(()=>prepareLocalizedWorkForDatabase(input,{...link,projectActive:false})).toThrow('inativo'));
});
