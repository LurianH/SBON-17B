import {z} from 'zod';
import {prepareLocalizedWork} from './localized-works-persistence';

export const localizedProjectLabels = {
  NOT_STARTED: 'Não iniciado', IN_PROGRESS: 'Em andamento', COMPLETED: 'Finalizado', APPROVED: 'Aprovado',
} as const;
export const localizedPhysicalLabels = {
  NOT_STARTED: 'Não iniciado', IN_PROGRESS: 'Em andamento', COMPLETED: 'Finalizado',
} as const;
export const localizedBudgetLabels = {
  NOT_BUDGETED: 'Sem orçamento', IN_PREPARATION: 'Em elaboração', BUDGETED: 'Orçado',
  UNDER_REVIEW: 'Em análise', APPROVED: 'Aprovado',
} as const;
export const localizedKindLabels = {RESERVOIR: 'Reservatório', BOOSTER: 'Booster', EEE: 'EEE'} as const;
const projectStatus = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED']);
const optionalNumber = (max: number) => z.number().finite().nonnegative().max(max).nullable().optional();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
export const localizedDbWorkSchema = z.object({
  plan_row_key: z.string().regex(/^attack-2026-\d{2}$/),
  engineering_project_id: z.string().uuid().nullable(),
  kind: z.enum(['RESERVOIR', 'BOOSTER', 'EEE']),
  designation: z.string().trim().min(1).max(150),
  quantity: z.number().int().positive().max(2147483647),
});
export const localizedDbUpdateSchema = z.object({
  reference_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Data inválida'),
  project_status: projectStatus,
  physical_status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']),
  budget_status: z.enum(['NOT_BUDGETED', 'IN_PREPARATION', 'BUDGETED', 'UNDER_REVIEW', 'APPROVED']),
  pump_power_cv: optionalNumber(999999999.999), flow_lps: optionalNumber(99999999.9999),
  head_mca: optionalNumber(999999999.999), capacity_m3: optionalNumber(99999999999.999),
  material: optionalText(80), hydraulic_project_status: projectStatus,
  electrical_project_status: projectStatus.nullable().optional(),
  structural_project_status: projectStatus.nullable().optional(),
  contractual_item_code: optionalText(80), approved_budget_brl: optionalNumber(999999999999999.99),
  notes: optionalText(2000),
}).superRefine((value, ctx) => {
  if (value.approved_budget_brl != null && value.budget_status !== 'APPROVED') {
    ctx.addIssue({code: 'custom', path: ['approved_budget_brl'], message: 'Valor aprovado exige orçamento aprovado.'});
  }
});
export type LocalizedDbWork = z.infer<typeof localizedDbWorkSchema>;
export type LocalizedDbUpdate = z.infer<typeof localizedDbUpdateSchema>;
export type LocalizedUpdateRow = LocalizedDbUpdate & {
  id: string; localized_work_id: string; created_at: string; created_by: string;
};
export type LocalizedWorkRow = {
  id: string; contract_id: string; engineering_project_id: string | null; plan_row_key: string;
  mancha_id: string; municipality: string; segment_type: 'WATER' | 'SEWER';
  kind: LocalizedDbWork['kind']; designation: string; quantity: number; active: boolean;
  created_at: string; created_by: string; current_update: LocalizedUpdateRow | null;
};
export type LocalizedFormRecord = {
  id: string; name: string; city: string; stain: string; kind: LocalizedDbWork['kind']; units: string;
  capacity: string; material: string; power: string; flow: string; hmt: string;
  hydraulic: LocalizedDbUpdate['project_status']; electrical: LocalizedDbUpdate['project_status'];
  structural: LocalizedDbUpdate['project_status']; budget: LocalizedDbUpdate['budget_status'];
  contractualCode: string; notes: string; planRowKey?: string;
  engineeringProjectId?: string; referenceDate?: string;
  physical?: LocalizedDbUpdate['physical_status']; approvedBudget?: string;
};
export function localizedToday() {
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
}
export function localizedRecordFromDatabase(work: LocalizedWorkRow): LocalizedFormRecord {
  const current = work.current_update;
  const text = (value: unknown) => value == null ? '' : String(value);
  return {
    id: work.id, name: work.designation, city: work.municipality, stain: work.mancha_id,
    kind: work.kind, units: String(work.quantity), planRowKey: work.plan_row_key,
    engineeringProjectId: work.engineering_project_id ?? '', referenceDate: current?.reference_date ?? localizedToday(),
    capacity: text(current?.capacity_m3), material: text(current?.material), power: text(current?.pump_power_cv),
    flow: text(current?.flow_lps), hmt: text(current?.head_mca),
    hydraulic: current?.hydraulic_project_status ?? 'NOT_STARTED',
    electrical: current?.electrical_project_status ?? 'NOT_STARTED', structural: current?.structural_project_status ?? 'NOT_STARTED',
    budget: current?.budget_status ?? 'NOT_BUDGETED', physical: current?.physical_status ?? 'NOT_STARTED',
    approvedBudget: text(current?.approved_budget_brl), contractualCode: text(current?.contractual_item_code), notes: text(current?.notes),
  };
}
export function localizedPayload(record: LocalizedFormRecord) {
  const number = (value: string) => value.trim() === '' ? null : Number(value);
  const prepared = prepareLocalizedWork({
    name: record.name, rowKey: record.planRowKey, kind: record.kind, quantity: Number(record.units),
    capacityM3: number(record.capacity), powerCv: number(record.power), flowLps: number(record.flow), hmtMca: number(record.hmt),
    material: record.material.trim() || null, hydraulic: record.hydraulic,
    electrical: record.kind === 'EEE' ? record.electrical : null,
    structural: record.kind === 'EEE' ? record.structural : null,
    budget: record.budget, contractualCode: record.contractualCode.trim() || null, notes: record.notes.trim() || null,
    referenceDate: record.referenceDate ?? localizedToday(),
  });
  if (record.city !== prepared.municipality || record.stain !== prepared.stainId) throw new Error('Frente, município ou mancha divergente.');
  if (record.kind === 'RESERVOIR' && prepared.input.capacityM3 === null) throw new Error('Informe a capacidade do reservatório.');
  const statuses = record.kind === 'EEE' ? [record.hydraulic, record.electrical, record.structural] : [record.hydraulic];
  const project = statuses.every(s => s === 'APPROVED') ? 'APPROVED'
    : statuses.every(s => s === 'APPROVED' || s === 'COMPLETED') ? 'COMPLETED'
      : statuses.every(s => s === 'NOT_STARTED') ? 'NOT_STARTED' : 'IN_PROGRESS';
  return {
    work: localizedDbWorkSchema.parse({plan_row_key: prepared.rowKey, engineering_project_id: record.engineeringProjectId || null,
      kind: record.kind, designation: prepared.input.name, quantity: prepared.input.quantity}),
    update: localizedDbUpdateSchema.parse({
      reference_date: prepared.input.referenceDate, project_status: project, physical_status: record.physical ?? 'NOT_STARTED',
      budget_status: record.budget, pump_power_cv: prepared.input.powerCv, flow_lps: prepared.input.flowLps,
      head_mca: prepared.input.hmtMca, capacity_m3: prepared.input.capacityM3, material: prepared.input.material,
      hydraulic_project_status: record.hydraulic, electrical_project_status: prepared.input.electrical,
      structural_project_status: prepared.input.structural, contractual_item_code: prepared.input.contractualCode,
      approved_budget_brl: number(record.approvedBudget ?? ''), notes: prepared.input.notes,
    }),
  };
}
