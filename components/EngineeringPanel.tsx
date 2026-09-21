'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
import {canWriteEngineering, conceptLabels, currentProjects, deliveryLabels, emptyFilters, executiveLabels, filterProjects,
  municipalities, projectSchema, segments, summarizeEngineering, summarizeEngineeringDisplay, updateSchema,
  type Category, type CurrentProject, type EngineeringFilters, type Project, type Update} from '@/lib/engineering';
import {EngineeringWaterLinearSection} from '@/components/EngineeringWaterLinearSection';

const format = (v: number | null, meters = false) => v === null ? 'Aguardando atualização' : new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 3}).format(v) + (meters ? ' m' : '');
const day = (v: string) => new Intl.DateTimeFormat('pt-BR').format(new Date(v + 'T12:00:00'));
const instant = (v: string) => new Intl.DateTimeFormat('pt-BR', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(v));
const localDate = () => {const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;};

function Amount({metric, meters = false, emptyLabel}: {metric: {value: number | null; partial: boolean}; meters?: boolean; emptyLabel?: string}) {
  return <><strong>{metric.value === null && emptyLabel ? emptyLabel : format(metric.value, meters)}</strong>{metric.partial && metric.value !== null && <small>Parcial · há projetos aguardando atualização</small>}</>;
}
function StatusKpi({title, projects, executive = false}: {title: string; projects: CurrentProject[]; executive?: boolean}) {
  const summary = summarizeEngineering(projects), percent = executive ? summary.executivePercent : summary.conceptPercent;
  return <article className="kpi"><span>{title}</span><strong>{percent === null ? 'Aguardando cadastro' : `${new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 1}).format(percent)}%`}</strong>
    {percent !== null && <><small>{executive ? summary.completed : summary.approved} de {summary.count} projetos ativos</small><progress max={100} value={percent} aria-label={title}/></>}</article>;
}
function SegmentAmounts({projects, title, mode}: {projects: CurrentProject[]; title: string; mode: 'water' | 'sewer' | 'total'}) {
  const summary = summarizeEngineeringDisplay(projects);
  if (!summary[mode].count) return <div className="engineering-segment"><h3>{title}</h3><p>Sem projetos cadastrados</p></div>;
  const showEconomies = mode !== 'sewer';
  const economyMetric = mode === 'water' ? summary.water.economies : mode === 'total' ? summary.total.economies : null;
  const lengthMetric = mode === 'water' ? summary.water.length : mode === 'sewer' ? summary.sewer.length : summary.total.length;
  const economyLabel = mode === 'total' ? 'Economias aprovadas (Água)' : 'Economias aprovadas';
  const economyEmptyLabel = mode === 'total' && !summary.total.waterCount ? 'Sem projetos de Água' : undefined;
  const lengthLabel = mode === 'total' ? 'Metragem aprovada (Água + Esgoto)' : 'Metragem aprovada';
  return <div className="engineering-segment"><h3>{title}</h3>{showEconomies && economyMetric && <><span>{economyLabel}</span><Amount metric={economyMetric} emptyLabel={economyEmptyLabel}/></>}<span>{lengthLabel}</span><Amount metric={lengthMetric} meters/></div>;
}

