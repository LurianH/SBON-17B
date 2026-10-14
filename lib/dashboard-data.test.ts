import {beforeEach, describe, expect, it, vi} from 'vitest';
import {loadDashboardData} from './dashboard-data';
import {loadAnalysisData} from './analysis-data';
import {summarizeDashboardEngineering} from './dashboard-engineering';
import {type Project, type Update} from './engineering';

const mock = vi.hoisted(() => ({tables: {} as Record<string, Record<string, unknown>[]>, calls: [] as {table: string; selection: string; filters: [string, unknown][]}[], error: ''}));
vi.mock('./supabase/config', () => ({isSupabaseConfigured: () => true}));
vi.mock('./supabase/client', () => ({createClient: () => ({from(table: string) {
  const call = {table, selection: '', filters: [] as [string, unknown][]}; mock.calls.push(call);
  let start = 0, end = Infinity, single = false;
  const q = {
    select(value: string) {call.selection = value; return q;},
    eq(key: string, value: unknown) {call.filters.push([key, value]); return q;},
    neq() {return q;}, order() {return q;}, limit() {return q;},
    range(a: number, b: number) {start = a; end = b; return q;},
    maybeSingle() {single = true; return q;},
    then(resolve: (value: unknown) => void) {
      const rows = (mock.tables[table] ?? []).filter(r => call.filters.every(([k, v]) => r[k] === v)).slice(start, end + 1);
      resolve({data: single ? rows[0] ?? null : rows, count: 0, error: mock.error === table ? {message: 'Unavailable'} : null});
    },
  }; return q;
}})}));
const project = (id: string, segment_type: 'WATER' | 'SEWER' = 'WATER', active = true): Project => ({id, segment_type, active, contract_id: 'c', municipality: 'Tatuí', project_category: 'GENERAL', project_name: id, project_type: null});
const update = (id: string, economies: number | null, length: number | null, date = '2026-09-14'): Update => ({id: id + date, engineering_project_id: id, reference_date: date, approved_economies: economies, approved_length_m: length, concept_status: 'PENDING', concept_approved_at: null, executive_status: 'PENDING', executive_completed_at: null, delivery_status: null, pead_de63_length_m: null, pead_de110_length_m: null, notes: null, created_at: date + 'T12:00:00Z', created_by: 'u'});
beforeEach(() => {
  mock.calls = []; mock.error = '';
  mock.tables = {
    contracts: [{id: 'c', code: 'SBON 17B', active: true, contract_value: 100}],
    annual_targets: [{id: 't', contract_id: 'c', year: new Date().getFullYear(), target_economies: 1000}],
    weekly_progress: [{contract_id: 'c', active: true, reference_date: '2026-09-14', economies_executed: 20, network_executed_m: 40, economies_available: 9999, network_approved_m: 9999}],
    engineering_projects: [project('w'), project('s', 'SEWER'), project('inactive', 'WATER', false)],
    engineering_current_updates: [update('w', 30, 0.1), update('s', 40, 0.2), update('inactive', 999, 999)].map(u => ({...u, contract_id: 'c', active: u.engineering_project_id !== 'inactive'})),
  };
});
describe('dashboard engineering source', () => {
  it('reads active projects and the current view, never the legacy engineering source', async () => {
    const data = await loadDashboardData();
    expect(data.available).toBe(70); expect(data.networkApproved).toBe(0.3);
    expect(data.engineeringBreakdown).toEqual({waterEconomies: 30, sewerEconomies: 40, waterNetwork: 0.1, sewerNetwork: 0.2});
    expect(data.executed).toBe(20); expect(data.networkExecuted).toBe(40);
    expect(data.origin?.execution).toBe(50);
    expect(mock.calls.some(c => c.table === 'weekly_progress_details' || c.table === 'engineering_project_updates')).toBe(false);
    expect(mock.calls.find(c => c.table === 'weekly_progress')?.selection).not.toMatch(/economies_available|network_approved_m/);
    for (const table of ['engineering_projects', 'engineering_current_updates']) expect(mock.calls.find(c => c.table === table)?.filters).toEqual([['contract_id', 'c'], ['active', true]]);
  });
  it('does not sum history, backdated snapshots or inactive projects', () => {
    const before = JSON.stringify(mock.tables);
    const result = summarizeDashboardEngineering([project('w'), project('inactive', 'WATER', false)], [update('w', 999, 999, '2026-09-01'), update('w', 30, 40), update('inactive', 999, 999)]);
    expect(result.available).toBe(30); expect(result.networkApproved).toBe(40);
    expect(JSON.stringify(mock.tables)).toBe(before);
  });
  it('keeps absent and incomplete engineering null; never substitutes sewer meters for economies', async () => {
    mock.tables.engineering_current_updates[1].approved_economies = null;
    const partial = await loadDashboardData();
    expect(partial.available).toBeNull(); expect(partial.origin).toBeNull();
    expect(partial.engineeringBreakdown?.waterEconomies).toBe(30);
    expect(partial.engineeringBreakdown?.sewerEconomies).toBeNull();
    expect(partial.networkApproved).toBe(0.3);
    mock.tables.engineering_projects = [];
    const empty = await loadDashboardData();
    expect(empty.available).toBeNull(); expect(empty.networkApproved).toBeNull(); expect(empty.engineeringBreakdown).toBeNull();
  });
  it('preserves explicit zero and does not coerce a missing snapshot to zero', () => {
    expect(summarizeDashboardEngineering([project('w')], [update('w', 0, 0)]).available).toBe(0);
    expect(summarizeDashboardEngineering([project('w')], []).available).toBeNull();
  });
  it('fails closed on an engineering read error without legacy fallback', async () => {
    mock.error = 'engineering_current_updates';
    expect((await loadDashboardData()).available).toBeNull();
  });
  it('does not calculate a consolidated deviation when a target segment has no engineering economies', async () => {
    mock.tables.annual_target_details = [{annual_target_id: 't', municipality: 'Tatuí', segment_type: 'WATER', target_economies: 500}, {annual_target_id: 't', municipality: 'Tatuí', segment_type: 'SEWER', target_economies: 500}];
    mock.tables.engineering_projects = [project('w')];
    expect((await loadDashboardData()).origin).toBeNull();
  });
  it('keeps historical legacy values readable and new NULLs absent in the historical analysis', async () => {
    expect((await loadAnalysisData()).rows[0][1]).toBe('9.999');
    mock.tables.weekly_progress[0].economies_available = null;
    mock.tables.weekly_progress[0].network_approved_m = null;
    const rows = (await loadAnalysisData()).rows;
    expect(rows[0][1]).toBe('Aguardando atualização');
    expect(rows[2][1]).toBe('Aguardando atualização');
    expect(rows[1][1]).toBe('20');
  });
  it('paginates past the PostgREST row limit', async () => {
    mock.tables.engineering_projects = Array.from({length: 1001}, (_, i) => project(String(i)));
    mock.tables.engineering_current_updates = mock.tables.engineering_projects.map(p => ({...update(String(p.id), 1, 1), contract_id: 'c', active: true}));
    expect((await loadDashboardData()).available).toBe(1001);
    expect(mock.calls.filter(c => c.table === 'engineering_current_updates')).toHaveLength(3);
  });
});
