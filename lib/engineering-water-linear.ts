import source from '@/data/engineering-water-linear.json';
import {deliveryLabels, type CurrentProject, type DeliveryStatus, type Project} from './engineering';

export type WaterLinearRecord = {
  municipality: string;
  project_name: string;
  segment_type: 'WATER';
  project_category: 'WATER_LINEAR';
  project_type: 'PE';
  delivery_status: DeliveryStatus;
  reference_date: string;
  approved_economies: number | null;
  pead_de63_length_m: string;
  pead_de110_length_m: string;
  notes: string | null;
};

export type WaterLinearDataset = {
  source_file: string;
  source_updated_at: string;
  contract_code: string;
  records: WaterLinearRecord[];
};

export const waterLinearDataset = source as WaterLinearDataset;
export const waterLinearStatuses = Object.keys(deliveryLabels) as DeliveryStatus[];

export function waterLinearProjects(projects: CurrentProject[]) {
  return projects.filter(project => project.segment_type === 'WATER'
    && project.project_category === 'WATER_LINEAR' && project.project_type === 'PE');
}

function sumMetric(rows: CurrentProject[], read: (project: CurrentProject) => number | string | null | undefined) {
  if (!rows.length) return {value: 0, partial: false};
  const values = rows.map(read).filter((value): value is number | string => value !== null && value !== undefined);
  if (!values.length) return {value: null, partial: true};
  // Keep the database's three-decimal metre precision without binary float drift.
  const sum = values.reduce<number>((total, value) => total + Math.round(Number(value) * 1000), 0) / 1000;
  return {value: sum, partial: values.length < rows.length};
}

const metric = (rows: CurrentProject[], field: 'approved_economies' | 'approved_length_m') =>
  sumMetric(rows, project => project.current?.[field]);

export function summarizeWaterLinear(projects: CurrentProject[]) {
  const rows = waterLinearProjects(projects);
  const statuses = waterLinearStatuses.map(status => {
    const statusRows = rows.filter(project => project.current?.delivery_status === status);
    return {status, label: deliveryLabels[status], projects: statusRows.length,
      economies: metric(statusRows, 'approved_economies'), networkM: metric(statusRows, 'approved_length_m')};
  });
  const completed = rows.filter(project => project.current?.delivery_status === 'COMPLETED').length;
  const municipalities = [...new Set(rows.map(project => project.municipality))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map(municipality => {
      const cityRows = rows.filter(project => project.municipality === municipality);
      const byStatus = (status: DeliveryStatus) => cityRows.filter(project => project.current?.delivery_status === status);
      return {
        municipality, projects: cityRows.length,
        economies: metric(cityRows, 'approved_economies'), networkM: metric(cityRows, 'approved_length_m'),
        completedNetworkM: metric(byStatus('COMPLETED'), 'approved_length_m'),
        inProgressNetworkM: metric(byStatus('IN_PROGRESS'), 'approved_length_m'),
      };
    });
  return {
    rows, projects: rows.length, economies: metric(rows, 'approved_economies'), networkM: metric(rows, 'approved_length_m'),
    completed, completedPercent: rows.length ? completed / rows.length * 100 : null,
    withoutStatus: rows.filter(project => !project.current?.delivery_status).length,
    statuses, municipalities,
  };
}

function importKey(row: Pick<Project, 'municipality' | 'segment_type' | 'project_name'>) {
  return `${row.segment_type}|${row.municipality}|${row.project_name.trim().toLocaleLowerCase('pt-BR')}`;
}

export function planWaterLinearImport(records: WaterLinearRecord[], existingProjects: Project[]) {
  const existingByKey = new Map<string, Project[]>();
  for (const project of existingProjects) {
    const key = importKey(project);
    existingByKey.set(key, [...(existingByKey.get(key) ?? []), project]);
  }
  const sourceSeen = new Set<string>();
  const toCreate: WaterLinearRecord[] = [], alreadyPresent: WaterLinearRecord[] = [], conflicts: WaterLinearRecord[] = [];
  for (const record of records) {
    const key = importKey(record);
    const found = existingByKey.get(key) ?? [];
    if (sourceSeen.has(key) || found.length > 1) conflicts.push(record);
    else if (found.length === 1 && found[0].project_type === 'PE'
      && found[0].project_category === 'WATER_LINEAR') alreadyPresent.push(record);
    else if (found.length === 1) conflicts.push(record);
    else toCreate.push(record);
    sourceSeen.add(key);
  }
  return {toCreate, alreadyPresent, conflicts};
}

export function sumWaterLinearComponents(records: Pick<WaterLinearRecord, 'pead_de63_length_m' | 'pead_de110_length_m'>[]) {
  return records.reduce((total, row) => total
    + Math.round(Number(row.pead_de63_length_m) * 1000)
    + Math.round(Number(row.pead_de110_length_m) * 1000), 0) / 1000;
}
