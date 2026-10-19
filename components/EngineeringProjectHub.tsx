'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
import {municipalities,segments,type CurrentProject} from '@/lib/engineering';
import {projectReviewLabels,type ProjectReviewRow,type ProjectReviewStatus} from '@/lib/project-review-status';
import type {GisProjectRow} from '@/lib/gis-project-model';
import {deliveryNames,formatKm,fmt,responsibleNames,segmentNames,validMaterials,
 type ProjectManagementRow,type ProjectNetworkRow,type Responsible,type Delivery,type SegmentStatus} from '@/lib/engineering-unified-model';
import './engineering-project-hub.css';

type Group={id:string;code:string;city:string;neighborhood:string|null;members:{project:CurrentProject;gis:GisProjectRow}[]};
const statuses:ProjectReviewStatus[]=['UNCLASSIFIED','NO_OBJECTION','NO_OBJECTION_RESERVATIONS','IN_PREPARATION','IN_REVIEW','NOT_STARTED','CANCELLED'];
const released=(status:ProjectReviewStatus)=>status==='NO_OBJECTION'||status==='NO_OBJECTION_RESERVATIONS';
const blank=(value:number|null|undefined)=>value==null?'Não informado':fmt(value);
const toDate=()=>new Date().toLocaleDateString('en-CA');
function NetworkForm({projectId,initial,onSave,busy}:{
 projectId:string;initial?:ProjectNetworkRow;
 onSave:(id:string,originalId:string|null,data:FormData)=>Promise<void>;busy:boolean;
}){
 return <form key={initial?.id??projectId+'-new'} className="eph-network-form"
 action={async data=>{await onSave(projectId,initial?.id??null,data);}}>
  <label>Material<input name="material" list="eph-materials" required maxLength={50} defaultValue={initial?.material??'PEAD'}/></label>
  <label>Diâmetro (DE ou DN)<input name="diameter_label" required maxLength={35} placeholder="DE63 / DN150" defaultValue={initial?.diameter_label??''}/></label>
  <label>Tipo de trecho<input name="segment_kind" maxLength={100} defaultValue={initial?.segment_kind??''} placeholder="Distribuição, recalque…"/></label>
  <label>Extensão (m)<input name="length_m" type="number" required min="0.001" max="99999999999.999" step="0.001" defaultValue={initial?Number(initial.length_m):''}/></label>
  <label>Situação técnica<select name="segment_status" defaultValue={initial?.segment_status??'PROJECTED'}>
   {Object.entries(segmentNames).map(([key,label])=><option value={key} key={key}>{label}</option>)}
  </select></label>
  <label className="eph-wide">Observações<input name="notes" maxLength={2000} defaultValue={initial?.notes??''}/></label>
  <button type="submit" disabled={busy}>{busy?'Salvando…':initial?'Salvar alterações do trecho':'Adicionar trecho'}</button>
 </form>;
}
function ProjectHistory({projectId}:{projectId:string}){
 const [events,setEvents]=useState<{id:string;kind:string;date:string;description:string}[]|null>(null);
 const [error,setError]=useState('');
 async function load(){
  if(events!==null)return;
  const db=createClient();if(!db){setError('Conexão indisponível.');return;}
  const [reviews,manager,segments,technical]=await Promise.all([
   db.from('engineering_project_review_history').select('id,new_status,changed_at').eq('engineering_project_id',projectId).order('changed_at',{ascending:false}).limit(20),
   db.from('engineering_project_management_history').select('id,new_data,changed_at').eq('engineering_project_id',projectId).order('changed_at',{ascending:false}).limit(20),
   db.from('engineering_project_network_segments_history').select('id,new_data,changed_at').eq('engineering_project_id',projectId).order('changed_at',{ascending:false}).limit(30),
   db.from('engineering_project_updates').select('id,reference_date,created_at').eq('engineering_project_id',projectId).order('created_at',{ascending:false}).limit(20)
  ]);
  if([reviews,manager,segments,technical].some(r=>r.error)){setError('Não foi possível carregar todo o histórico.');return;}
  type Snapshot={responsible?:string|null;delivery_status?:string|null;material?:string;diameter_label?:string;length_m?:number;active?:boolean;segment_status?:string};
  const summary:typeof events=[];
  for(const r of reviews.data??[])summary.push({id:'status-'+r.id,kind:'Situação do projeto',date:r.changed_at,
    description:projectReviewLabels[r.new_status as ProjectReviewStatus]??String(r.new_status)});
  for(const r of manager.data??[]){const v=r.new_data as Snapshot;summary.push({id:'gestao-'+r.id,kind:'Responsável e entrega',date:r.changed_at,
    description:(v.responsible==='VITALUX'?'Vitalux':v.responsible==='ESTATICA'?'Estática':'Não atribuído')+
      ' · '+(deliveryNames[v.delivery_status as Delivery]??'Entrega não informada')});}
  for(const r of segments.data??[]){const v=r.new_data as Snapshot;summary.push({id:'trecho-'+r.id,kind:'Composição da rede',date:r.changed_at,
    description:(v.material??'')+' '+(v.diameter_label??'')+' · '+fmt(Number(v.length_m??0))+' m · '+(v.active===false?'Desativado':segmentNames[v.segment_status as SegmentStatus]??'Atualizado')});}
  for(const r of technical.data??[])summary.push({id:'tecnico-'+r.id,kind:'Lançamento técnico',date:r.created_at,
    description:'Referência '+new Date(r.reference_date+'T12:00:00').toLocaleDateString('pt-BR')});
  summary.sort((a,b)=>b.date.localeCompare(a.date));
  setEvents(summary.slice(0,60));
 }
 return <details className="eph-history" onToggle={e=>{if(e.currentTarget.open)void load()}}>
  <summary>Consultar histórico de alterações do projeto</summary>
  {error&&<p role="alert">{error}</p>}
  {events?.length===0&&<p>Nenhuma alteração registrada.</p>}
  {events?.map(ev=><div key={ev.id}><strong>{ev.kind}</strong><span>{ev.description}</span><small>{new Date(ev.date).toLocaleString('pt-BR')}</small></div>)}
 </details>;
}
export function EngineeringProjectHub({projects,gis,reviews,management,network,canEdit}:{
 projects:CurrentProject[];gis:GisProjectRow[];reviews:ProjectReviewRow[];
 management:ProjectManagementRow[];network:ProjectNetworkRow[];canEdit:boolean;
}){
 const router=useRouter();
 const [search,setSearch]=useState('');
 const [openCode,setOpenCode]=useState<string|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [retire,setRetire]=useState<string|null>(null);
 const [statusesLocal,setStatusesLocal]=useState<Record<string,ProjectReviewStatus>>({});
 const reviewed=new Map(reviews.map(row=>[row.engineering_project_id,row.status]));
 const controls=new Map(management.map(row=>[row.engineering_project_id,row]));
 const segMap=new Map<string,ProjectNetworkRow[]>();
 for(const part of network.filter(row=>row.active)){
  const prev=segMap.get(part.engineering_project_id)??[];
  prev.push(part);segMap.set(part.engineering_project_id,prev);
 }
 const statusOf=(id:string):ProjectReviewStatus=>statusesLocal[id]??reviewed.get(id)??'UNCLASSIFIED';
 const ids=new Set(projects.map(p=>p.id));
 const projectById=new Map(projects.map(p=>[p.id,p]));
 const groups=new Map<string,Group>();
 for(const row of gis){
  if(!row.engineering_project_id||!ids.has(row.engineering_project_id))continue;
  const project=projectById.get(row.engineering_project_id)!;
  const prev=groups.get(row.id)??{id:row.id,code:row.gis_code,city:row.municipality,neighborhood:row.neighborhood,members:[]};
  prev.members.push({project,gis:row});
  groups.set(row.id,prev);
 }
 const allGroups=[...groups.values()];
 const matching=allGroups.filter(g=>[g.code,g.city,g.neighborhood??'',...g.members.map(m=>m.project.project_name)].join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
   .sort((a,b)=>municipalities.indexOf(a.city as typeof municipalities[number])-municipalities.indexOf(b.city as typeof municipalities[number])||a.code.localeCompare(b.code));
 const sumParts=(p:CurrentProject,kind:'ALL'|'APPROVED'|'EXECUTED')=>{
  const parts=segMap.get(p.id)??[];
  return parts.filter(part=>kind==='ALL'||(kind==='APPROVED'&&part.segment_status!=='PROJECTED')||(kind==='EXECUTED'&&part.segment_status==='EXECUTED'))
   .reduce((sum,part)=>sum+Number(part.length_m),0);
 };
 const recorded=(rows:CurrentProject[],status:'ALL'|'APPROVED'|'EXECUTED')=>rows.reduce((sum,p)=>sum+sumParts(p,status),0);
 const managed=(p:CurrentProject)=>controls.get(p.id);
 const delivery=(p:CurrentProject)=>managed(p)?.delivery_status??p.current?.delivery_status??null;
 const onlyAvailable=projects.filter(p=>statusOf(p.id)!=='CANCELLED');
 const releasedProjects=onlyAvailable.filter(p=>released(statusOf(p.id)));
 const totalApproved=recorded(releasedProjects,'APPROVED');
 const approvedEconomies=(list:CurrentProject[])=>list.reduce((n,p)=>n+(p.current?.approved_economies??0),0);
 const missingApprovedEconomies=(list:CurrentProject[])=>list.filter(p=>p.current?.approved_economies==null).length;
 const responsibility=(owner:Responsible|null)=>{
  const subset=onlyAvailable.filter(p=>(managed(p)?.responsible??null)===owner);
  return {count:subset.length,economies:approvedEconomies(subset.filter(p=>released(statusOf(p.id)))),approved:recorded(subset.filter(p=>released(statusOf(p.id))),'APPROVED'),
   projected:recorded(subset,'ALL'),completed:subset.filter(p=>delivery(p)==='COMPLETED').length,
   progress:subset.filter(p=>delivery(p)==='IN_PROGRESS').length,notStarted:subset.filter(p=>delivery(p)==='NOT_STARTED').length,
   noDelivery:subset.filter(p=>delivery(p)==null).length};
 };
 const citySummary=municipalities.map(city=>{
  const cityProjects=onlyAvailable.filter(p=>p.municipality===city);
  const water=cityProjects.filter(p=>p.segment_type==='WATER'),sewer=cityProjects.filter(p=>p.segment_type==='SEWER');
  const cityGis=new Map(gis.filter(row=>row.municipality===city&&!row.cancelled).map(row=>[row.id,row])).size;
  const releasedProjects=cityProjects.filter(p=>released(statusOf(p.id)));
  return {city,count:cityGis,water:water.length,sewer:sewer.length,
   projected:recorded(cityProjects,'ALL'),approved:recorded(releasedProjects,'APPROVED'),
   executed:recorded(cityProjects,'EXECUTED'),
   economiesWater:water.reduce((a,p)=>a+(gis.find(g=>g.engineering_project_id===p.id)?.economies_ica??0),0),
   economiesSewer:sewer.reduce((a,p)=>a+(gis.find(g=>g.engineering_project_id===p.id)?.economies_ice??0),0),
   economiesApproved:approvedEconomies(releasedProjects)};
 });
 async function dbUser(){
  const db=createClient();if(!db)throw Error('Conexão indisponível.');
  const {data:{user}}=await db.auth.getUser();if(!user)throw Error('Sessão expirada. Entre novamente.');
  return {db,user};
 }
 async function mutation(run:()=>Promise<void>){
  if(!canEdit||busy)return;
  setBusy(true);setMessage('');
  try{await run();setMessage('Registro salvo com histórico.');router.refresh();}
  catch(error){setMessage(error instanceof Error?error.message:'Erro ao salvar.');}
  finally{setBusy(false);}
 }
 function assertResponse(result:{error:{message:string}|null}){if(result.error)throw Error('Não foi possível salvar: '+result.error.message);}
 async function saveStatus(p:CurrentProject,status:ProjectReviewStatus,g:GisProjectRow){
  if(g.cancelled||!canEdit)return;
  await mutation(async()=>{
   const {db,user}=await dbUser();
   const result=await db.from('engineering_project_review_status').upsert(
    {engineering_project_id:p.id,status,updated_by:user.id},{onConflict:'engineering_project_id'});
   assertResponse(result);
   setStatusesLocal(previous=>({...previous,[p.id]:status}));
  });
 }
 async function saveManagement(projectId:string,form:FormData){
  await mutation(async()=>{
   const {db,user}=await dbUser();
   const responsible=String(form.get('responsible')??'') as Responsible|'';
   const delivery_status=String(form.get('delivery_status')??'') as Delivery|'';
   const notes=String(form.get('notes')??'').trim();
   const result=await db.from('engineering_project_management').upsert({
    engineering_project_id:projectId,responsible:responsible||null,delivery_status:delivery_status||null,
    notes:notes||null,updated_by:user.id
   },{onConflict:'engineering_project_id'});
   assertResponse(result);
  });
 }
 async function saveSegment(projectId:string,originalId:string|null,form:FormData){
  await mutation(async()=>{
   const {db,user}=await dbUser();
   const material=String(form.get('material')??'').trim().toUpperCase();
   const diameter_label=String(form.get('diameter_label')??'').trim().toUpperCase();
   const length=Number(form.get('length_m'));
   if(!material||!diameter_label||!Number.isFinite(length)||length<=0||length>99999999999.999)throw Error('Confira material, diâmetro e extensão positiva.');
   const payload={material,diameter_label,length_m:length,
    segment_kind:String(form.get('segment_kind')??'').trim()||null,
    notes:String(form.get('notes')??'').trim()||null,
    segment_status:String(form.get('segment_status')) as SegmentStatus,updated_by:user.id};
   const result=originalId
    ?await db.from('engineering_project_network_segments').update(payload).eq('id',originalId).eq('engineering_project_id',projectId)
    :await db.from('engineering_project_network_segments').insert({...payload,engineering_project_id:projectId,source:'MANUAL'});
   assertResponse(result);
  });
 }
 async function retireSegment(part:ProjectNetworkRow){
  await mutation(async()=>{const {db}=await dbUser();
   assertResponse(await db.from('engineering_project_network_segments').update({active:false}).eq('id',part.id));
   setRetire(null);
  });
 }
 async function saveTechnical(p:CurrentProject,form:FormData){
  await mutation(async()=>{
   const {db}=await dbUser();
   const c=p.current,con=String(form.get('concept_status')??''),exe=String(form.get('executive_status')??'');
   const conDate=String(form.get('concept_approved_at')??''),exeDate=String(form.get('executive_completed_at')??'');
   const economyText=String(form.get('approved_economies')??'').trim();
   const economy=economyText===''?null:Number(economyText);
   if(economy!==null&&(!Number.isInteger(economy)||economy<0))throw Error('Informe economias aprovadas como número inteiro não negativo.');
   if(con==='APPROVED'&&!conDate||exe==='COMPLETED'&&!exeDate)throw Error('Informe a data dos documentos aprovados/concluídos.');
   assertResponse(await db.from('engineering_project_updates').insert({
    engineering_project_id:p.id,reference_date:toDate(),
    concept_status:con||null,concept_approved_at:con==='APPROVED'?conDate:null,
    executive_status:exe||null,executive_completed_at:exe==='COMPLETED'?exeDate:null,
    approved_economies:economy,approved_length_m:c?.approved_length_m??null,
    pead_de63_length_m:c?.pead_de63_length_m??null,pead_de110_length_m:c?.pead_de110_length_m??null,
    delivery_status:c?.delivery_status??null,notes:c?.notes??null
   }));
  });
 }
 const owners=([['VITALUX','Vitalux'],['ESTATICA','Estática'],[null,'Não atribuído']] as const);
 return <section className="eph" id="engenharia-projetos">
  <datalist id="eph-materials">{validMaterials.map(m=><option key={m} value={m}/>)}</datalist>
  <div className="eph-heading"><div><span className="water-linear-eyebrow">CADASTRO ÚNICO · ENGENHARIA</span><h2>Projetos, redes e entregas</h2>
   <p>Cada código GIS abre um cadastro com Água e/ou Esgoto. O detalhamento técnico pertence ao projeto e pode ter vários materiais, diâmetros e extensões.</p></div></div>
  <div className="eph-topmetrics">
   <article><span>Rede projetada cadastrada</span><strong>{formatKm(recorded(onlyAvailable,'ALL'))}</strong><small>Trechos informados por material e diâmetro</small></article>
   <article><span>Rede aprovada e liberada</span><strong>{formatKm(totalApproved)}</strong><small>Status Sem objeção ou S/Obj. com ressalvas</small></article>
   <article><span>Rede executada informada</span><strong>{formatKm(recorded(onlyAvailable,'EXECUTED'))}</strong><small>Somente trechos marcados como executados</small></article>
   <article><span>Economias técnicas liberadas</span><strong>{fmt(approvedEconomies(releasedProjects))}</strong><small>{missingApprovedEconomies(releasedProjects)?'Parcial · '+missingApprovedEconomies(releasedProjects)+' projetos sem quantidade informada':'Soma de projetos liberados por status'}</small></article>
  </div>
  <div className="eph-split">
   {owners.map(([owner,label])=>{const s=responsibility(owner);return <article key={owner??'none'} className="panel eph-owner">
    <h3>{label}</h3><strong>{s.count} <small>projetos atribuídos</small></strong>
    <p>Economias técnicas liberadas: <b>{fmt(s.economies)}</b></p><p>Rede projetada: <b>{formatKm(s.projected)}</b></p><p>Rede liberada: <b>{formatKm(s.approved)}</b></p>
    <p>Finalizados: {s.completed} · Em andamento: {s.progress}</p>
    <small>A iniciar: {s.notStarted} · Sem entrega informada: {s.noDelivery}</small>
   </article>})}
  </div>
  <section id="engenharia-municipios" className="eph-city"><h3>Visão por município</h3>
   <div className="eph-cities">
   {citySummary.map(c=><article className="panel" key={c.city}>
    <h4>{c.city}</h4><p><b>{c.count}</b> manchas · <b>{c.water}</b> Água · <b>{c.sewer}</b> Esgoto</p>
    <div><span>Economias estimadas Água / Esgoto</span><b>{fmt(c.economiesWater)} / {fmt(c.economiesSewer)}</b></div>
    <div><span>Economias técnicas liberadas</span><b>{fmt(c.economiesApproved)}</b></div>
    <div><span>Rede projetada cadastrada</span><b>{formatKm(c.projected)}</b></div>
    <div><span>Rede aprovada e liberada</span><b>{formatKm(c.approved)}</b></div>
    <div><span>Rede executada informada</span><b>{formatKm(c.executed)}</b></div>
   </article>)}
   </div>
  </section>
  <section className="eph-register" aria-label="Relação e edição dos projetos">
   <div className="eph-search"><div><h3>Cadastro dos projetos</h3><p>Abra um código GIS para registrar responsáveis, aprovações e trechos de Água ou Esgoto.</p></div>
    <label>Localizar código, bairro ou cidade<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por GIS, bairro ou cidade"/></label>
   </div>
   <p className="eph-count">{matching.length} códigos GIS encontrados</p>
   {matching.map(g=><article key={g.id} className="panel eph-project">
    <button className="eph-project-toggle" type="button" onClick={()=>setOpenCode(openCode===g.id?null:g.id)} aria-expanded={openCode===g.id}>
     <span><strong>{g.code}</strong> <small>{g.city} · {g.neighborhood??'Bairro não informado'}</small></span>
     <span>{g.members.map(m=>segments[m.project.segment_type]).join(' + ')} <b>{openCode===g.id?'−':'+'}</b></span>
    </button>
    {openCode===g.id&&<div className="eph-members">
     {g.members.map(({project:p,gis:record})=>{
      const parts=segMap.get(p.id)??[],manager=controls.get(p.id),status=statusOf(p.id);
      const economy=p.segment_type==='WATER'?record.economies_ica:record.economies_ice;
      return <div className="eph-member" key={p.id}>
       <div className="eph-member-heading"><h4>{segments[p.segment_type]} · {p.project_name}</h4><span>{record.cancelled?'Cancelada':projectReviewLabels[status]}</span></div>
       <div className="eph-info">
        <span>Economias GIS estimadas: <b>{blank(economy)}</b></span>
        <span>Economias aprovadas: <b>{blank(p.current?.approved_economies)}</b></span>
        <span>Rede aprovada: <b>{formatKm(sumParts(p,'APPROVED'))}</b></span>
        <span>Rede projetada: <b>{formatKm(sumParts(p,'ALL'))}</b></span>
       </div>
       <div className="eph-fieldset">
        <label>Situação do projeto
         <select value={status} disabled={!canEdit||busy||record.cancelled} onChange={e=>void saveStatus(p,e.target.value as ProjectReviewStatus,record)}>
          {statuses.map(k=><option key={k} value={k}>{projectReviewLabels[k]}</option>)}
         </select></label>
        <form action={async data=>{await saveManagement(p.id,data)}} className="eph-management">
         <label>Responsável
          <select name="responsible" disabled={!canEdit||busy||record.cancelled} defaultValue={manager?.responsible??''} key={'owner'+p.id+(manager?.responsible??'')}>
           <option value="">Não atribuído</option><option value="VITALUX">Vitalux</option><option value="ESTATICA">Estática</option>
          </select></label>
         <label>Situação da entrega
          <select name="delivery_status" disabled={!canEdit||busy||record.cancelled} defaultValue={manager?.delivery_status??p.current?.delivery_status??''} key={'delivery'+p.id+(manager?.delivery_status??'')}>
           <option value="">Não informado</option>{Object.entries(deliveryNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select></label>
         <label className="eph-note">Observação gerencial<input name="notes" maxLength={2000} disabled={!canEdit||busy||record.cancelled} defaultValue={manager?.notes??''}/></label>
         {canEdit&&!record.cancelled&&<button disabled={busy} type="submit">Salvar responsável e entrega</button>}
        </form>
       </div>
       <details className="eph-technical"><summary>Aprovação técnica e economias</summary>
        <p>Separado do status de liberação. Campos sem informação permanecem em aberto.</p>
        <form action={async data=>{await saveTechnical(p,data)}} className="eph-technical-form">
         <label>Economias aprovadas<input name="approved_economies" type="number" min="0" step="1" defaultValue={p.current?.approved_economies??''} disabled={!canEdit||busy}/></label>
         <label>Concepção<select name="concept_status" defaultValue={p.current?.concept_status??''} disabled={!canEdit||busy}><option value="">Não informada</option><option value="PENDING">Pendente</option><option value="IN_PROGRESS">Em andamento</option><option value="APPROVED">Aprovada</option></select></label>
         <label>Data aprovação concepção<input name="concept_approved_at" type="date" defaultValue={p.current?.concept_approved_at??''} disabled={!canEdit||busy}/></label>
         <label>Projeto executivo<select name="executive_status" defaultValue={p.current?.executive_status??''} disabled={!canEdit||busy}><option value="">Não informado</option><option value="PENDING">Pendente</option><option value="IN_PROGRESS">Em andamento</option><option value="COMPLETED">Finalizado</option></select></label>
         <label>Data conclusão executivo<input name="executive_completed_at" type="date" defaultValue={p.current?.executive_completed_at??''} disabled={!canEdit||busy}/></label>
         {canEdit&&!record.cancelled&&<button disabled={busy}>Salvar dados técnicos</button>}
        </form>
       </details>
       <div className="eph-network">
        <div className="eph-network-header"><h5>Trechos de rede · material, diâmetro e metragem</h5>
         <small>{parts.length} trechos · {formatKm(sumParts(p,'ALL'))} cadastrados</small>
        </div>
        {parts.length>0?<div className="eph-segment-list">{parts.map(part=><details key={part.id}>
         <summary><strong>{part.material} {part.diameter_label}</strong><span>{fmt(Number(part.length_m))} m · {segmentNames[part.segment_status]}</span></summary>
         {part.source==='LEGACY'&&<p className="eph-legacy">Registro migrado de Obras Lineares; o histórico técnico anterior foi preservado.</p>}
         {canEdit&&!record.cancelled?<><NetworkForm projectId={p.id} initial={part} onSave={saveSegment} busy={busy}/>
          {part.source==='MANUAL'&&<div className="eph-retire">
           {retire===part.id?<><span>Confirmar desativação do trecho? O histórico será mantido.</span><button disabled={busy} onClick={()=>void retireSegment(part)}>Confirmar</button><button type="button" onClick={()=>setRetire(null)}>Cancelar</button></>
           :<button type="button" onClick={()=>setRetire(part.id)}>Desativar trecho</button>}
          </div>}</>:<p>{part.segment_kind??'Rede'} · {part.notes??'Sem observações'}</p>}
        </details>)}</div>:<p>Nenhum trecho informado. A metragem não será estimada automaticamente.</p>}
        {canEdit&&!record.cancelled&&<details className="eph-add"><summary>+ Adicionar material, diâmetro e extensão</summary><NetworkForm projectId={p.id} onSave={saveSegment} busy={busy}/></details>}
       </div>
       <ProjectHistory projectId={p.id}/>
      </div>;
     })}
    </div>}
   </article>)}
   {!matching.length&&<p>Não foram encontrados projetos para os filtros.</p>}
  </section>
  {message&&<p className="eph-feedback" role="status">{message}</p>}
 </section>;
}
