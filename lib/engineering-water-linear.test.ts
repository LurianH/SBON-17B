import {describe, expect, it} from 'vitest';
import {type CurrentProject, type Project, type Update} from './engineering';
import {planWaterLinearImport, sumWaterLinearComponents, summarizeWaterLinear, waterLinearDataset} from './engineering-water-linear';
import {sumWaterLinearLength} from './engineering';

const imported: CurrentProject[] = waterLinearDataset.records.map((record, index) => {
  const id = `water-${index}`;
  const project: Project = {id, contract_id: 'contract', municipality: record.municipality, segment_type: 'WATER',
    project_category: 'WATER_LINEAR', project_name: record.project_name, project_type: 'PE', active: true};
  const update: Update = {id: `${id}-snapshot`, engineering_project_id: id, reference_date: record.reference_date,
    concept_status: null, concept_approved_at: null, executive_status: null, executive_completed_at: null,
    delivery_status: record.delivery_status, approved_economies: record.approved_economies,
    pead_de63_length_m: record.pead_de63_length_m, pead_de110_length_m: record.pead_de110_length_m,
    approved_length_m: sumWaterLinearLength(record.pead_de63_length_m, record.pead_de110_length_m),
    notes: record.notes, created_by: 'import-user', created_at: `${record.reference_date}T12:00:00Z`};
  return {...project, current: update};
});

describe('Acompanhamento de Água / Obras Lineares', () => {
  it('confere soma de economias e metragem em metros', () => {
    const summary = summarizeWaterLinear(imported);
    expect(summary.projects).toBe(13);
    expect(summary.economies.value).toBe(399);
    expect(summary.networkM.value).toBe(25908.34);
    expect(sumWaterLinearComponents(waterLinearDataset.records)).toBe(25908.34);
  });

  it('agrupa as áreas por status sem relacionar finalização a economias', () => {
    const summary = summarizeWaterLinear(imported);
    expect(summary.statuses.map(({status, projects, economies, networkM}) => ({status, projects, economies: economies.value, networkM: networkM.value}))).toEqual([
      {status: 'COMPLETED', projects: 6, economies: 155, networkM: 11744.54},
      {status: 'IN_PROGRESS', projects: 5, economies: 232, networkM: 12710.8},
      {status: 'NOT_STARTED', projects: 2, economies: 12, networkM: 1453},
    ]);
    expect(summary.completedPercent).toBeCloseTo(100 * 6 / 13, 10);
    expect(imported.find(row => row.project_name === 'Booster Vidas Novas')?.current?.delivery_status).toBe('IN_PROGRESS');
    expect(imported.find(row => row.project_name === 'Booster Vidas Novas')?.current?.approved_economies).toBe(132);
  });

  it('agrupa município dinamicamente e calcula extensões de andamento', () => {
    const summary = summarizeWaterLinear(imported);
    expect(summary.municipalities.map(city => [city.municipality, city.projects, city.economies.value, city.networkM.value])).toEqual([
      ['Conchas', 2, 30, 3639], ['Porangaba', 7, 313, 15761.15],
      ['Quadra', 2, 44, 5055.19], ['Tatuí', 2, 12, 1453],
    ]);
    expect(summary.municipalities.find(city => city.municipality === 'Porangaba')?.inProgressNetworkM.value).toBe(9071.8);
  });

  it('não transforma metragem de Esgoto em economias de Água', () => {
    const sewer: CurrentProject = {...imported[0], id: 'sewer', segment_type: 'SEWER',
      current: {...imported[0].current!, id: 'sewer-update', engineering_project_id: 'sewer', approved_economies: 9999, approved_length_m: 100000}};
    const summary = summarizeWaterLinear([...imported, sewer]);
    expect(summary.projects).toBe(13);
    expect(summary.economies.value).toBe(399);
    expect(summary.networkM.value).toBe(25908.34);
  });

  it('distingue valor ausente de zero explícito', () => {
    const missing: CurrentProject = {...imported[0], current: {...imported[0].current!, approved_economies: null}};
    const summary = summarizeWaterLinear([missing]);
    expect(summary.economies).toEqual({value: null, partial: true});
    expect(summarizeWaterLinear([{...missing, current: {...missing.current!, approved_economies: 0}}]).economies)
      .toEqual({value: 0, partial: false});
  });

  it('planeja importação idempotente e sinaliza colisões com identidade de outro tipo', () => {
    const existing = imported[0];
    const existingProject: Project = {id: existing.id, contract_id: existing.contract_id,
      municipality: existing.municipality, segment_type: existing.segment_type, project_category: existing.project_category,
      project_name: existing.project_name, project_type: existing.project_type, active: existing.active};
    const first = planWaterLinearImport(waterLinearDataset.records, [existingProject]);
    expect(first.toCreate).toHaveLength(12);
    expect(first.alreadyPresent).toHaveLength(1);
    expect(first.conflicts).toHaveLength(0);
    const conflicting: Project = {...existingProject, project_category: 'GENERAL', project_type: null};
    expect(planWaterLinearImport([waterLinearDataset.records[0]], [conflicting]).conflicts).toHaveLength(1);
  });
});
