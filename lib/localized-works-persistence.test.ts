import {describe,expect,it} from 'vitest';
import {prepareLocalizedWork} from './localized-works-persistence';
const input={name:'Booster Alto da Serra',rowKey:'attack-2026-09',kind:'BOOSTER',quantity:1,capacityM3:null,powerCv:null,flowLps:0.4,hmtMca:28,material:null,hydraulic:'NOT_STARTED',electrical:null,structural:null,budget:'NOT_BUDGETED',contractualCode:null,notes:null,referenceDate:'2026-10-14'};
describe('localized works gate',()=>{
 it('resolves rowKey without ambiguity',()=>expect(prepareLocalizedWork(input).stainId).toBe('553_AR_0002N'));
 it('rejects unknown row',()=>expect(()=>prepareLocalizedWork({...input,rowKey:'unknown'})).toThrow());
 it('rejects incompatible segment',()=>expect(()=>prepareLocalizedWork({...input,kind:'EEE'})).toThrow());
 it('supports identical stain codes with distinct rowKeys',()=>{
 const a=prepareLocalizedWork({...input,rowKey:'attack-2026-13'});
 const b=prepareLocalizedWork({...input,rowKey:'attack-2026-14'});
 expect(a.stainId).toBe(b.stainId);expect(a.rowKey).not.toBe(b.rowKey);
 });
 it('rejects negative measurements',()=>expect(()=>prepareLocalizedWork({...input,flowLps:-1})).toThrow());
 it('requires EEE status controls',()=>expect(()=>prepareLocalizedWork({...input,rowKey:'attack-2026-03',kind:'EEE'})).toThrow());
 it('rejects impossible dates',()=>expect(()=>prepareLocalizedWork({...input,referenceDate:'2026-02-30'})).toThrow('Data inválida'));
});
