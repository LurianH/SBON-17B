'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/client';
import './stain-registry.css';

type Segment='WATER'|'SEWER';
type TargetRow={id:string;segment_type:string;total_count:number};
type StainRow={id:string;segment_type:string;municipality:string;stain_code:string;status:string;effective_status:string;notes:string|null;engineering_project_id:string|null;linked_project_name:string|null};
type HistoryRow={id:string;stain_id:string;old_status:string|null;new_status:string;changed_at:string};
const labels:Record<string,string>={
 UNCLASSIFIED:'Sem classificação',NO_OBJECTION:'Sem objeção',NO_OBJECTION_RESERVATIONS:'S/Obj. com ressalvas',
 IN_PREPARATION:'Em elaboração',IN_REVIEW:'Em revisão',NOT_STARTED:'A iniciar',CANCELLED:'Cancelado'
};
const cities=['Porangaba','Quadra','Tatuí','Conchas','Pereiras'];
export function StainRegistry({contractId,role,targets,rows,history}:{contractId:string;role:string;targets:TargetRow[];rows:StainRow[];history:HistoryRow[]}){
 const router=useRouter(),editable=role==='ADMIN'||role==='EDITOR';
 const [segment,setSegment]=useState<Segment>('WATER');
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [selectedCity,setSelectedCity]=useState('Porangaba');
 const [targetWater,setTargetWater]=useState(String(targets.find(r=>r.segment_type==='WATER')?.total_count??28));
 const [targetSewer,setTargetSewer]=useState(String(targets.find(r=>r.segment_type==='SEWER')?.total_count??74));
 const [code,setCode]=useState(''),[status,setStatus]=useState('UNCLASSIFIED'),[notes,setNotes]=useState('');
 const refresh=()=>router.refresh();
 const total=(seg:Segment)=>targets.find(r=>r.segment_type===seg)?.total_count??(seg==='WATER'?28:74);
 const count=(seg:Segment)=>rows.filter(r=>r.segment_type===seg).length;
 async function saveTarget(seg:Segment){
  if(!editable)return;
  const raw=seg==='WATER'?targetWater:targetSewer;
  const n=Number(raw);
  if(!Number.isInteger(n)||n<0||n<count(seg)){setMessage('Total inválido: deve ser igual ou maior que o número de manchas cadastradas.');return;}
  const row=targets.find(r=>r.segment_type===seg),db=createClient();if(!db)return;
  setBusy(true);setMessage('');
  const result=row?await db.from('contract_stain_targets').update({total_count:n}).eq('id',row.id):await db.from('contract_stain_targets').insert({contract_id:contractId,segment_type:seg,total_count:n});
  setBusy(false);setMessage(result.error?result.error.message:'Total contratual atualizado.');if(!result.error)refresh();
 }
 async function saveNew(formData:FormData){
  if(!editable||busy)return;
  const normalized=String(formData.get('stain_code')??'').trim();
  if(!normalized){setMessage('Informe o identificador oficial da mancha.');return;}
  if(count(segment)>=total(segment)){setMessage('Todas as manchas do sistema já estão cadastradas. Ajuste o total somente se o contrato tiver sido revisado.');return;}
  const db=createClient();if(!db)return;
  setBusy(true);setMessage('');
  const {error}=await db.from('contract_stains').insert({contract_id:contractId,segment_type:segment,stain_code:normalized,municipality:selectedCity,status,notes:notes.trim()||null});
  setBusy(false);setMessage(error?error.message:'Mancha registrada e histórico preservado.');
  if(!error){setCode('');setNotes('');setStatus('UNCLASSIFIED');refresh();}
 }
 async function changeStatus(id:string,newStatus:string){
  if(!editable||busy||rows.some(row=>row.id===id&&row.engineering_project_id)){setMessage('A classificação desta mancha é atualizada na Engenharia.');return;}const db=createClient();if(!db)return;
  setBusy(true);setMessage('');
  const {error}=await db.from('contract_stains').update({status:newStatus}).eq('id',id);
  setBusy(false);setMessage(error?error.message:'Status atualizado; histórico registrado.');if(!error)refresh();
 }
 return <div className="sr-wrap">
  <p className="sr-description">Este cadastro alimenta os gráficos do Dashboard. Os projetos de Água que possuem correspondência individual com uma mancha estão vinculados à Engenharia e utilizam <strong>a classificação já registrada no projeto</strong>. As demais manchas são classificadas nesta página, sem duplicar lançamentos.</p>
  <div className="sr-targets">
   {(['WATER','SEWER'] as const).map(seg=><section className="sr-target" key={seg}>
    <h2>{seg==='WATER'?'Água':'Esgoto'}</h2><strong>{count(seg)} de {total(seg)}</strong><small>manchas identificadas</small>
    <p>{rows.filter(r=>r.segment_type===seg&&r.effective_status!=='UNCLASSIFIED').length} classificadas · {total(seg)-rows.filter(r=>r.segment_type===seg&&r.status!=='UNCLASSIFIED').length} pendentes de classificação</p>
    {editable&&<div className="sr-target-controls"><label>Total contratual<input type="number" min={count(seg)} max="10000" value={seg==='WATER'?targetWater:targetSewer} onChange={e=>seg==='WATER'?setTargetWater(e.target.value):setTargetSewer(e.target.value)}/></label><button disabled={busy} onClick={()=>void saveTarget(seg)}>Atualizar total</button></div>}
   </section>)}
  </div>
  {editable&&<section className="panel sr-form"><h2>Cadastrar mancha</h2><form action={saveNew} className="sr-fields">
   <label>Sistema<select value={segment} onChange={e=>setSegment(e.target.value as Segment)}><option value="WATER">Água</option><option value="SEWER">Esgoto</option></select></label>
   <label>Município<select value={selectedCity} onChange={e=>setSelectedCity(e.target.value)}>{cities.map(city=><option key={city}>{city}</option>)}</select></label>
   <label>Identificador oficial<input name="stain_code" required value={code} onChange={e=>setCode(e.target.value)} placeholder="Ex.: código da mancha"/></label>
   <label>Situação<select value={status} onChange={e=>setStatus(e.target.value)}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label className="sr-wide">Observação opcional<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1000}/></label>
   <button disabled={busy} type="submit">{busy?'Salvando…':'Cadastrar mancha'}</button>
  </form></section>}
  {message&&<p className="sr-message" role="status">{message}</p>}
  <section className="panel sr-records"><h2>Manchas registradas</h2><p>Os registros vinculados à Engenharia exibem inicialmente o nome do projeto como identificação. O código oficial da mancha ainda precisa ser conferido; não foram inventados códigos.</p>{rows.length===0?<p>Não há manchas individualizadas. Os totais contratuais estão cadastrados, mas os status ainda precisam ser informados.</p>:<div className="sr-table-scroll"><table><thead><tr><th>Sistema</th><th>Município</th><th>Mancha</th><th>Status</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.segment_type==='WATER'?'Água':'Esgoto'}</td><td>{row.municipality}</td><td>{row.stain_code}</td><td>{row.engineering_project_id?<div className="sr-linked"><strong>{labels[row.effective_status]??row.effective_status}</strong><small>Vinculada ao projeto {row.linked_project_name??row.stain_code}</small><Link href="/engenharia#engenharia-classificacao">Alterar na Engenharia →</Link></div>:editable?<select aria-label={'Status da mancha '+row.stain_code} value={row.effective_status} disabled={busy} onChange={e=>void changeStatus(row.id,e.target.value)}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>:labels[row.effective_status]??row.effective_status}</td></tr>)}</tbody></table></div>}</section>
  {history.length>0&&<section className="panel sr-history"><h2>Histórico de alterações</h2><ul>{history.filter(h=>rows.some(row=>row.id===h.stain_id)).slice(0,15).map(h=><li key={h.id}><b>{rows.find(row=>row.id===h.stain_id)?.stain_code}</b> — {h.old_status?(labels[h.old_status]??h.old_status)+' → ':''}{labels[h.new_status]??h.new_status} <small>{new Date(h.changed_at).toLocaleString('pt-BR')}</small></li>)}</ul></section>}
 </div>;
}