export function EngineeringPanel({projects, updates, categories, role, contractId, notice}: {
  projects: Project[]; updates: Update[]; categories: Category[]; role: string | null; contractId: string | null; notice: string;
}) {
  const [filters, setFilters] = useState<EngineeringFilters>(emptyFilters);
  const [editing, setEditing] = useState<CurrentProject | 'new' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [director, setDirector] = useState(role === 'DIRETORIA');
  const all = currentProjects(projects, updates), visible = filterProjects(all, filters);
  const canEdit = canWriteEngineering(role) && Boolean(contractId) && !director;
  const filtered = Object.values(filters).some(Boolean);
  const general = visible.filter(p => p.project_category === 'GENERAL'), statics = visible.filter(p => p.project_category === 'STATIC');
  const linearVisible = all.filter(p => p.project_type === 'PE' && p.project_category === 'WATER_LINEAR'
    && (!filters.city || p.municipality === filters.city)
    && (!filters.segment || p.segment_type === filters.segment)
    && (!filters.category || p.project_category === filters.category));
  const fields: {key: keyof EngineeringFilters; label: string; options: [string, string][]}[] = [
    {key: 'city', label: 'Cidade', options: municipalities.map(c => [c, c])},
    {key: 'segment', label: 'Segmento', options: Object.entries(segments)},
    {key: 'category', label: 'Categoria', options: categories.map(c => [c.code, c.label])},
    {key: 'concept', label: 'Status da concepção', options: Object.entries(conceptLabels)},
    {key: 'executive', label: 'Status do executivo', options: Object.entries(executiveLabels)},
  ];
  return <div className="engineering">
    <div className="engineering-toolbar"><p>Projetos aprovados e liberados pela engenharia</p><div>{role !== 'DIRETORIA' && <button onClick={() => {setDirector(!director); setEditing(null);}}>{director ? 'Sair do Modo Diretoria' : 'Modo Diretoria'}</button>}{canEdit && <button onClick={() => setEditing('new')}>Cadastrar projeto</button>}</div></div>
    {notice && <p role="alert" className="engineering-notice">{notice}</p>}
    {feedback && <p role="status" className="engineering-notice">{feedback}</p>}
    <section className="panel engineering-filters" aria-label="Filtros de engenharia">{fields.map(f => <label key={f.key}>{f.label}<select value={filters[f.key]} onChange={e => setFilters({...filters, [f.key]: e.target.value})}><option value="">Todos</option>{f.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}<button onClick={() => setFilters(emptyFilters)}>Limpar filtros</button></section>
    {filtered && <p className="engineering-context">Indicadores e cidades refletem os filtros · {visible.length} projetos encontrados</p>}
    {!notice && !all.length && <p className="engineering-notice">Aguardando cadastro</p>}
    {!notice && all.length > 0 && !visible.length && <p role="status">Nenhum projeto corresponde aos filtros.</p>}
    <section className="engineering-status" aria-label="Evolução dos projetos">
      <StatusKpi title="Concepção aprovada – Sala de Guerra · Geral" projects={general}/>
      <StatusKpi title="Projetos executivos finalizados · Geral" projects={general} executive/>
      <StatusKpi title="Estática – Concepção aprovada Sala de Guerra" projects={statics}/>
      <StatusKpi title="Estática – Projeto executivo" projects={statics} executive/>
    </section>
    <section className="panel engineering-totals" aria-label="Consolidação de economias e metragem">
      <SegmentAmounts title="Água" mode="water" projects={visible.filter(p => p.segment_type === 'WATER')}/><SegmentAmounts title="Esgoto" mode="sewer" projects={visible.filter(p => p.segment_type === 'SEWER')}/><SegmentAmounts title="Total" mode="total" projects={visible}/>
    </section>
    {!notice && <EngineeringWaterLinearSection projects={linearVisible} canEdit={canEdit} contractId={contractId} onSaved={() => setFeedback('Atualização de obra linear salva. Histórico preservado.')}/>}
    {canEdit && editing && <EngineeringForm key={editing === 'new' ? 'new' : editing.id} project={editing === 'new' ? null : editing} categories={categories} contractId={contractId!} onClose={() => setEditing(null)} onSaved={() => {setEditing(null); setFeedback('Atualização salva. Histórico preservado.');}}/>}
    <section className="engineering-cities" aria-label="Aprovações por cidade">{municipalities.filter(city => !filters.city || filters.city === city).map(city => {
      const cityProjects = visible.filter(p => p.municipality === city);
      return <article className="panel" key={city}><h2>{city}</h2><div className="engineering-city-segments"><SegmentAmounts title="Água" mode="water" projects={cityProjects.filter(p => p.segment_type === 'WATER')}/><SegmentAmounts title="Esgoto" mode="sewer" projects={cityProjects.filter(p => p.segment_type === 'SEWER')}/></div>
        {cityProjects.length > 0 && <details><summary>Ver projetos ({cityProjects.length})</summary>{Object.entries(segments).map(([segment, label]) => <section key={segment}><h3>{label}</h3>{cityProjects.filter(p => p.segment_type === segment).map(p => <div className="engineering-project" key={p.id}><h4>{p.project_name}</h4><span>{categories.find(c => c.code === p.project_category)?.label ?? p.project_category}</span>
          {p.project_category === 'WATER_LINEAR' && p.project_type === 'PE' ? <dl><div><dt>Entrega</dt><dd>{p.current?.delivery_status ? deliveryLabels[p.current.delivery_status] : 'Aguardando atualização'}</dd></div><div><dt>Economias</dt><dd>{format(p.current?.approved_economies ?? null)}</dd></div><div><dt>PEAD DE63</dt><dd>{format(p.current?.pead_de63_length_m == null ? null : Number(p.current.pead_de63_length_m), true)}</dd></div><div><dt>PEAD DE110</dt><dd>{format(p.current?.pead_de110_length_m == null ? null : Number(p.current.pead_de110_length_m), true)}</dd></div></dl>
            : <dl><div><dt>Concepção</dt><dd>{p.current?.concept_status ? conceptLabels[p.current.concept_status] : 'Não informada'}</dd></div><div><dt>Executivo</dt><dd>{p.current?.executive_status ? executiveLabels[p.current.executive_status] : 'Não informado'}</dd></div><div><dt>Economias</dt><dd>{format(p.current?.approved_economies ?? null)}</dd></div><div><dt>Metragem</dt><dd>{format(p.current?.approved_length_m == null ? null : Number(p.current.approved_length_m), true)}</dd></div></dl>}
          {p.current && <small>Última atualização: {instant(p.current.created_at)} · Referência: {day(p.current.reference_date)}</small>}
          {!director && <History projectId={p.id} linear={p.project_category === 'WATER_LINEAR' && p.project_type === 'PE'} />}{canEdit && !(p.project_category === 'WATER_LINEAR' && p.project_type === 'PE') && <button onClick={() => {setEditing(p); requestAnimationFrame(() => document.getElementById('engineering-form')?.scrollIntoView({behavior: 'smooth'}));}}>Atualizar projeto</button>}
        </div>)}</section>)}</details>}
      </article>;
    })}</section>
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

function EngineeringForm({project, categories, contractId, onClose, onSaved}: {project: CurrentProject | null; categories: Category[]; contractId: string; onClose: () => void; onSaved: () => void}) {
  const router = useRouter(), current = project?.current;
  const [referenceDate, setReferenceDate] = useState(localDate);
  const [concept, setConcept] = useState(current?.concept_status ?? 'PENDING');
  const [executive, setExecutive] = useState(current?.executive_status ?? 'PENDING');
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  async function submit(formData: FormData) {
    if (busy) return;
    const raw = Object.fromEntries(formData), parsedProject = projectSchema.safeParse(project ?? raw);
    const parsedUpdate = updateSchema.safeParse({...raw, concept_approved_at: concept === 'APPROVED' ? raw.concept_approved_at : null, executive_completed_at: executive === 'COMPLETED' ? raw.executive_completed_at : null});
    if (!parsedProject.success || !parsedUpdate.success) {setMessage('Revise os campos: ' + [...(!parsedProject.success ? parsedProject.error.issues : []), ...(!parsedUpdate.success ? parsedUpdate.error.issues : [])].map(i => `${i.path.join('.')}: ${i.message}`).join(' · ')); return;}
    setBusy(true); setMessage('Salvando…');
    try {
      const db = createClient(); if (!db) throw new Error('Conexão indisponível.');
      const {data: {user}} = await db.auth.getUser(); if (!user) throw new Error('Sua sessão expirou. Entre novamente.');
      const {data: profile} = await db.from('profiles').select('role,active').eq('id', user.id).maybeSingle();
      if (!profile?.active || !canWriteEngineering(profile.role)) throw new Error('Seu perfil não permite editar Engenharia.');
      const result = project
        ? await db.from('engineering_project_updates').insert({...parsedUpdate.data, engineering_project_id: project.id})
        : await db.rpc('create_engineering_project', {p_contract_id: contractId, p_project: parsedProject.data, p_update: parsedUpdate.data});
      if (result.error) throw new Error(result.error.code === '23505' ? 'Já existe um projeto com essa identificação na cidade, segmento e categoria.' : 'Não foi possível salvar. Verifique os dados e tente novamente.');
      router.refresh(); onSaved();
    } catch (error) {setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.');} finally {setBusy(false);}
  }
  return <section id="engineering-form" className="panel engineering-form"><h2>{project ? `Atualizar · ${project.project_name}` : 'Cadastrar projeto'}</h2><p>Informe os valores acumulados deste projeto. Deixe em branco o que ainda não foi informado.</p>{project && <p>{project.municipality} · {segments[project.segment_type]} · {categories.find(c => c.code === project.project_category)?.label}</p>}
    <form action={submit} className="data-form"><fieldset disabled={busy}><div className="fields">{!project && <><label>Cidade<select name="municipality" required><option value="">Selecione</option>{municipalities.map(c => <option key={c}>{c}</option>)}</select></label><label>Segmento<select name="segment_type" required><option value="">Selecione</option>{Object.entries(segments).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Categoria<select name="project_category" required>{categories.filter(c => c.code !== 'WATER_LINEAR').map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select></label><label>Projeto / identificação<input name="project_name" maxLength={200} required/></label></>}
      <label>Data de referência<input type="date" name="reference_date" value={referenceDate} onChange={e => setReferenceDate(e.target.value)} required/></label>
      <label>Concepção<select name="concept_status" value={concept} onChange={e => setConcept(e.target.value as typeof concept)}>{Object.entries(conceptLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      {concept === 'APPROVED' && <label>Data da aprovação<input type="date" name="concept_approved_at" max={referenceDate} defaultValue={current?.concept_approved_at ?? ''} required/></label>}
      <label>Projeto executivo<select name="executive_status" value={executive} onChange={e => setExecutive(e.target.value as typeof executive)}>{Object.entries(executiveLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      {executive === 'COMPLETED' && <label>Data da finalização<input type="date" name="executive_completed_at" max={referenceDate} defaultValue={current?.executive_completed_at ?? ''} required/></label>}
      <label>Economias aprovadas<input type="number" min="0" max="2147483647" step="1" name="approved_economies" defaultValue={current?.approved_economies ?? ''}/></label><label>Metragem aprovada (m)<input type="number" min="0" max="99999999999.999" step="0.001" name="approved_length_m" defaultValue={current?.approved_length_m ?? ''}/></label><label className="wide">Observação<textarea name="notes" maxLength={2000} defaultValue=""/></label>
    </div></fieldset><div className="engineering-buttons"><button disabled={busy} type="submit">{busy ? 'Salvando…' : project ? 'Salvar atualização' : 'Cadastrar projeto'}</button><button type="button" disabled={busy} onClick={onClose}>Cancelar</button></div><p role="status" aria-live="polite">{message}</p></form>
  </section>;
}
