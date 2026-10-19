'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
import {projectReviewLabels,type ProjectReviewStatus,type ProjectReviewRow} from '@/lib/project-review-status';
import {segments,type CurrentProject} from '@/lib/engineering';
import type {GisProjectRow} from '@/lib/gis-project-model';
import './engineering-review-status.css';

type LogEntry={id:string;old_status:ProjectReviewStatus|null;new_status:ProjectReviewStatus;changed_at:string};
function ReviewHistory({projectId}:{projectId:string}){
 const [rows,setRows]=useState<LogEntry[]|null>(null),[error,setError]=useState('');
 async function load(){
  if(rows!==null)return;
  const db=createClient();if(!db){setError('Conexão indisponível.');return}
  const response=await db.from('engineering_project_review_history').select('id,old_status,new_status,changed_at').eq('engineering_project_id',projectId).order('changed_at',{ascending:false}).limit(20);
  if(response.error)setError('Não foi possível carregar o histórico.');
  else setRows(response.data as LogEntry[]);
 }
 return <details className="er-history" onToggle={e=>{if(e.currentTarget.open)void load()}}>
  <summary>Histórico de classificação</summary>
  {error&&<p role="alert">{error}</p>}
  {rows?.length===0&&<p>Nenhuma classificação registrada.</p>}
  {rows?.map(x=><p key={x.id}>{x.old_status?projectReviewLabels[x.old_status]+' → ':''}{projectReviewLabels[x.new_status]} · {new Date(x.changed_at).toLocaleString('pt-BR')}</p>)}
 </details>;
}
export function EngineeringReviewStatus({projects,initial,gis,canEdit,onEdit}:{projects:CurrentProject[];initial:ProjectReviewRow[];gis:GisProjectRow[];canEdit:boolean;onEdit:(p:CurrentProject)=>void}){
 const router=useRouter();
 const gisByProject=new Map(gis.filter(row=>row.engineering_project_id).map(row=>[row.engineering_project_id,row]));
 const [values,setValues]=useState<Record<string,ProjectReviewStatus>>(()=>Object.fromEntries(initial.map(x=>[x.engineering_project_id,x.status])) as Record<string,ProjectReviewStatus>);
 const [busy,setBusy]=useState<string|null>(null),[message,setMessage]=useState('');
 const [statusFilter,setStatusFilter]=useState<ProjectReviewStatus|'ALL'>('ALL');
 const current=(id:string)=>values[id]??'UNCLASSIFIED';
 async function save(project:CurrentProject,status:ProjectReviewStatus){
  if(!canEdit||busy)return;
  const gisProject=gisByProject.get(project.id);
  if(gisProject?.cancelled){setMessage('Mancha cancelada conforme o contrato; seu status permanece Cancelado.');return;}
  const db=createClient();if(!db){setMessage('Conexão indisponível.');return;}
  setBusy(project.id);setMessage('');
  const {data:{user}}=await db.auth.getUser();
  if(!user){setBusy(null);setMessage('Sessão expirada. Entre novamente.');return;}
  const {error}=await db.from('engineering_project_review_status').upsert(
   {engineering_project_id:project.id,status,updated_by:user.id},{onConflict:'engineering_project_id'}
  );
  if(error){setMessage('Não foi possível salvar o status: '+error.message);}
  else{setValues(previous=>({...previous,[project.id]:status}));setMessage('Classificação salva e registrada no histórico.');router.refresh();}
  setBusy(null);
 }
 const summary=(type:'WATER'|'SEWER')=>{
  const collection=projects.filter(x=>x.segment_type===type);
  return {total:collection.length,done:collection.filter(x=>current(x.id)!=='UNCLASSIFIED').length};
 };
 const displayed=projects.filter(project=>statusFilter==='ALL'||current(project.id)===statusFilter);
 return <section id="engenharia-classificacao" className="panel er-review" aria-label="Classificação gerencial dos projetos">
  <header className="er-heading"><div><span className="water-linear-eyebrow">CONTROLE POR SISTEMA</span><h2>Classificação dos projetos</h2><p>Classifique cada projeto usando as situações de avaliação. A classificação fica registrada no histórico e não altera aprovação, execução ou metragem.</p></div></header>
  <div className="er-stats">
   {(['WATER','SEWER'] as const).map(type=>{const s=summary(type);return <div key={type}><strong>{segments[type]}</strong><span>{s.done} de {s.total} projetos classificados</span><small>{s.total?Math.round(s.done/s.total*100):0}% dos projetos cadastrados</small></div>})}
  </div>
  <p className="er-disclaimer">Cada mancha tem um projeto por sistema: 38 de Água e 84 de Esgoto. Esta classificação alimenta também os gráficos do Dashboard e a aba Manchas. Economias da base GIS são referências estimadas; não representam automaticamente economias aprovadas. Sem objeção e S/Obj. com ressalvas contam como liberação para execução no Dashboard quando houver dados técnicos.</p>
  <div className="er-filter-row"><label htmlFor="er-status-filter">Filtrar projetos por classificação<select id="er-status-filter" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as ProjectReviewStatus|'ALL')}><option value="ALL">Todas as classificações</option>{Object.entries(projectReviewLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><span>{displayed.length} {displayed.length===1?'projeto exibido':'projetos exibidos'}</span></div>
  {projects.length===0?<p>Nenhum projeto encontrado nos filtros selecionados.</p>:displayed.length===0?<p>Nenhum projeto corresponde à classificação selecionada.</p>:<div className="er-scroll"><table className="er-table"><thead><tr><th>Município</th><th>Sistema</th><th>Projeto / identificação</th><th>Código GIS / bairro</th><th>Economias do sistema</th><th>Categoria</th><th>Classificação</th><th>Dados e histórico</th></tr></thead><tbody>
   {displayed.map(p=><tr key={p.id}>
    <td>{p.municipality}</td><td>{segments[p.segment_type]}</td><td><strong>{p.project_name}</strong></td>
    <td>{gisByProject.get(p.id)?<><strong>{gisByProject.get(p.id)?.gis_code}</strong><small>{gisByProject.get(p.id)?.neighborhood??'Bairro não informado'}</small><small>{gisByProject.get(p.id)?.settlement_type??''}</small></>:'Sem vínculo GIS'}</td>
    <td>{(()=>{const g=gisByProject.get(p.id);const value=p.segment_type==='WATER'?g?.economies_ica:g?.economies_ice;return value==null?'Não informado':new Intl.NumberFormat('pt-BR').format(value);})()}</td>
    <td>{p.project_category==='STATIC'?'Estática':p.project_category==='WATER_LINEAR'?'Rede de Água':p.project_category==='GENERAL'?'Geral':p.project_category==='GIS'?'Mancha GIS':p.project_category}</td>
    <td>{canEdit?<select aria-label={'Situação do projeto '+p.project_name} value={current(p.id)} disabled={busy!==null||Boolean(gisByProject.get(p.id)?.cancelled)} onChange={e=>void save(p,e.target.value as ProjectReviewStatus)}>{Object.entries(projectReviewLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>:<span>{projectReviewLabels[current(p.id)]}</span>}</td>
    <td><ReviewHistory projectId={p.id}/>{canEdit&&p.project_category!=='WATER_LINEAR'&&p.project_category!=='GIS'&&<button type="button" onClick={()=>onEdit(p)}>Atualizar dados técnicos</button>}</td>
   </tr>)}
  </tbody></table></div>}
  {message&&<p role="status" className="er-feedback">{message}</p>}
 </section>;
}