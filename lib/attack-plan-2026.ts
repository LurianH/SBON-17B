/** Plano de Ataque 2026 — transcrição da relação fornecida em 13/10/2026.
 * Não altera projetos, metas contratuais ou quantitativos aprovados no Supabase.
 * "rowKey" é identificador técnico local; não substitui o ID da mancha informado. */
export type PlanSegment = "WATER" | "SEWER";
export interface AttackPlanRow {rowKey: string; stainId: string; municipality: string; front: string; segment: PlanSegment; plannedEconomies: number}
export const attackPlan2026: readonly AttackPlanRow[] = [
  {rowKey:"attack-2026-01",stainId:"553_AF_0005N",municipality:"Porangaba",front:"KM 162",segment:"WATER",plannedEconomies:52},
  {rowKey:"attack-2026-02",stainId:"764_AF_113",municipality:"Quadra",front:"Estância",segment:"WATER",plannedEconomies:33},
  {rowKey:"attack-2026-03",stainId:"553_AF_1850",municipality:"Porangaba",front:"Cletos",segment:"SEWER",plannedEconomies:34},
  {rowKey:"attack-2026-04",stainId:"553_AF_292",municipality:"Porangaba",front:"São João",segment:"WATER",plannedEconomies:44},
  {rowKey:"attack-2026-05",stainId:"553_AF_2",municipality:"Porangaba",front:"Vicente",segment:"WATER",plannedEconomies:3},
  {rowKey:"attack-2026-06",stainId:"553_AF_303",municipality:"Porangaba",front:"Garças",segment:"WATER",plannedEconomies:32},
  {rowKey:"attack-2026-07",stainId:"553_AF_0004N",municipality:"Porangaba",front:"Dos Lopes",segment:"WATER",plannedEconomies:25},
  {rowKey:"attack-2026-08",stainId:"553_AF_164",municipality:"Porangaba",front:"Bairro Estrada Rachel Miranda (Partes)",segment:"SEWER",plannedEconomies:34},
  {rowKey:"attack-2026-09",stainId:"553_AR_0002N",municipality:"Porangaba",front:"Booster Alto da Serra",segment:"WATER",plannedEconomies:18},
  {rowKey:"attack-2026-10",stainId:"553_AF_88",municipality:"Porangaba",front:"Vidas Novas",segment:"WATER",plannedEconomies:121},
  {rowKey:"attack-2026-11",stainId:"553_AF_0001N",municipality:"Porangaba",front:"Núcleo Santino",segment:"WATER",plannedEconomies:10},
  {rowKey:"attack-2026-12",stainId:"764_AR_0002N",municipality:"Quadra",front:"Cruz de Cedro",segment:"WATER",plannedEconomies:11},
  {rowKey:"attack-2026-13",stainId:"271_AR_0001N",municipality:"Conchas",front:"Estrada CH 12,5",segment:"WATER",plannedEconomies:13},
  {rowKey:"attack-2026-14",stainId:"271_AR_0001N",municipality:"Conchas",front:"Aflitos",segment:"WATER",plannedEconomies:17},
  {rowKey:"attack-2026-15",stainId:"553_AF_92",municipality:"Porangaba",front:"Ypê I",segment:"SEWER",plannedEconomies:51},
  {rowKey:"attack-2026-16",stainId:"553_AF_91",municipality:"Porangaba",front:"Ypê II",segment:"SEWER",plannedEconomies:201},
];
export function attackPlanSummary(rows: readonly AttackPlanRow[] = attackPlan2026) {
  const sum = (s?: PlanSegment) => rows.filter(r => !s || r.segment === s).reduce((a,r)=>a+r.plannedEconomies,0);
  return {fronts:rows.length, waterFronts:rows.filter(r=>r.segment==="WATER").length,sewerFronts:rows.filter(r=>r.segment==="SEWER").length,waterEconomies:sum("WATER"),sewerEconomies:sum("SEWER"),totalEconomies:sum()};
}
export function attackPlanDuplicateIds(rows: readonly AttackPlanRow[] = attackPlan2026) {
  const counts = new Map<string,number>();
  for (const r of rows) {const key = `${r.municipality}|${r.stainId}`;counts.set(key,(counts.get(key)??0)+1);}
  return rows.filter(r=>(counts.get(`${r.municipality}|${r.stainId}`)??0)>1).map(r=>r.rowKey);
}
