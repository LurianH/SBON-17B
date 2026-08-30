import {describe,expect,it} from 'vitest';
import {summarizeAnnualTarget,type AnnualTargetDetail} from './target-calculations';

function details(rows:[string,number,number][]):AnnualTargetDetail[]{
  return rows.flatMap(([municipality,water,sewer])=>[
    {municipality,segment_type:'WATER',cut_name:null,target_economies:water},
    {municipality,segment_type:'SEWER',cut_name:null,target_economies:sewer},
  ]);
}

const targets={
  2026:details([['Conchas',38,125],['Pereiras',0,15],['Porangaba',176,391],['Quadra',67,90],['Tatuí',71,736]]),
  2027:details([['Conchas',577,546],['Pereiras',186,68],['Porangaba',1375,1232],['Quadra',403,344],['Tatuí',1024,2369]]),
  2028:details([['Conchas',233,447],['Pereiras',227,285],['Porangaba',331,1067],['Quadra',312,289],['Tatuí',13,1384]]),
};

describe('metas oficiais normalizadas',()=>{
  it.each([
    [2026,352,1357,1709],
    [2027,3565,4559,8124],
    [2028,1116,3472,4588],
  ] as const)('soma Água, Esgoto e total de %i',(year,water,sewer,total)=>{
    expect(summarizeAnnualTarget(targets[year])).toMatchObject({water,sewer,total});
  });

  it('soma o contrato completo',()=>{
    expect(summarizeAnnualTarget(Object.values(targets).flat())).toMatchObject({water:5033,sewer:9388,total:14421});
  });

  it.each(Object.entries(targets))('valida as somas municipais de %s',(_,rows)=>{
    const summary=summarizeAnnualTarget(rows);
    for(const municipality of summary.municipalities){
      expect(municipality.total).toBe(municipality.water+municipality.sewer);
    }
    expect(summary.municipalities.map(item=>item.municipality)).toEqual(['Conchas','Pereiras','Porangaba','Quadra','Tatuí']);
  });

  it('consolida recortes sem inventá-los ou duplicar o município',()=>{
    const summary=summarizeAnnualTarget([
      {municipality:'Tatuí',segment_type:'WATER',cut_name:'Recorte A',target_economies:4},
      {municipality:'Tatuí',segment_type:'WATER',cut_name:'Recorte B',target_economies:6},
      {municipality:'Tatuí',segment_type:'SEWER',cut_name:null,target_economies:12},
    ]);
    expect(summary).toMatchObject({water:10,sewer:12,total:22,municipalities:[{municipality:'Tatuí',water:10,sewer:12,total:22}]});
  });
});
