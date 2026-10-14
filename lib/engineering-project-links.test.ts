import {describe,it,expect} from 'vitest';
import {attackPlan2026} from './attack-plan-2026';
import {resolveEngineeringProjectLinks,linkSummary,type EngineeringProjectIdentity} from './engineering-project-links';
const contract='contract-1';
const item=(row:number,id:string,name?:string):EngineeringProjectIdentity=>{const p=attackPlan2026[row];return {id,contract_id:contract,municipality:p.municipality,segment_type:p.segment,project_name:name??p.front,active:true};};
describe('read-only project linker',()=>{
 it('resolves exact front without writing',()=>{const r=resolveEngineeringProjectLinks([item(0,'uuid-a')],contract);expect(r[0].projectId).toBe('uuid-a');expect(linkSummary(r).matched).toBe(1);});
 it('never links just by duplicate mancha id',()=>{const r=resolveEngineeringProjectLinks([item(12,'a')],contract);expect(r[12].projectId).toBe('a');expect(r[13].projectId).toBeNull();});
 it('rejects another contract',()=>expect(resolveEngineeringProjectLinks([{...item(0,'x'),contract_id:'other'}],contract)[0].status).toBe('MISSING'));
 it('rejects another segment',()=>expect(resolveEngineeringProjectLinks([{...item(0,'x'),segment_type:'SEWER'}],contract)[0].status).toBe('MISSING'));
 it('blocks ambiguous matches',()=>expect(resolveEngineeringProjectLinks([item(0,'a'),item(0,'b')],contract)[0].status).toBe('AMBIGUOUS'));
 it('supports documented alias',()=>expect(resolveEngineeringProjectLinks([item(3,'x','Booster São João')],contract)[3].projectId).toBe('x'));
 it('does not match by fuzzy substring',()=>expect(resolveEngineeringProjectLinks([item(0,'x','KM 162 lote 2')],contract)[0].projectId).toBeNull());
});
