'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
import {projectReviewLabels,type ProjectReviewStatus,type ProjectReviewRow} from '@/lib/project-review-status';
import {segments,type CurrentProject} from '@/lib/engineering';
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
export function EngineeringReviewStatus({projects,initial,canEdit,onEdit}:{projects:CurrentProject[];initial:ProjectReviewRow[];canEdit:boolean;onEdit:(p:CurrentProject)=>void}){
 const router=useRouter();
 const [values,setValues]=useState<Record<string,ProjectReviewStatus>>(()=>Object.fromEntries(initial.map(x=>[x.engineering_project_id,x.status])) as Record<string,ProjectReviewStatus>);
 const [busy,setBusy]=useState<string|null>(null),[message,setMessage]=useState('');
 const current=(id:string)=>values[id]??'UNCLASSIFIED';
 async function save(project:CurrentProject,status:ProjectReviewStatus){
  if(!canEdit||busy)return;
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
 return <section id="engenharia-classificacao" className="panel er-review" aria-label="Classificação gerencial dos projetos">
  <header className="er-heading"><div><span className="water-linear-eyebrow">CONTROLE POR SISTEMA</span><h2>Classificação dos projetos</h2><p>Classifique cada projeto usando as situações de avaliação. A classificação fica registrada no histórico e não altera aprovação, execução ou metragem.</p></div></header>
  <div className="er-stats">
   {(['WATER','SEWER'] as const).map(type=>{const s=summary(type);return <div key={type}><strong>{segments[type]}</strong><span>{s.done} de {s.total} projetos classificados</span><small>{s.total?Math.round(s.done/s.total*100):0}% dos projetos cadastrados</small></div>})}
  </div>
  <p className="er-disclaimer">Projetos classificados e manchas contratuais são controles distintos. Os percentuais dos gráficos de 28 manchas de Água e 74 de Esgoto continuam vinculados ao cadastro de manchas.</p>
  {projects.length===0?<p>Nenhum projeto encontrado nos filtros selecionados.</p>:<div className="er-scroll"><table className="er-table"><thead><tr><th>Município</th><th>Sistema</th><th>Projeto / identificação</th><th>Categoria</th><th>Classificação</th><th>Dados e histórico</th></tr></thead><tbody>
   {projects.map(p=><tr key={p.id}>
    <td>{p.municipality}</td><td>{segments[p.segment_type]}</td><td><strong>{p.project_name}</strong></td><td>{p.project_category==='STATIC'?'Estática':p.project_category==='WATER_LINEAR'?'Rede de Água':p.project_category==='GENERAL'?'Geral':p.project_category}</td>
    <td>{canEdit?<select aria-label={'Situação do projeto '+p.project_name} value={current(p.id)} disabled={busy!==null} onChange={e=>void save(p,e.target.value as ProjectReviewStatus)}>{Object.entries(projectReviewLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>:<span>{projectReviewLabels[current(p.id)]}</span>}</td>
    <td><ReviewHistory projectId={p.id}/>{canEdit&&p.project_category!=='WATER_LINEAR'&&<button type="button" onClick={()=>onEdit(p)}>Atualizar dados técnicos</button>}</td>
   </tr>)}
  </tbody></table></div>}
  {message&&<p role="status" className="er-feedback">{message}</p>}
 </section>;
}