import {describe, expect, it} from 'vitest';
import {canReadEngineering, canWriteEngineering, currentProjects, emptyFilters, filterProjects, projectSchema, summarizeEngineering, updateSchema, type Project, type Update} from './engineering';
import {canAccessRoute, type AppRole} from './authorization';

const project = (id: string, extra: Partial<Project> = {}): Project => ({id, contract_id: 'contract', municipality: 'Tatuí', segment_type: 'WATER', project_category: 'GENERAL', project_name: id, active: true, ...extra});
const update = (id: string, extra: Partial<Update> = {}): Update => ({id: id + '-update', engineering_project_id: id, reference_date: '2026-09-11', created_at: '2026-09-11T12:00:00Z', created_by: 'user', concept_status: 'PENDING', concept_approved_at: null, executive_status: 'PENDING', executive_completed_at: null, approved_economies: null, approved_length_m: null, notes: '', ...extra});
const projects = [project('a'), project('b', {segment_type: 'SEWER'}), project('c', {municipality: 'Quadra', project_category: 'STATIC'})];
const updates = [update('a', {approved_economies: 10, approved_length_m: '0.1', concept_status: 'APPROVED', executive_status: 'COMPLETED'}), update('b', {approved_economies: 20, approved_length_m: '30.125'}), update('c', {approved_economies: 40, approved_length_m: '0.2'})];
const current = currentProjects(projects, updates);
describe('Consolidação de Engenharia', () => {
  it('soma economias WATER e metragem com precisão', () => {const s = summarizeEngineering(current.filter(p => p.segment_type === 'WATER')); expect(s.economies.value).toBe(50); expect(s.length.value).toBe(.3);});
  it('soma economias SEWER e metragem', () => {const s = summarizeEngineering(current.filter(p => p.segment_type === 'SEWER')); expect(s.economies.value).toBe(20); expect(s.length.value).toBe(30.125);});
  it('consolida por cidade', () => {expect(summarizeEngineering(filterProjects(current, {...emptyFilters, city: 'Tatuí'})).economies.value).toBe(30);});
  it('usa somente update vigente e não duplica snapshots repetidos', () => {const old = update('a', {id: 'old', reference_date: '2026-09-10', approved_economies: 100}); expect(summarizeEngineering(currentProjects(projects, [...updates, old, ...updates])).economies.value).toBe(70);});
  it('desempata por instante e id, independentemente da ordem recebida', () => {const a = update('a', {id: 'a', created_at: '2026-09-11T13:00:00Z'}), b = {...a, id: 'b'}; expect(currentProjects(projects, [b, ...updates, a])[0].current?.id).toBe('b');});
  it('cadastro retroativo não substitui data de referência mais nova', () => {expect(currentProjects(projects, [...updates, update('a', {reference_date: '2026-09-10', created_at: '2026-09-12T12:00:00Z'})])[0].current).toEqual(updates[0]);});
  it('exclui projetos inativos', () => {expect(currentProjects([project('a', {active: false})], updates)).toEqual([]);});
  it('calcula percentual de concepção e executivo pelos projetos ativos', () => {const s = summarizeEngineering(current); expect(s.conceptPercent).toBeCloseTo(100 / 3); expect(s.executivePercent).toBeCloseTo(100 / 3);});
  it.each(['GENERAL', 'STATIC'])('separa categoria %s', category => {const filtered = filterProjects(current, {...emptyFilters, category}); expect(filtered.every(p => p.project_category === category)).toBe(true); expect(filtered.length).toBe(category === 'GENERAL' ? 2 : 1);});
  it('empty state não inventa zeros nem percentuais', () => {const s = summarizeEngineering([]); expect(s.economies.value).toBeNull(); expect(s.length.value).toBeNull(); expect(s.conceptPercent).toBeNull(); expect(s.executivePercent).toBeNull();});
  it('distingue ausência, zero e total parcial', () => {const c = currentProjects([project('a'), project('b')], [update('a', {approved_economies: 0})]); const s = summarizeEngineering(c); expect(s.economies).toEqual({value: 0, partial: true}); expect(s.length.value).toBeNull(); expect(s.conceptPercent).toBe(0);});
  it('combina filtros de segmento e status', () => {expect(filterProjects(current, {...emptyFilters, segment: 'WATER', concept: 'APPROVED', executive: 'COMPLETED'}).map(p => p.id)).toEqual(['a']);});
});
describe('Validação', () => {
  it.each([-1, NaN, Infinity, 'NaN', 'Infinity'])('bloqueia economias inválidas: %s', value => {expect(updateSchema.safeParse({...update('a'), approved_economies: value}).success).toBe(false);});
  it.each([-1, NaN, Infinity, 'NaN', 'Infinity', '1.0001', '1e3'])('bloqueia metragem inválida: %s', value => {expect(updateSchema.safeParse({...update('a'), approved_length_m: value}).success).toBe(false);});
  it('não aceita economias fracionárias', () => {expect(updateSchema.safeParse({...update('a'), approved_economies: 1.5}).success).toBe(false);});
  it('campos vazios permanecem null', () => {const result = updateSchema.parse({...update('a'), approved_economies: '', approved_length_m: ''}); expect(result.approved_economies).toBeNull(); expect(result.approved_length_m).toBeNull();});
  it('preserva decimal como string', () => {expect(updateSchema.parse({...update('a'), approved_length_m: '123.456'}).approved_length_m).toBe('123.456');});
  it('exige data para aprovação e finalização', () => {expect(updateSchema.safeParse({...update('a'), concept_status: 'APPROVED'}).success).toBe(false); expect(updateSchema.safeParse({...update('a'), executive_status: 'COMPLETED'}).success).toBe(false);});
  it('bloqueia data inválida ou posterior à referência', () => {expect(updateSchema.safeParse({...update('a'), reference_date: '2026-02-30'}).success).toBe(false); expect(updateSchema.safeParse({...update('a'), concept_status: 'APPROVED', concept_approved_at: '2026-09-12'}).success).toBe(false);});
  it('valida cidade e identificação', () => {expect(projectSchema.safeParse(project('a', {municipality: 'Outra'})).success).toBe(false); expect(projectSchema.safeParse(project('a', {project_name: ' '})).success).toBe(false);});
});
describe('Autorização', () => {
  it.each(['ADMIN', 'EDITOR', 'GESTOR', 'DIRETORIA'] as AppRole[])('%s pode ler a rota', role => {expect(canReadEngineering(role)).toBe(true); expect(canAccessRoute('/engenharia', role)).toBe(true);});
  it.each(['ADMIN', 'EDITOR'])('%s pode escrever', role => expect(canWriteEngineering(role)).toBe(true));
  it.each(['GESTOR', 'DIRETORIA', null, 'UNKNOWN'])('%s não pode escrever', role => expect(canWriteEngineering(role)).toBe(false));
  it('nega leitura a perfil ausente ou desconhecido', () => {expect(canReadEngineering(null)).toBe(false); expect(canReadEngineering('UNKNOWN')).toBe(false);});
});
