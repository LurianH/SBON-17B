import {z} from 'zod';

// Phase 2: offline data validation only. No Supabase writes or schema changes.
const nonnegative = z.number().finite().nonnegative();
const optionalNumber = nonnegative.nullable();
const positiveInteger = z.number().int().positive();
export const systemSchema = z.enum(['WATER', 'SEWER']);
export const stageSchema = z.enum(['ORIGINAL', 'DESIGNED', 'APPROVED', 'EXECUTED', 'VALIDATED', 'MEASURED']);
export const budgetStatusSchema = z.enum(['NOT_BUDGETED','IN_PREPARATION','BUDGETED','UNDER_REVIEW','APPROVED']);

export const manchaSchema = z.object({
  projectId: z.string().uuid(),
  stainId: z.string().trim().min(1).max(80),
  municipality: z.enum(['Porangaba','Quadra','Tatuí','Conchas','Pereiras']),
  segment: systemSchema,
  referenceNote: z.string().trim().max(500).nullable(),
});
export const networkSectionSchema = z.object({
  sectionId: z.string().uuid(),
  projectId: z.string().uuid(),
  system: systemSchema,
  designation: z.string().trim().min(1).max(120),
  material: z.string().trim().min(1).max(40),
  diameterMm: positiveInteger,
  stage: stageSchema,
  lengthM: optionalNumber,
});
export const localizedWorkSchema = z.object({
  workId: z.string().uuid(),
  projectId: z.string().uuid(),
  system: systemSchema,
  kind: z.enum(['EEE','BOOSTER','RESERVOIR','EEAB','EEAT','OTHER']),
  title: z.string().trim().min(1).max(150),
  units: positiveInteger,
  powerCv: optionalNumber,
  capacityM3: optionalNumber,
  budgetStatus: budgetStatusSchema,
  estimatedBrl: optionalNumber,
  approvedBrl: optionalNumber,
  contractualItemCode: z.string().trim().max(80).nullable(),
}).superRefine((v, ctx) => {
  if (v.budgetStatus === 'NOT_BUDGETED' && (v.estimatedBrl !== null || v.approvedBrl !== null)) {
    ctx.addIssue({code:'custom',path:['budgetStatus'],message:'Obra sem orçamento não pode possuir valores financeiros.'});
  }
  if (v.budgetStatus !== 'APPROVED' && v.approvedBrl !== null) {
    ctx.addIssue({code:'custom',path:['approvedBrl'],message:'Valor aprovado exige orçamento aprovado.'});
  }
});
export const contractorMeasurementSchema = z.object({
  measurementId: z.string().uuid(),
  projectId: z.string().uuid(),
  system: systemSchema,
  contractor: z.string().trim().min(1).max(100),
  referenceMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  validatedM: optionalNumber,
  measuredM: optionalNumber,
  rateBrlPerKm: optionalNumber,
  paidBrl: optionalNumber,
}).superRefine((v, ctx) => {
  if (v.measuredM !== null && v.validatedM !== null && v.measuredM > v.validatedM) {
    ctx.addIssue({code:'custom',path:['measuredM'],message:'Extensão medida excede a validada.'});
  }
});

export type ManchaRecord = z.infer<typeof manchaSchema>;
export type NetworkSectionRecord = z.infer<typeof networkSectionSchema>;
export type LocalizedWorkRecord = z.infer<typeof localizedWorkSchema>;
export type ContractorMeasurementRecord = z.infer<typeof contractorMeasurementSchema>;

export function validateProjectLinks(
  manchas: ManchaRecord[],
  network: NetworkSectionRecord[],
  works: LocalizedWorkRecord[],
  measurements: ContractorMeasurementRecord[],
): string[] {
  const projects = new Map(manchas.map(m => [m.projectId, m]));
  const issues: string[] = [];
  const check = (projectId: string, system: 'WATER'|'SEWER', id: string) => {
    const project = projects.get(projectId);
    if (!project) issues.push(`${id}: mancha não encontrada`);
    else if (project.segment !== system) issues.push(`${id}: sistema diverge do cadastro da mancha`);
  };
  for (const n of network) check(n.projectId, n.system, n.sectionId);
  for (const w of works) check(w.projectId, w.system, w.workId);
  for (const m of measurements) check(m.projectId, m.system, m.measurementId);
  return issues;
}
