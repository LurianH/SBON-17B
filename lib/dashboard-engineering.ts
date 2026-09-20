import {type SupabaseClient} from '@supabase/supabase-js';
import {currentProjects, type CurrentProject, type Project, type Update} from './engineering';

export type EngineeringBreakdown = {
  waterEconomies: number | null; sewerEconomies: number | null;
  waterNetwork: number | null; sewerNetwork: number | null;
};

export function summarizeDashboardEngineering(projects: Project[], updates: Update[]) {
  const current = currentProjects(projects, updates);
  // A missing value cannot be treated as zero or as a complete contract total.
  const total = (rows: CurrentProject[], field: 'approved_economies' | 'approved_length_m') => {
    if (!rows.length || rows.some(p => p.current?.[field] == null)) return null;
    const scale = field === 'approved_length_m' ? 1000 : 1;
    return rows.reduce((sum, p) => sum + Math.round(Number(p.current![field]) * scale), 0) / scale;
  };
  const water = current.filter(p => p.segment_type === 'WATER');
  const sewer = current.filter(p => p.segment_type === 'SEWER');
  const engineeringBreakdown: EngineeringBreakdown | null = current.length ? {
    waterEconomies: total(water, 'approved_economies'), sewerEconomies: total(sewer, 'approved_economies'),
    waterNetwork: total(water, 'approved_length_m'), sewerNetwork: total(sewer, 'approved_length_m'),
  } : null;
  return {engineeringBreakdown, available: total(current, 'approved_economies'),
    networkApproved: total(current, 'approved_length_m'),
    engineeringDate: current.reduce<string | null>((date, p) => p.current && (!date || p.current.reference_date > date) ? p.current.reference_date : date, null)};
}

export async function loadDashboardEngineering(db: SupabaseClient, contractId: string) {
  const projects: Project[] = [], updates: Update[] = [];
  // Paginate both sources so PostgREST's row cap cannot silently truncate totals.
  for (let offset = 0; ; offset += 500) {
    const result = await db.from('engineering_projects').select('*').eq('contract_id', contractId)
      .eq('active', true).order('id').range(offset, offset + 499);
    if (result.error) return summarizeDashboardEngineering([], []);
    projects.push(...result.data as Project[]);
    if (result.data.length < 500) break;
  }
  for (let offset = 0; ; offset += 500) {
    const result = await db.from('engineering_current_updates').select('*').eq('contract_id', contractId)
      .eq('active', true).order('engineering_project_id').range(offset, offset + 499);
    if (result.error) return summarizeDashboardEngineering([], []);
    updates.push(...result.data as Update[]);
    if (result.data.length < 500) break;
  }
  return summarizeDashboardEngineering(projects, updates);
}
