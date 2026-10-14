import {z} from 'zod';
import {localizedDbUpdateSchema, type LocalizedFormRecord} from './localized-works-model';

export const LOCALIZED_DRAFT_KEY = 'sbon17b:localized-works:preview:v1';
const changedEvent = 'sbon17b:localized-draft-changed';
const numericText = z.string().refine(value => value.trim() === '' || Number.isFinite(Number(value)) && Number(value) >= 0, 'Valor técnico inválido');
const status = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED']);
const recordSchema = z.object({
  id: z.string().max(100), name: z.string().max(150), city: z.enum(['Porangaba','Quadra','Tatuí','Conchas','Pereiras']),
  stain: z.string().max(80), kind: z.enum(['RESERVOIR','BOOSTER','EEE']),
  units: z.string().regex(/^\d+$/).refine(value => Number(value) > 0 && Number(value) <= 2147483647),
  capacity: numericText, material: z.string().max(80), power: numericText, flow: numericText, hmt: numericText,
  hydraulic: status, electrical: status, structural: status,
  budget: localizedDbUpdateSchema.shape.budget_status,
  contractualCode: z.string().max(80), notes: z.string().max(2000),
  planRowKey: z.string().max(80).optional(), engineeringProjectId: z.union([z.literal(''),z.string().uuid()]).optional(),
  referenceDate: localizedDbUpdateSchema.shape.reference_date.optional(),
  physical: localizedDbUpdateSchema.shape.physical_status.optional(), approvedBudget: numericText.optional(),
});
const worksSchema = z.array(recordSchema).max(2000).refine(rows => new Set(rows.map(row => row.id)).size === rows.length, 'Identificadores duplicados');
export function parseLocalizedDraftWorks(value: unknown): LocalizedFormRecord[] {
  return worksSchema.parse(value);
}
export function getLocalizedDraftSnapshot() {
  try {return window.localStorage.getItem(LOCALIZED_DRAFT_KEY);} catch {return null;}
}
export function localizedDraftServerSnapshot() {return null;}
export function subscribeLocalizedDraft(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(changedEvent, listener);
  return () => {window.removeEventListener('storage', listener); window.removeEventListener(changedEvent, listener);};
}
export function readLocalizedDraft(snapshot: string | null, fallback: LocalizedFormRecord[]) {
  if (!snapshot) return fallback;
  try {
    const value: unknown = JSON.parse(snapshot);
    const draft = z.object({version: z.literal(1), works: worksSchema}).parse(value);
    return draft.works;
  } catch {return fallback;}
}
export function writeLocalizedDraft(works: LocalizedFormRecord[]) {
  const checked = parseLocalizedDraftWorks(works);
  window.localStorage.setItem(LOCALIZED_DRAFT_KEY, JSON.stringify({version:1,works:checked,updatedAt:new Date().toISOString()}));
  window.dispatchEvent(new Event(changedEvent));
}
