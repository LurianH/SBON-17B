'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
import {canWriteEngineering, deliveryLabels, municipalities, sumWaterLinearLength, waterLinearProjectSchema,
  waterLinearUpdateSchema, type CurrentProject, type DeliveryStatus} from '@/lib/engineering';
import {summarizeWaterLinear} from '@/lib/engineering-water-linear';

const day = (value: string) => new Intl.DateTimeFormat('pt-BR').format(new Date(value + 'T12:00:00'));
const instant = (value: string) => new Intl.DateTimeFormat('pt-BR', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(value));
const localDate = () => {const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;};
const numeric = (value: number, fractionDigits = 3) => new Intl.NumberFormat('pt-BR', {maximumFractionDigits: fractionDigits}).format(value);
const metricValue = (value: number | null, unit: 'economies' | 'meters' | 'km') => value === null
  ? 'Aguardando atualização'
  : unit === 'km' ? `${numeric(value / 1000, 2)} km` : numeric(value, unit === 'meters' ? 2 : 0) + (unit === 'meters' ? ' m' : '');

function Metric({value, partial, unit}: {value: number | null; partial: boolean; unit: 'economies' | 'meters' | 'km'}) {
  return <><strong>{metricValue(value, unit)}</strong>{partial && value !== null && <small>Parcial · há registros sem esse valor</small>}</>;
}

