'use client';

import {useState} from 'react';
import {LocalizedWorksEngineering} from '@/components/LocalizedWorksEngineering';
import {createClient} from '@/lib/supabase/client';
import {canWriteEngineering, conceptLabels, currentProjects, deliveryLabels, emptyFilters, executiveLabels, filterProjects,
  municipalities, segments, type Category, type EngineeringFilters, type Project, type Update} from '@/lib/engineering';
import {EngineeringProjectHub} from '@/components/EngineeringProjectHub';
import {EngineeringManagementOverview} from '@/components/EngineeringManagementOverview';

import type {ProjectReviewRow} from '@/lib/project-review-status';
import type {GisProjectRow} from '@/lib/gis-project-model';
import type {ProjectManagementRow,ProjectNetworkRow,EngineeringExecutionRow} from '@/lib/engineering-unified-model';
import type {LocalizedWorkRow} from '@/lib/localized-works-model';

const format = (v: number | null, meters = false) => v === null ? 'Aguardando atualização' : new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 3}).format(v) + (meters ? ' m' : '');
const day = (v: string) => new Intl.DateTimeFormat('pt-BR').format(new Date(v + 'T12:00:00'));
const instant = (v: string) => new Intl.DateTimeFormat('pt-BR', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(v));
const localDate = () => {const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;};

