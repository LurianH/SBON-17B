import {z} from 'zod';

export const municipalities = ['Porangaba', 'Quadra', 'Pereiras', 'Tatuí', 'Conchas'] as const;
export const segments = {WATER: 'Água', SEWER: 'Esgoto'} as const;
export const conceptLabels = {PENDING: 'Pendente', IN_PROGRESS: 'Em andamento', APPROVED: 'Aprovada'} as const;
export const executiveLabels = {PENDING: 'Pendente', IN_PROGRESS: 'Em andamento', COMPLETED: 'Finalizado'} as const;
export const deliveryLabels = {COMPLETED: 'Finalizado', IN_PROGRESS: 'Em andamento', NOT_STARTED: 'Não iniciado'} as const;
export type DeliveryStatus = keyof typeof deliveryLabels;
export type Category = {code: string; label: string};
export type Project = {
  id: string; contract_id: string; municipality: string; segment_type: keyof typeof segments;
  project_category: string; project_name: string; project_type: string | null; active: boolean;
};
export type Update = {
  id: string; engineering_project_id: string; reference_date: string;
  concept_status: keyof typeof conceptLabels | null; concept_approved_at: string | null;
  executive_status: keyof typeof executiveLabels | null; executive_completed_at: string | null;
  approved_economies: number | null; approved_length_m: string | number | null;
  delivery_status: DeliveryStatus | null;
  pead_de63_length_m: string | number | null; pead_de110_length_m: string | number | null;
  notes: string | null; created_by: string; created_at: string;
};
export type CurrentProject = Project & {current: Update | null};
export const canReadEngineering = (role: unknown) => ['ADMIN', 'EDITOR', 'GESTOR', 'DIRETORIA'].includes(String(role));
export const canWriteEngineering = (role: unknown) => role === 'ADMIN' || role === 'EDITOR';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Data inválida');
const optionalDate = z.preprocess(v => v === '' ? null : v, date.nullable());
const economies = z.preprocess(v => v === '' || v == null ? null : v,
  z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).pipe(z.number().int().min(0).max(2147483647)).nullable());
// Preserve decimal input as a string for PostgreSQL numeric(14,3).
const length = z.preprocess(v => v === '' || v == null ? null : String(v),
  z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, 'Informe metragem não negativa com até 3 casas decimais').nullable());
export const projectSchema = z.object({
  municipality: z.enum(municipalities), segment_type: z.enum(['WATER', 'SEWER']),
  project_category: z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/),
  project_name: z.string().trim().min(1).max(200),
  project_type: z.string().trim().min(1).max(40).nullable().optional(),
});
export const waterLinearProjectSchema = projectSchema.extend({
  segment_type: z.literal('WATER'), project_category: z.literal('WATER_LINEAR'), project_type: z.literal('PE'),
});
export const updateSchema = z.object({
  reference_date: date,
  concept_status: z.enum(['PENDING', 'IN_PROGRESS', 'APPROVED']), concept_approved_at: optionalDate,
  executive_status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']), executive_completed_at: optionalDate,
  approved_economies: economies, approved_length_m: length,
  notes: z.string().trim().max(2000).nullable(),
}).superRefine((value, ctx) => {
  for (const [done, field] of [[value.concept_status === 'APPROVED', 'concept_approved_at'], [value.executive_status === 'COMPLETED', 'executive_completed_at']] as const) {
    if (done !== Boolean(value[field]) || (value[field] && value[field]! > value.reference_date)) {
      ctx.addIssue({code: 'custom', path: [field], message: 'Informe a data apenas para status concluído e até a data de referência.'});
    }
  }
});

const requiredLength = z.preprocess(v => v === '' || v == null ? undefined : String(v),
  z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, 'Informe metragem não negativa com até 3 casas decimais'));
function metersToMillimeters(value: string) {
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 1000 + Number((fraction + '000').slice(0, 3));
}
function millimetersToMeters(value: number) {
  return `${Math.floor(value / 1000)}.${String(value % 1000).padStart(3, '0')}`;
}
export function sumWaterLinearLength(de63: string, de110: string) {
  return millimetersToMeters(metersToMillimeters(de63) + metersToMillimeters(de110));
}
export const waterLinearUpdateSchema = z.object({
  reference_date: date,
  delivery_status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']),
  approved_economies: economies,
  pead_de63_length_m: requiredLength, pead_de110_length_m: requiredLength,
  notes: z.preprocess(v => v === '' || v == null ? null : v, z.string().trim().max(2000).nullable()),
}).superRefine((value, ctx) => {
  const totalMm = metersToMillimeters(value.pead_de63_length_m) + metersToMillimeters(value.pead_de110_length_m);
  if (totalMm > 99999999999999) ctx.addIssue({code: 'custom', path: ['pead_de110_length_m'], message: 'A soma excede o limite de metragem suportado.'});
}).transform(value => ({...value, approved_length_m: sumWaterLinearLength(value.pead_de63_length_m, value.pead_de110_length_m)}));

export function currentProjects(projects: Project[], updates: Update[]): CurrentProject[] {
  const latest = new Map<string, Update>();
  for (const update of updates) {
    const old = latest.get(update.engineering_project_id);
    const key = (u: Update) => `${u.reference_date}|${u.created_at}|${u.id}`;
    if (!old || key(update) > key(old)) latest.set(update.engineering_project_id, update);
  }
  return projects.filter(p => p.active).map(p => ({...p, current: latest.get(p.id) ?? null}));
}

export function summarizeEngineering(projects: CurrentProject[]) {
  const values = (field: 'approved_economies' | 'approved_length_m') => {
    const known = projects.map(p => p.current?.[field]).filter(v => v !== null && v !== undefined);
    if (!known.length) return {value: null, partial: projects.length > 0};
    // Sum millimeters as integers so 0.1 + 0.2 is exactly 0.3 m.
    const value = field === 'approved_length_m'
      ? known.reduce<number>((sum, v) => sum + Math.round(Number(v) * 1000), 0) / 1000
      : known.reduce<number>((sum, v) => sum + Number(v), 0);
    return {value, partial: known.length < projects.length};
  };
  const count = projects.length;
  const approved = projects.filter(p => p.current?.concept_status === 'APPROVED').length;
  const completed = projects.filter(p => p.current?.executive_status === 'COMPLETED').length;
  return {count, approved, completed, conceptPercent: count ? approved / count * 100 : null,
    executivePercent: count ? completed / count * 100 : null,
    economies: values('approved_economies'), length: values('approved_length_m')};
}

export type EngineeringFilters = {city: string; segment: string; category: string; concept: string; executive: string};
export const emptyFilters: EngineeringFilters = {city: '', segment: '', category: '', concept: '', executive: ''};
export function filterProjects(projects: CurrentProject[], filters: EngineeringFilters) {
  return projects.filter(p => (!filters.city || p.municipality === filters.city)
    && (!filters.segment || p.segment_type === filters.segment)
    && (!filters.category || p.project_category === filters.category)
    && (!filters.concept || p.current?.concept_status === filters.concept)
    && (!filters.executive || p.current?.executive_status === filters.executive));
}