export function EngineeringWaterLinearSection({projects, canEdit, contractId, onSaved}: {
  projects: CurrentProject[]; canEdit: boolean; contractId: string | null; onSaved: () => void;
}) {
  const [editing, setEditing] = useState<CurrentProject | 'new' | null>(null);
  const summary = summarizeWaterLinear(projects);
  const rows = [...summary.rows].sort((a, b) => a.municipality.localeCompare(b.municipality, 'pt-BR')
    || a.project_name.localeCompare(b.project_name, 'pt-BR'));
  const cityOrder = ['Porangaba', 'Quadra', 'Tatuí', 'Conchas'];
  const cityRank = (city: string) => {const rank = cityOrder.indexOf(city); return rank === -1 ? cityOrder.length : rank;};
  const cities = [...summary.municipalities].sort((a, b) => cityRank(a.municipality) - cityRank(b.municipality));
  const canCreate = canEdit && Boolean(contractId);
  const openForm = (project: CurrentProject | 'new') => {
    setEditing(project);
    requestAnimationFrame(() => document.getElementById('water-linear-form')?.scrollIntoView({behavior: 'smooth'}));
  };

  return <section className="panel water-linear" aria-labelledby="water-linear-title">
    <header className="water-linear-heading">
      <div><span className="water-linear-eyebrow">ACOMPANHAMENTO DE ENTREGAS</span><h2 id="water-linear-title">Projetos de Água — Obras Lineares</h2>
        <p>Áreas, economias aprovadas e extensão da rede. O status acompanha a entrega da obra. O tipo PE identifica o registro linear e não representa os marcos de concepção ou executivo da seção convencional.</p></div>
      {canCreate && <button onClick={() => openForm('new')}>Cadastrar projeto de Água</button>}
    </header>

    {!summary.projects ? <p role="status" className="water-linear-empty">Nenhum projeto de Água / Obras Lineares corresponde aos filtros compartilhados.</p> : <>
    <div className="water-linear-kpis">
      <article><span>Projetos de Água</span><strong>{summary.projects}</strong><small>áreas ativas</small></article>
      <article><span>Economias aprovadas</span><Metric {...summary.economies} unit="economies"/></article>
      <article><span>Extensão total da rede</span><Metric {...summary.networkM} unit="km"/></article>
      <article><span>Projetos finalizados</span><strong>{summary.completed} / {summary.projects}</strong>
        <small>{summary.completedPercent === null ? 'Sem projetos cadastrados' : `${numeric(summary.completedPercent, 1)}% do total`}</small>
        {summary.completedPercent !== null && <progress max={100} value={summary.completedPercent} aria-label="Percentual de projetos finalizados"/>}
      </article>
    </div>

    <section className="water-linear-status-section" aria-labelledby="water-linear-status-title"><h3 id="water-linear-status-title">Resumo de entregas por status</h3><div className="water-linear-statuses">
      {summary.statuses.map(status => <article key={status.status} data-status={status.status}>
        <span>{status.label}</span><strong>{status.projects} {status.projects === 1 ? 'projeto' : 'projetos'}</strong>
      </article>)}
      {summary.withoutStatus > 0 && <p role="status">{summary.withoutStatus} projeto(s) sem snapshot de status.</p>}
    </div></section>

    <section className="water-linear-municipalities" aria-labelledby="water-linear-cities-title">
      <h3 id="water-linear-cities-title">Visão por município</h3>
        <div className="water-linear-city-grid">{cities.map(city => <article key={city.municipality}>
          <h4>{city.municipality}</h4><dl>
            <div><dt>Projetos</dt><dd>{city.projects}</dd></div>
            <div><dt>Economias</dt><dd>{metricValue(city.economies.value, 'economies')}</dd></div>
            <div><dt>Extensão total</dt><dd>{metricValue(city.networkM.value, 'meters')}</dd></div>
          </dl>
          {(city.networkM.partial || city.economies.partial) && <small>Totais parciais: há valores sem atualização.</small>}
        </article>)}</div>
    </section>

    <section className="water-linear-table-section" aria-labelledby="water-linear-table-title">
      <div className="water-linear-table-title"><h3 id="water-linear-table-title">Detalhamento por área / projeto</h3><span>{rows.length} registros</span></div>
      <div className="water-linear-table-wrap" role="region" aria-label="Tabela detalhada de projetos de Água / Obras Lineares" tabIndex={0}><table>
        <caption>Projetos de Água / Obras Lineares, com extensões armazenadas em metros.</caption>
        <thead><tr><th scope="col">Cidade</th><th scope="col">Projeto / Área</th><th scope="col">Tipo</th><th scope="col">Status</th>
          <th scope="col">Economias</th><th scope="col">PEAD DE63</th><th scope="col">PEAD DE110</th><th scope="col">Extensão total</th><th scope="col">Última atualização</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
        <tbody>{rows.map(project => {
          const update = project.current;
          return <tr key={project.id}>
            <td>{project.municipality}</td><td>{project.project_name}</td><td>{project.project_type === 'PE' ? 'PE · Obra linear' : project.project_type ?? '—'}</td>
            <td><span className={`water-linear-badge ${update?.delivery_status ?? 'UNKNOWN'}`}>{update?.delivery_status ? deliveryLabels[update.delivery_status] : 'Sem status'}</span></td>
            <td>{update?.approved_economies == null ? 'Aguardando atualização' : numeric(update.approved_economies, 0)}</td>
            <td>{update?.pead_de63_length_m == null ? 'Aguardando atualização' : `${numeric(Number(update.pead_de63_length_m))} m`}</td>
            <td>{update?.pead_de110_length_m == null ? 'Aguardando atualização' : `${numeric(Number(update.pead_de110_length_m))} m`}</td>
            <td>{update?.approved_length_m == null ? 'Aguardando atualização' : `${numeric(Number(update.approved_length_m))} m`}</td>
            <td>{update ? <><time dateTime={update.created_at}>{instant(update.created_at)}</time>
              <small title={`Responsável: ${update.created_by}`}>Referência: {day(update.reference_date)} · por {update.created_by.slice(0, 8)}</small></> : '—'}</td>
            <td>{canCreate && <button className="water-linear-edit" onClick={() => openForm(project)} aria-label={`Atualizar ${project.project_name}`}>Atualizar</button>}</td>
          </tr>;
        })}</tbody>
      </table></div>
    </section>
    </>}
    {editing && canCreate && <WaterLinearForm key={editing === 'new' ? 'new' : editing.id}
      project={editing === 'new' ? null : editing} contractId={contractId!}
      onClose={() => setEditing(null)} onSaved={() => {setEditing(null); onSaved();}}/>}
  </section>;
}

