/** SBON 17B — pure management aggregation. No database writes or guessed prices. */
export type Segment = 'WATER' | 'SEWER';
export type LocalizedKind = 'EEE' | 'BOOSTER' | 'RESERVOIR' | 'EEAB' | 'EEAT' | 'OTHER';
export type BudgetStatus = 'NOT_BUDGETED' | 'IN_PREPARATION' | 'BUDGETED' | 'UNDER_REVIEW' | 'APPROVED';
export type LengthStage = 'ORIGINAL' | 'DESIGNED' | 'APPROVED' | 'EXECUTED' | 'VALIDATED' | 'MEASURED';
export interface ProjectKey {projectId: string; stainId: string | null; municipality: string; segment: Segment}
export interface NetworkSection extends ProjectKey {sectionId: string; material: string; diameterMm: number; lengthStage: LengthStage; lengthM: number | null}
export interface LocalizedWork extends ProjectKey {workId: string; kind: LocalizedKind; units: number; cv: number | null; capacityM3: number | null; budgetStatus: BudgetStatus; budgetBrl: number | null}
export interface ContractorMeasurement extends ProjectKey {entryId: string; validatedLengthM: number | null; measuredLengthM: number | null; rateBrlPerKm: number | null; paidBrl: number | null}
export interface Metric {value: number | null; partial: boolean}
export interface SystemSummary {system: Segment; networkByStage: Record<LengthStage, Metric>; localizedUnits: number; localizedWithoutBudget: number; localizedApprovedBudgetBrl: Metric; contractorValidatedKm: Metric; contractorMeasuredKm: Metric; contractorMeasuredBrl: Metric; contractorPaidBrl: Metric}
const stages: LengthStage[] = ['ORIGINAL','DESIGNED','APPROVED','EXECUTED','VALIDATED','MEASURED'];
function addKnown(values: Array<number | null>): Metric {
  if (!values.length || values.every(v => v === null)) return {value: null, partial: values.length > 0};
  return {value: values.reduce<number>((sum, v) => sum + (v ?? 0), 0), partial: values.some(v => v === null)};
}
function km(m: number | null): number | null {return m === null ? null : Math.round(m * 1000) / 1_000_000;}
function assertValues(rows: Array<number | null>) {for (const n of rows) if (n !== null && (!Number.isFinite(n) || n < 0)) throw new Error('Quantitativo inválido');}
export function summarizeSystem(system: Segment, networks: NetworkSection[], works: LocalizedWork[], measurements: ContractorMeasurement[]): SystemSummary {
  const net = networks.filter(x => x.segment === system);
  const loc = works.filter(x => x.segment === system);
  const con = measurements.filter(x => x.segment === system);
  assertValues([...net.map(x=>x.lengthM), ...loc.flatMap(x=>[x.units,x.cv,x.capacityM3,x.budgetBrl]), ...con.flatMap(x=>[x.validatedLengthM,x.measuredLengthM,x.rateBrlPerKm,x.paidBrl])]);
  // Exactly one physical section per stage. Catalogue entries for supply/installation are NOT network sections.
  const seen = new Set<string>();
  for (const n of net) {const key = `${n.projectId}\u0000${n.sectionId}\u0000${n.lengthStage}`;if (seen.has(key)) throw new Error(`Trecho duplicado: ${n.sectionId}`);seen.add(key);}
  const networkByStage = Object.fromEntries(stages.map(stage => [stage, addKnown(net.filter(n => n.lengthStage === stage).map(n => n.lengthM))])) as Record<LengthStage,Metric>;
  const estimated = loc.filter(w=>w.budgetStatus === 'APPROVED');
  const approvedBudget = addKnown(estimated.map(w=>w.budgetBrl));
  const measuredPrices = con.map(c => c.measuredLengthM === null || c.rateBrlPerKm === null ? null : (c.measuredLengthM / 1000)*c.rateBrlPerKm);
  return {system,networkByStage,localizedUnits:loc.reduce((s,w)=>s+w.units,0),localizedWithoutBudget:loc.filter(w=>w.budgetStatus==='NOT_BUDGETED').reduce((s,w)=>s+w.units,0),localizedApprovedBudgetBrl:approvedBudget,
    contractorValidatedKm:addKnown(con.map(x=>km(x.validatedLengthM))),contractorMeasuredKm:addKnown(con.map(x=>km(x.measuredLengthM))),contractorMeasuredBrl:addKnown(measuredPrices),contractorPaidBrl:addKnown(con.map(x=>x.paidBrl))};
}
export function summarizeMunicipalities(networks: NetworkSection[], works: LocalizedWork[], measurements: ContractorMeasurement[]) {
  const cities = new Set([...networks,...works,...measurements].map(x=>x.municipality));
  return [...cities].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(municipality=>({municipality,
    water:summarizeSystem('WATER',networks.filter(x=>x.municipality===municipality),works.filter(x=>x.municipality===municipality),measurements.filter(x=>x.municipality===municipality)),
    sewer:summarizeSystem('SEWER',networks.filter(x=>x.municipality===municipality),works.filter(x=>x.municipality===municipality),measurements.filter(x=>x.municipality===municipality))}));
}