export function EngineeringPanel({projects, updates, categories, role, contractId, notice, localizedWorks=[], localizedNotice='', reviewRows=[], gisProjects=[],managementRows=[],networkRows=[],executionRows=[]}: {
  projects: Project[]; updates: Update[]; categories: Category[]; role: string | null; contractId: string | null; notice: string;
  localizedWorks?: LocalizedWorkRow[]; localizedNotice?: string;
  reviewRows?: ProjectReviewRow[];
  gisProjects?: GisProjectRow[];
  managementRows?:ProjectManagementRow[];
  networkRows?:ProjectNetworkRow[];
  executionRows?:EngineeringExecutionRow[];
}) {
  const [filters, setFilters] = useState<EngineeringFilters>(emptyFilters);
  const [feedback, setFeedback] = useState('');
  const [director, setDirector] = useState(role === 'DIRETORIA');
  const all = currentProjects(projects, updates), visible = filterProjects(all, filters);
  const canEdit = canWriteEngineering(role) && Boolean(contractId) && !director;
  const filtered = Object.values(filters).some(Boolean);

  const fields: {key: keyof EngineeringFilters; label: string; options: [string, string][]}[] = [
    {key: 'city', label: 'Cidade', options: municipalities.map(c => [c, c])},
    {key: 'segment', label: 'Segmento', options: Object.entries(segments)},
    {key: 'category', label: 'Categoria', options: categories.map(c => [c.code, c.label])},
    {key: 'concept', label: 'Status da concepção', options: Object.entries(conceptLabels)},
    {key: 'executive', label: 'Status do executivo', options: Object.entries(executiveLabels)},
  ];
  return <div className="engineering">
    <div id="engenharia-aprovacoes"><EngineeringManagementOverview projects={visible} reviews={reviewRows}/></div>
    <div className="engineering-toolbar"><p>Projetos cadastrados por mancha e sistema, com situação gerencial</p><div>{role !== 'DIRETORIA' && <button onClick={() => setDirector(!director)}>{director ? 'Sair do Modo Diretoria' : 'Modo Diretoria'}</button>}</div></div>
    {notice && <p role="alert" className="engineering-notice">{notice}</p>}
    {feedback && <p role="status" className="engineering-notice">{feedback}</p>}
    <section className="panel engineering-filters" aria-label="Filtros de engenharia">{fields.map(f => <label key={f.key}>{f.label}<select value={filters[f.key]} onChange={e => setFilters({...filters, [f.key]: e.target.value})}><option value="">Todos</option>{f.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}<button onClick={() => setFilters(emptyFilters)}>Limpar filtros</button></section>
    {filtered && <p className="engineering-context">Indicadores e cidades refletem os filtros · {visible.length} projetos encontrados</p>}
    {!notice && !all.length && <p className="engineering-notice">Aguardando cadastro</p>}
    {!notice && all.length > 0 && !visible.length && <p role="status">Nenhum projeto corresponde aos filtros.</p>}
    <nav className="engineering-overview-nav" aria-label="Navegação da Engenharia">
      <a href="#engenharia-aprovacoes">Resumo e situação</a>
      <a href="#engenharia-projetos">Cadastro único GIS</a>
      <a href="#engenharia-municipios">Cinco municípios</a>
      <a href="#engenharia-estruturas">Reservatórios, boosters e EEEs</a>
    </nav>
    <EngineeringProjectHub projects={visible} gis={gisProjects} reviews={reviewRows} management={managementRows} network={networkRows} execution={executionRows} canEdit={canEdit}/>
    <div id="engenharia-estruturas" className="engineering-section-label"><h2>Obras localizadas</h2><p>Reservatórios, boosters e EEEs permanecem em cadastro de estruturas, separado dos trechos lineares.</p></div>
    <LocalizedWorksEngineering role={role} contractId={contractId} projects={projects} initialWorks={localizedWorks} notice={localizedNotice} readOnly={director}/>
    <details className="panel engineering-project-history">
      <summary>Histórico técnico anterior · 13 projetos de Água preservados</summary>
      {visible.filter(p=>p.current).map(p=><div className="engineering-history-item" key={p.id}>
        <strong>{p.project_name}</strong><small>{p.municipality} · {segments[p.segment_type]}</small>
        <History projectId={p.id} linear={p.project_category==='WATER_LINEAR'&&p.project_type==='PE'}/>
      </div>)}
    </details>
  </div>;
}

function History({projectId, linear = false}: {projectId: string; linear?: boolean}) {
  const [rows, setRows] = useState<Update[] | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [more, setMore] = useState(true);
  async function load() {
    if (busy) return; setBusy(true); setError('');
    try {
      const db = createClient(); if (!db) throw new Error('Conexão indisponível.');
      const offset = rows?.length ?? 0;
      const result = await db.from('engineering_project_updates').select('*').eq('engineering_project_id', projectId).order('reference_date', {ascending: false}).order('created_at', {ascending: false}).order('id', {ascending: false}).range(offset, offset + 19);
      if (result.error) throw result.error;
      setRows([...(rows ?? []), ...result.data as Update[]]); setMore(result.data.length === 20);
    } catch {setError('Não foi possível carregar o histórico. Tente novamente.');} finally {setBusy(false);}
  }
  return <details onToggle={event => {if (event.currentTarget.open && rows === null && !busy) void load();}}><summary>Histórico de atualizações</summary>{rows?.map(row => <div className="engineering-snapshot" key={row.id}><b>Referência: {day(row.reference_date)}</b>{linear
    ? <p>Status da entrega: {row.delivery_status ? deliveryLabels[row.delivery_status] : 'Não informado'} · Economias: {format(row.approved_economies)} · DE63: {format(row.pead_de63_length_m == null ? null : Number(row.pead_de63_length_m), true)} · DE110: {format(row.pead_de110_length_m == null ? null : Number(row.pead_de110_length_m), true)} · Total: {format(row.approved_length_m == null ? null : Number(row.approved_length_m), true)}</p>
    : <><p>Concepção: {row.concept_status ? conceptLabels[row.concept_status] : 'Não informada'}{row.concept_approved_at ? ` em ${day(row.concept_approved_at)}` : ''} · Executivo: {row.executive_status ? executiveLabels[row.executive_status] : 'Não informado'}{row.executive_completed_at ? ` em ${day(row.executive_completed_at)}` : ''}</p><p>Economias: {format(row.approved_economies)} · Metragem: {format(row.approved_length_m == null ? null : Number(row.approved_length_m), true)}</p></>}
    <small>Registrado em {instant(row.created_at)} · Responsável: {row.created_by}</small>{row.notes && <p>{row.notes}</p>}</div>)}{rows?.length === 0 && <p>Aguardando atualização</p>}{error && <p role="alert">{error}</p>}{busy ? <p role="status">Carregando histórico…</p> : (error || (rows && more)) && <button onClick={() => void load()}>{error ? 'Tentar novamente' : 'Carregar anteriores'}</button>}</details>;
}