function WaterLinearForm({project, contractId, onClose, onSaved}: {
  project: CurrentProject | null; contractId: string; onClose: () => void; onSaved: () => void;
}) {
  const router = useRouter(), current = project?.current;
  const [referenceDate, setReferenceDate] = useState(current?.reference_date ?? localDate());
  const [status, setStatus] = useState<DeliveryStatus>(current?.delivery_status ?? 'NOT_STARTED');
  const [de63, setDe63] = useState(current?.pead_de63_length_m == null ? '' : String(current.pead_de63_length_m));
  const [de110, setDe110] = useState(current?.pead_de110_length_m == null ? '' : String(current.pead_de110_length_m));
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const total = de63 !== '' && de110 !== '' ? sumWaterLinearLength(de63, de110) : null;

  async function submit(formData: FormData) {
    if (busy) return;
    const raw = Object.fromEntries(formData);
    const parsedProject = project ? null : waterLinearProjectSchema.safeParse({
      municipality: raw.municipality, project_name: raw.project_name,
      segment_type: 'WATER', project_category: 'WATER_LINEAR', project_type: 'PE',
    });
    const parsedUpdate = waterLinearUpdateSchema.safeParse({...raw, reference_date: referenceDate, delivery_status: status});
    if ((parsedProject && !parsedProject.success) || !parsedUpdate.success) {
      const issues = [...(parsedProject && !parsedProject.success ? parsedProject.error.issues : []), ...(!parsedUpdate.success ? parsedUpdate.error.issues : [])];
      setMessage('Revise os campos: ' + issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(' · ')); return;
    }
    setBusy(true); setMessage('Salvando…');
    try {
      const db = createClient(); if (!db) throw new Error('Conexão indisponível.');
      const {data: {user}} = await db.auth.getUser(); if (!user) throw new Error('Sua sessão expirou. Entre novamente.');
      const {data: profile} = await db.from('profiles').select('role,active').eq('id', user.id).maybeSingle();
      if (!profile?.active || !canWriteEngineering(profile.role)) throw new Error('Seu perfil não permite editar Engenharia.');
      const update = {...parsedUpdate.data, concept_status: null, concept_approved_at: null, executive_status: null, executive_completed_at: null};
      const result = project
        ? await db.from('engineering_project_updates').insert({...update, engineering_project_id: project.id})
        : await db.rpc('create_engineering_project', {p_contract_id: contractId, p_project: parsedProject!.data, p_update: update});
      if (result.error) throw new Error(result.error.code === '23505'
        ? 'Já existe um projeto de Água / Obras Lineares com essa cidade e identificação.'
        : 'Não foi possível salvar. Verifique os dados e tente novamente.');
      router.refresh(); onSaved();
    } catch (error) {setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.');}
    finally {setBusy(false);}
  }

  return <section id="water-linear-form" className="water-linear-form">
    <h3>{project ? `Atualizar · ${project.project_name}` : 'Cadastrar projeto de Água / Obras Lineares'}</h3>
    <p>O status de entrega não define aprovação de economias nem data de conclusão do projeto executivo.</p>
    <form action={submit} className="water-linear-edit-form"><fieldset disabled={busy}><div className="water-linear-fields">
      {!project && <><label>Cidade<select name="municipality" required defaultValue=""><option value="" disabled>Selecione</option>{municipalities.map(city => <option key={city} value={city}>{city}</option>)}</select></label>
        <label>Projeto / Área<input name="project_name" maxLength={200} required/></label></>}
      {project && <p>{project.municipality} · Projeto linear de Água · Tipo PE</p>}
      <label>Data da atualização<input type="date" value={referenceDate} onChange={event => setReferenceDate(event.target.value)} required/></label>
      <label>Status da entrega<select value={status} onChange={event => setStatus(event.target.value as DeliveryStatus)}>
        {Object.entries(deliveryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Economias aprovadas<input type="number" min="0" max="2147483647" step="1" name="approved_economies" defaultValue={current?.approved_economies ?? ''}/></label>
      <label>PEAD DE63 (m)<input type="number" min="0" max="99999999999.999" step="0.001" name="pead_de63_length_m" value={de63} onChange={event => setDe63(event.target.value)} required/></label>
      <label>PEAD DE110 (m)<input type="number" min="0" max="99999999999.999" step="0.001" name="pead_de110_length_m" value={de110} onChange={event => setDe110(event.target.value)} required/></label>
      <div className="water-linear-total-preview"><span>Extensão total calculada</span><strong>{total === null ? 'Informe DE63 e DE110' : `${numeric(Number(total))} m`}</strong></div>
      <label className="water-linear-note">Observação<textarea name="notes" maxLength={2000}/></label>
    </div></fieldset>
      <div className="engineering-buttons"><button type="submit" disabled={busy}>{busy ? 'Salvando…' : project ? 'Salvar atualização' : 'Cadastrar projeto'}</button>
        <button type="button" disabled={busy} onClick={onClose}>Cancelar</button></div>
      <p role="status" aria-live="polite">{message}</p>
    </form>
  </section>;
}
