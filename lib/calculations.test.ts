import {describe,expect,it} from 'vitest';
import {calculateAnnualEconomiesProjection,calculateAnnualTargetDeviation,calculateDashboardStatus,calculateDeviationOrigin,calculateMonthlyBillingYTD,calculateProjectionBaseAverage,calculateQuarterProjection,calculateWeeklyDelta} from './calculations';
describe('regras executivas',()=>{
 it('calcula deltas acumulados',()=>expect(calculateWeeklyDelta({referenceDate:'2',economiesAvailable:10500,economiesExecuted:8900,networkApprovedM:1100,networkExecutedM:900},{referenceDate:'1',economiesAvailable:10000,economiesExecuted:8500,networkApprovedM:1000,networkExecutedM:800})).toEqual({economiesAvailable:500,economiesExecuted:400,networkApprovedM:100,networkExecutedM:100}));
 it('soma somente o exercício',()=>expect(calculateMonthlyBillingYTD([{year:2026,amount:10},{year:2025,amount:90},{year:2026,amount:5}],2026)).toBe(15));
 it('usa média dos deltas',()=>expect(calculateProjectionBaseAverage([8000,8250,8560,8840])).toBe(280));
 it('exige dois deltas',()=>expect(calculateProjectionBaseAverage([8000,8250])).toBeNull());
 it('projeta trimestre e ano',()=>{expect(calculateQuarterProjection(1000,100,[4,4,4]).at(-1)?.accumulated).toBe(2200);expect(calculateAnnualEconomiesProjection(11920,3360,4)).toBe(16400)});
 it('calcula desvio e farol',()=>{expect(calculateAnnualTargetDeviation(14400,15000)).toBeCloseTo(-4);expect(calculateDashboardStatus(14400,15000)).toBe('ATENCAO')});
 it('não inventa origem sem déficit',()=>expect(calculateDeviationOrigin(100,0.5,60,50).engineeringPercent).toBeNull());
 it('atribui desvio somente à engenharia',()=>{const r=calculateDeviationOrigin(100,0.5,40,40);expect(r.engineeringPercent).toBe(100);expect(r.executionPercent).toBe(0)});
 it('atribui desvio somente à execução',()=>{const r=calculateDeviationOrigin(100,0.5,55,40);expect(r.engineeringPercent).toBe(0);expect(r.executionPercent).toBe(100)});
 it('distribui quando ambos estão abaixo',()=>{const r=calculateDeviationOrigin(100,0.5,45,35);expect(r.engineeringPercent).toBeCloseTo(33.333);expect(r.executionPercent).toBeCloseTo(66.667)});
 it('calcula as quatro médias pelos deltas',()=>{expect(calculateProjectionBaseAverage([10000,10350,10730,11100])).toBeCloseTo(366.667);expect(calculateProjectionBaseAverage([8000,8250,8560,8840])).toBe(280);expect(calculateProjectionBaseAverage([140000,145000,151000,157000])).toBeCloseTo(5666.667);expect(calculateProjectionBaseAverage([120000,123500,127800,132000])).toBe(4000)});
});
