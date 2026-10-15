import {describe,it,expect} from 'vitest';
import {attackPlan2026,attackPlanSummary,attackPlanDuplicateIds} from './attack-plan-2026';
describe('Plano de Ataque 2026',()=>{
 it('mantém 16 frentes e soma 699 economias previstas',()=>{expect(attackPlanSummary()).toEqual({fronts:16,waterFronts:12,sewerFronts:4,waterEconomies:379,sewerEconomies:320,totalEconomies:699});});
 it('preserva ambas as frentes de Conchas e sinaliza ID repetido',()=>{expect(attackPlanDuplicateIds()).toHaveLength(2);expect(attackPlan2026.filter(x=>x.municipality==='Conchas').map(x=>x.front)).toEqual(['Estrada CH 12,5','Aflitos']);});
 it('mantém chaves locais distintas, sem inventar outro ID de mancha',()=>{expect(new Set(attackPlan2026.map(x=>x.rowKey)).size).toBe(16);});
});
