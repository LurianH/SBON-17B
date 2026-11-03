'use client';

import {useState} from 'react';
import {LocalizedWorksEngineering} from '@/components/LocalizedWorksEngineering';
import {createClient} from '@/lib/supabase/client';
import {canWriteEngineering, conceptLabels, currentProjects, deliveryLabels, emptyFilters, executiveLabels, filterProjects,
  municipalities, segments, type Category, type EngineeringFilters, type Project, type Update} from '@/lib/engineering';
import {EngineeringProjectHub} from '@/components/EngineeringProjectHub';
import {EngineeringManagementOverview} from '@/components/EngineeringManagementOverview';
import {EngineeringAnnualTargets} from '@/components/EngineeringAnnualTargets';

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
  const [weeklyConfirm,setWeeklyConfirm] = useState(false);
  const [weeklyBusy,setWeeklyBusy] = useState(false);
  const [weeklyResult,setWeeklyResult] = useState('');

  const [director, setDirector] = useState(role === 'DIRETORIA');
  const all = currentProjects(projects, updates), visible = filterProjects(all, filters);
  const canEdit = canWriteEngineering(role) && Boolean(contractId) && !director;
  const filtered = Object.values(filters).some(Boolean);

  async function applyConfirmedWeeklyUpdates() {
    if (!canEdit || weeklyBusy) return;
    setWeeklyBusy(true);
    setWeeklyResult('');
    try {
      const db=createClient();
      if(!db)throw new Error('Conexão com Supabase indisponível.');
      const {data:{user},error:authError}=await db.auth.getUser();
      if(authError||!user)throw new Error('É necessário estar conectado como ADMIN ou EDITOR.');
      const {data,error}=await db.rpc('apply_sbon17b_weekly_20261103');
      if(error)throw new Error(error.message);
      const outcome=data as {updated?:number;unchanged?:number;total_projects?:number}|null;
      setWeeklyResult('Atualização semanal registrada com histórico. Alterados: '+String(outcome?.updated??'—')+'; já conformes: '+String(outcome?.unchanged??'—')+'. Atualize a página para carregar os indicadores.');
      setWeeklyConfirm(false);
    }catch(error){
      setWeeklyResult('Nenhuma atualização da operação foi aplicada: '+(error instanceof Error?error.message:'Erro desconhecido')+'.');
    }finally{setWeeklyBusy(false);}
  }

  const fields: {key: keyof EngineeringFilters; label: string; options: [string, string][]}[] = [
    {key: 'city', label: 'Cidade', options: municipalities.map(c => [c, c])},
    {key: 'segment', label: 'Segmento', options: Object.entries(segments)},
    {key: 'category', label: 'Categoria', options: categories.map(c => [c.code, c.label])},
    {key: 'concept', label: 'Status da concepção', options: Object.entries(conceptLabels)},
    {key: 'executive', label: 'Status do executivo', options: Object.entries(executiveLabels)},
  ];
  return <div className="engineering">
    <div id="engenharia-aprovacoes"><EngineeringManagementOverview projects={visible} reviews={reviewRows}/></div>
    <EngineeringAnnualTargets contractId={contractId}/>
    <div className="engineering-toolbar"><p>Projetos cadastrados por mancha e sistema, com situação gerencial</p><div>{role !== 'DIRETORIA' && <button onClick={() => setDirector(!director)}>{director ? 'Sair do Modo Diretoria' : 'Modo Diretoria'}</button>}</div></div>
    {notice && <p role="alert" className="engineering-notice">{notice}</p>}
    {feedback && <p role="status" className="engineering-notice">{feedback}</p>}
    {canEdit&&<section className="panel" aria-label="Atualização semanal confirmada" style={{padding:'16px',marginBottom:'14px'}}>
      <h2 style={{fontSize:'16px',margin:'0 0 6px'}}>Atualização semanal · 03/11/2026</h2>
      <p>Aplicar somente as decisões confirmadas: Cruz de Cedro (600,00 m; 11 economias), CH 12,5 (2.384,79 m; 13 economias), Cletos (1.524,00 m; 61 economias; PEAD 160: 896 m e PEAD 225: 628 m) e Estância (3.226,29 m; 33 economias). Os quatro ficam como <b>Sem objeção</b>.</p>
      <p style={{fontSize:'12px'}}>Mantidos os demais projetos e dados em revisão. A operação valida os cadastros, não duplica projetos ou segmentos e grava o histórico pela sessão autenticada; se ocorrer divergência durante a conferência, a operação inteira é cancelada.</p>
      {!weeklyConfirm?<button type="button" disabled={weeklyBusy} onClick={()=>setWeeklyConfirm(true)}>Revisar e aplicar 4 projetos confirmados</button>:<div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}><button type="button" disabled={weeklyBusy} onClick={()=>void applyConfirmedWeeklyUpdates()}>{weeklyBusy?'Gravando…':'Confirmar gravação no Supabase'}</button><button type="button" disabled={weeklyBusy} onClick={()=>setWeeklyConfirm(false)}>Cancelar</button></div>}
      {weeklyResult&&<p role="status" style={{marginTop:'10px'}}>{weeklyResult} {weeklyResult.startsWith('Atualização semanal registrada')&&<button type="button" onClick={()=>window.location.reload()}>Recarregar indicadores</button>}</p>}
    </section>}

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
