import {describe, it, expect} from 'vitest';
import {summarizeSystem, summarizeMunicipalities, type NetworkSection, type LocalizedWork, type ContractorMeasurement} from './management-metrics';
const key = {projectId:'p1',stainId:'553_AF_001',municipality:'Porangaba',segment:'WATER' as const};
const net:NetworkSection[]=[{...key,sectionId:'r1',material:'PEAD',diameterMm:63,lengthStage:'APPROVED',lengthM:1200}];
const works:LocalizedWork[]=[{...key,workId:'w1',kind:'BOOSTER',units:1,cv:null,capacityM3:null,budgetStatus:'NOT_BUDGETED',budgetBrl:null}];
const measurements:ContractorMeasurement[]=[{...key,entryId:'m1',validatedLengthM:1000,measuredLengthM:800,rateBrlPerKm:10000,paidBrl:null}];
describe('management metrics',()=>{
  it('keeps water and sewer independent',()=>{const s=summarizeSystem('WATER',net,works,measurements);expect(s.networkByStage.APPROVED.value).toBe(1200);expect(s.localizedWithoutBudget).toBe(1);expect(s.contractorMeasuredKm.value).toBe(.8);expect(s.contractorMeasuredBrl.value).toBe(8000);expect(s.contractorPaidBrl.value).toBeNull();expect(summarizeSystem('SEWER',net,works,measurements).networkByStage.APPROVED.value).toBeNull();});
  it('does not count unbudgeted structures as approved money',()=>{expect(summarizeSystem('WATER',net,works,[]).localizedApprovedBudgetBrl.value).toBeNull();});
  it('marks incomplete totals as partial instead of silently treating absent values as zero',()=>{const s=summarizeSystem('WATER',[...net,{...net[0],sectionId:'r2',lengthM:null}],[],[]);expect(s.networkByStage.APPROVED).toEqual({value:1200,partial:true});});
  it('rejects duplicate physical segments in the same stage',()=>{expect(()=>summarizeSystem('WATER',[...net,...net],[],[])).toThrow('Trecho duplicado');});
  it('separates city and system in aggregated output',()=>{const result=summarizeMunicipalities(net,works,measurements);expect(result).toHaveLength(1);expect(result[0].municipality).toBe('Porangaba');expect(result[0].sewer.localizedUnits).toBe(0);});
});
