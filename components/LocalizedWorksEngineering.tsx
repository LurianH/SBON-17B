'use client';

import {useMemo, useRef, useState, useSyncExternalStore} from 'react';
import './localized-works-engineering.css';
import {getLocalizedDraftSnapshot, localizedDraftServerSnapshot, subscribeLocalizedDraft, readLocalizedDraft, writeLocalizedDraft, parseLocalizedDraftWorks} from '@/lib/localized-works-drafts';
import {attackPlan2026} from '@/lib/attack-plan-2026';
import {canWriteEngineering, type Project} from '@/lib/engineering';
import {resolveEngineeringProjectLinks} from '@/lib/engineering-project-links';
import {localizedPayload, localizedRecordFromDatabase, localizedToday, localizedPhysicalLabels,
 type LocalizedFormRecord, type LocalizedWorkRow, type LocalizedUpdateRow} from '@/lib/localized-works-model';
import {LOCALIZED_DATABASE_ENABLED, saveNewLocalizedWork, saveLocalizedWorkUpdate, listLocalizedWorkHistory, listLocalizedWorksForContract} from '@/lib/localized-works-remote';

type Kind = 'RESERVOIR'|'BOOSTER'|'EEE';
type Status = 'NOT_STARTED'|'IN_PROGRESS'|'COMPLETED'|'APPROVED';
type Budget = 'NOT_BUDGETED'|'IN_PREPARATION'|'BUDGETED'|'UNDER_REVIEW'|'APPROVED';
type RecordWork = LocalizedFormRecord;
const cities = ['Porangaba','Quadra','Tatuí','Conchas','Pereiras'];
const kindLabels:Record<Kind,string> = {RESERVOIR:'Reservatório',BOOSTER:'Booster',EEE:'EEE'};
const statusLabels:Record<Status,string> = {NOT_STARTED:'Não iniciado',IN_PROGRESS:'Em andamento',COMPLETED:'Finalizado',APPROVED:'Aprovado'};
const budgetLabels:Record<Budget,string> = {NOT_BUDGETED:'Sem orçamento',IN_PREPARATION:'Em elaboração',BUDGETED:'Orçado',UNDER_REVIEW:'Em análise',APPROVED:'Aprovado'};
const empty:RecordWork={id:'',name:'',city:'Porangaba',stain:'',kind:'RESERVOIR',units:'1',capacity:'',material:'',power:'',flow:'',hmt:'',hydraulic:'NOT_STARTED',electrical:'NOT_STARTED',structural:'NOT_STARTED',budget:'NOT_BUDGETED',contractualCode:'',notes:''};
const initial:RecordWork[]=[
 {...empty,id:'ref-alto',name:'Booster Alto da Serra',stain:'553_AR_0002N',kind:'BOOSTER',flow:'0.4',hmt:'28',notes:'Informação de referência de projeto; aprovação e potência pendentes.'},
 {...empty,id:'ref-saojoao',name:'Booster São João',stain:'553_AF_292',kind:'BOOSTER',notes:'Referência de planejamento; completar dados técnicos.'},
 {...empty,id:'ref-vidas',name:'Reservação Vidas Novas / Núcleo Santino',kind:'RESERVOIR',notes:'Reservação em estudo; capacidade definitiva pendente.'},
];
export function LocalizedWorksEngineering({role,contractId,projects,initialWorks=[],notice='',readOnly=false}:{
 role:string|null;contractId:string|null;projects:Project[];initialWorks?:LocalizedWorkRow[];notice?:string;readOnly?:boolean;
}){
 const canEdit=canWriteEngineering(role)&&Boolean(contractId)&&!readOnly;
 const available=!LOCALIZED_DATABASE_ENABLED||Boolean(contractId)&&!notice;
 const persistedIds=new Set(initialWorks.map(w=>w.id));
 const [loadedIds,setLoadedIds]=useState<string[]>([]);
 const isPersisted=(id:string)=>LOCALIZED_DATABASE_ENABLED&&(persistedIds.has(id)||loadedIds.includes(id));
 const saving=useRef(false);
 const [busy,setBusy]=useState(false);
 const [remoteHistory,setRemoteHistory]=useState<LocalizedUpdateRow[]>([]);
 const [historyWork,setHistoryWork]=useState<RecordWork|null>(null),[historyMore,setHistoryMore]=useState(false);
 const [historyBusy,setHistoryBusy]=useState(false),[historyError,setHistoryError]=useState('');
 const [remoteRows,setRemoteRows]=useState<RecordWork[]>(()=>initialWorks.map(localizedRecordFromDatabase)),[editing,setEditing]=useState<RecordWork|null>(null),[message,setMessage]=useState(''),[filter,setFilter]=useState<'ALL'|Kind>('ALL');
 const [history,setHistory]=useState<Array<{key:string;name:string;action:string;at:string}>>([]);
 const [showHistory,setShowHistory]=useState(false);
 const fileInput=useRef<HTMLInputElement|null>(null);
 // The browser draft is an external store; central data never overwrites it.
 const draftSnapshot=useSyncExternalStore(subscribeLocalizedDraft,getLocalizedDraftSnapshot,localizedDraftServerSnapshot);
 const draftRows=useMemo(()=>readLocalizedDraft(draftSnapshot,initial),[draftSnapshot]);
 const rows=LOCALIZED_DATABASE_ENABLED?remoteRows:draftRows;
 function replaceRows(next:RecordWork[]){
  if(LOCALIZED_DATABASE_ENABLED)setRemoteRows(next);
  else writeLocalizedDraft(next);
 }
 const visible=rows.filter(r=>filter==='ALL'||r.kind===filter);
 const planOptions=editing ? attackPlan2026.filter(r=>r.municipality===editing.city && (editing.kind==='EEE'?r.segment==='SEWER':r.segment==='WATER')) : [];
 const selectedPlan=planOptions.find(r=>r.rowKey===editing?.planRowKey) ?? (editing?.planRowKey ? undefined : (planOptions.filter(r=>r.stainId===editing?.stain).length===1 ? planOptions.find(r=>r.stainId===editing?.stain) : undefined));
 const sameIdOptions=selectedPlan ? planOptions.filter(r=>r.stainId===selectedPlan.stainId) : [];

 function exportBackup(){
  const payload={format:'sbon17b-localized-works-preview',version:1,exportedAt:new Date().toISOString(),works:rows,sessionHistory:history};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download=`SBON17B-obras-localizadas-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  setMessage('Arquivo de segurança gerado. Guarde-o em local seguro.');
 }
 async function importBackup(file:File){
  if(!canEdit){setMessage('Perfil sem permissão de cadastro.');return;}
  if(LOCALIZED_DATABASE_ENABLED){setMessage('Importe rascunhos somente antes da liberação do cadastro central.');return;}
  if(file.size>1024*1024){setMessage('Arquivo excede o limite de 1 MB.');return;}
  try {
   const parsed:unknown=JSON.parse(await file.text());
   if(!parsed||typeof parsed!=='object')throw new Error('Formato inválido.');
   const archive=parsed as {format?:unknown;version?:unknown;works?:unknown};
   if(archive.format!=='sbon17b-localized-works-preview'||archive.version!==1||!Array.isArray(archive.works)||archive.works.length>2000)throw new Error('Arquivo incompatível com esta versão.');
   const values=parseLocalizedDraftWorks(archive.works);
   replaceRows(values);setHistory([]);setEditing(null);
   setMessage(`${values.length} registros importados apenas para esta aba. Não houve gravação no Supabase.`);
  }catch(error){setMessage(error instanceof Error?`Importação rejeitada: ${error.message}`:'Arquivo inválido.');}
 }
 const update=(key:keyof RecordWork,value:string)=>setEditing(old=>old?{...old,[key]:value}:null);
 const counts=(kind:Kind)=>rows.filter(r=>r.kind===kind).length;
 async function readHistory(work:RecordWork,append=false){
  if(historyBusy)return;
  setHistoryBusy(true);setHistoryError('');
  if(!append){setHistoryWork(work);setRemoteHistory([]);setHistoryMore(false);}
  try{
   const page=await listLocalizedWorkHistory(work.id,append?remoteHistory.length:0);
   setRemoteHistory(old=>append?[...old,...page.rows]:page.rows);setHistoryMore(page.hasMore);
  }catch(error){setHistoryError(error instanceof Error?error.message:'Erro ao consultar histórico.');}
  finally{setHistoryBusy(false);}
 }
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!editing||saving.current)return;
  if(!canEdit||!available){setMessage('Cadastro indisponível para este perfil ou ambiente.');return;}
  if(!selectedPlan){setMessage('Selecione uma frente do município e sistema desta estrutura.');return;}
  if(sameIdOptions.length>1&&!editing.planRowKey){setMessage('Selecione explicitamente a frente para este ID repetido.');return;}
  const selected={...editing,planRowKey:selectedPlan.rowKey,stain:selectedPlan.stainId,city:selectedPlan.municipality};
  let payload:ReturnType<typeof localizedPayload>;
  try{
   payload=localizedPayload(selected);
   if(selected.engineeringProjectId&&!isPersisted(selected.id)){
    const project=projects.find(p=>p.id===selected.engineeringProjectId);
    if(!project||!project.active||project.contract_id!==contractId||project.municipality!==selected.city||project.segment_type!==selectedPlan.segment)
     throw new Error('Projeto incompatível com contrato, município ou sistema.');
   }
  }catch(error){setMessage(error instanceof Error?`Validação: ${error.message}`:'Dados inválidos.');return;}
  if(LOCALIZED_DATABASE_ENABLED){
   saving.current=true;setBusy(true);
   let committed=false;
   try{
    if(isPersisted(selected.id))await saveLocalizedWorkUpdate(selected.id,payload.update);
    else await saveNewLocalizedWork(payload.work,payload.update);
    committed=true;setEditing(null);
    const works=await listLocalizedWorksForContract(contractId!);
    replaceRows(works.map(localizedRecordFromDatabase));setLoadedIds(works.map(w=>w.id));
    setHistoryWork(null);setRemoteHistory([]);
    setMessage('Registro salvo. Cadastro e histórico permanente atualizados.');
   }catch(error){
    const detail=error instanceof Error?error.message:'Falha na conexão.';
    setMessage(committed?`Registro salvo, mas a consulta não pôde ser atualizada. Recarregue a página. ${detail}`:detail);
   }finally{saving.current=false;setBusy(false);}
   return;
  }
  const existed=rows.some(r=>r.id===selected.id);
  const saved={...selected,name:selected.name.trim()};
  try{replaceRows(rows.some(r=>r.id===saved.id)?rows.map(r=>r.id===saved.id?saved:r):[...rows,{...saved,id:`local-${crypto.randomUUID()}`}]);}
  catch{setMessage('Não foi possível gravar o rascunho neste navegador. Exporte os registros antes de continuar.');return;}
  setHistory(h=>[{key:crypto.randomUUID(),name:saved.name,action:existed?'Edição validada':'Cadastro validado',at:new Date().toLocaleString('pt-BR')},...h]);
  setEditing(null);setMessage('Rascunho salvo neste navegador. Cadastro central aguardando liberação.');
 }
 const editingPersisted=Boolean(editing&&isPersisted(editing.id));
 const eligibleProjects=selectedPlan?projects.filter(p=>p.active&&p.contract_id===contractId&&p.municipality===selectedPlan.municipality&&p.segment_type===selectedPlan.segment):[];
 const suggestedLink=selectedPlan&&contractId?resolveEngineeringProjectLinks(projects,contractId).find(r=>r.rowKey===selectedPlan.rowKey):null;
 function prepareEquipment(work:RecordWork){
  const specs:Record<string,{power:string;flow:string;hmt:string;notes:string}>={
   'EEE 1':{power:'25.15',flow:'3.33',hmt:'50.07',notes:'EEE 01 — Ypê I · Kronox BE06R 18,5 kW; bomba em linha, rotor vortex cônico; configuração 1 operante + 1 reserva (1+1R).'},
   'EEE':{power:'29.91',flow:'3.89',hmt:'51.61',notes:'EEE 02 — Ypê I · Kronox BE06H 22 kW; bomba em linha, rotor vortex cônico; configuração 1 operante + 1 reserva (1+1R).'},
   'EEE 2':{power:'29.91',flow:'3.89',hmt:'51.61',notes:'EEE 02 — Ypê I · Kronox BE06H 22 kW; bomba em linha, rotor vortex cônico; configuração 1 operante + 1 reserva (1+1R).'},
   'EEE Ypê II 2':{power:'40.79',flow:'10.56',hmt:'54.29',notes:'EEE 04 — Ypê II · Kronox BE06H 30 kW; bomba em linha, rotor vortex cônico; configuração 1 operante + 1 reserva (1+1R).'},
   'Booster São João':{power:'2',flow:'1.210',hmt:'31',notes:'Booster São João — valores de projeto informados: 1,210 L/s, 31 mca, 2 CV.'}
  };
  const spec=work.name==='EEE 1'&&work.stain==='553_AF_91'
   ?{power:'2.04',flow:'1.39',hmt:'13.98',notes:'EEE 03 — Ypê II · Kronox BE01 1,5 kW; bomba em linha, rotor vortex cônico; configuração 1 operante + 1 reserva (1+1R).'}
   :work.name==='EEE'&&work.stain==='553_AF_92'
   ?specs['EEE 1']
   :work.name==='EEE 2'&&work.stain==='553_AF_92'
   ?specs['EEE 2']
   :specs[work.name];
  if(!spec){openRecord(work);return;}
  openRecord({...work,power:spec.power,flow:spec.flow,hmt:spec.hmt,notes:[work.notes,spec.notes].filter(Boolean).join(' | ')});
 }

 const [batchConfirm,setBatchConfirm]=useState(false);
 async function applyTechnicalBatch(){
  if(!canEdit||!contractId||!LOCALIZED_DATABASE_ENABLED||saving.current)return;
  saving.current=true;setBusy(true);setMessage('Conferindo cadastro atual antes de gravar…');
  try{
   const fresh=await listLocalizedWorksForContract(contractId);
   const records=fresh.map(localizedRecordFromDatabase);
   const identify=(stain:string,name:string)=>records.filter(r=>r.kind==='EEE'&&r.stain===stain&&r.name===name);
   const specs=[
    {stain:'553_AF_92',name:'EEE',power:'25.15',flow:'3.33',hmt:'50.07',label:'EEE 01 — Ypê I; Kronox BE06R, 18,5 kW'},
    {stain:'553_AF_92',name:'EEE 2',power:'29.91',flow:'3.89',hmt:'51.61',label:'EEE 02 — Ypê I; Kronox BE06H, 22 kW'},
    {stain:'553_AF_91',name:'EEE 1',power:'2.04',flow:'1.39',hmt:'13.98',label:'EEE 03 — Ypê II; Kronox BE01, 1,5 kW'},
    {stain:'553_AF_91',name:'EEE Ypê II 2',power:'40.79',flow:'10.56',hmt:'54.29',label:'EEE 04 — Ypê II; Kronox BE06H, 30 kW'}
   ];
   const found=specs.map(spec=>({spec,matches:identify(spec.stain,spec.name)}));
   const sao=records.filter(r=>r.kind==='BOOSTER'&&r.name==='Booster São João'&&r.stain==='553_AF_292');
   const vidas=records.filter(r=>r.kind==='BOOSTER'&&(/vidas novas|núcleo santino/i).test(r.name));
   if(found.some(x=>x.matches.length!==1)||sao.length!==1||vidas.length>1)throw new Error('Cadastro inconsistente ou duplicado. Nenhum registro foi gravado; revise os vínculos das EEEs e boosters.');
   const note=(old:string,detail:string)=>old.includes(detail)?old:[old,detail].filter(Boolean).join(' | ');
   const date=localizedToday();
   let saved=0;
   for(const {spec,matches} of found){
    const rec=matches[0];
    if(Number(rec.power)===Number(spec.power)&&Number(rec.flow)===Number(spec.flow)&&Number(rec.hmt)===Number(spec.hmt)&&rec.notes.includes(spec.label))continue;
    const revised={...rec,power:spec.power,flow:spec.flow,hmt:spec.hmt,referenceDate:date,notes:note(rec.notes,spec.label+'; bomba em linha, rotor vortex cônico; 1 operante + 1 reserva (1+1R).')};
    await saveLocalizedWorkUpdate(rec.id,localizedPayload(revised).update);saved++;
   }
   const sj=sao[0];const sjDetail='Booster São João — parâmetros de projeto 1,210 L/s, 31 mca, 2 CV.';
   if(Number(sj.power)!==2||Number(sj.flow)!==1.21||Number(sj.hmt)!==31||!sj.notes.includes(sjDetail)){
    await saveLocalizedWorkUpdate(sj.id,localizedPayload({...sj,power:'2',flow:'1.210',hmt:'31',referenceDate:date,notes:note(sj.notes,sjDetail)}).update);saved++;
   }
   if(!vidas.length){
    const newWork={...empty,id:'',name:'Booster Vidas Novas / Núcleo Santino',kind:'BOOSTER' as const,city:'Porangaba',stain:'553_AF_88',planRowKey:'attack-2026-10',units:'1',flow:'1.701',hmt:'34',power:'2',referenceDate:date,notes:'Implantação: 553_AF_88 (Vidas Novas); também atende 553_AF_0001N (Núcleo Santino). Parâmetros de projeto: 1,701 L/s, 34 mca, 2 CV.'};
    const payload=localizedPayload(newWork);
    await saveNewLocalizedWork(payload.work,payload.update);saved++;
   }
   const updated=await listLocalizedWorksForContract(contractId);
   replaceRows(updated.map(localizedRecordFromDatabase));setLoadedIds(updated.map(w=>w.id));
   setMessage('Atualização em lote concluída: '+saved+' registro(s) gravado(s) com histórico. Os já conformes não foram duplicados.');
  }catch(error){setMessage('Atualização interrompida: '+(error instanceof Error?error.message:'Erro inesperado')+'. Consulte o histórico; atualizações anteriores à falha podem ter sido salvas.');}
  finally{saving.current=false;setBusy(false);setBatchConfirm(false);}
 }
 function prepareVidasBooster(){
  const existing=rows.find(r=>r.kind==='BOOSTER'&&(/vidas novas|núcleo santino/i).test(r.name));
  if(existing){openRecord(existing);setMessage('Booster já cadastrado: abrindo atualização para evitar duplicidade.');return;}
  openRecord({...empty,id:'',kind:'BOOSTER',name:'Booster Vidas Novas / Núcleo Santino',city:'Porangaba',stain:'553_AF_88',planRowKey:'attack-2026-10',units:'1',flow:'1.701',hmt:'34',power:'2',notes:'Implantação: mancha 553_AF_88 (Vidas Novas). Área adicional atendida: 553_AF_0001N (Núcleo Santino). Dados de projeto informados; verificar aprovação técnica.'});
 }
 function openRecord(record:RecordWork){
  setEditing({...record,referenceDate:localizedToday()});setMessage('');
 }
 return <section className="panel localized-works" aria-label="Obras localizadas">
  <div className="localized-heading"><div><span className="localized-eyebrow">ENGENHARIA · OBRAS LOCALIZADAS</span><h2>Reservatórios, boosters e EEEs</h2><p>Controle técnico por mancha, separado das redes lineares, economias e medições.</p></div>{canEdit&&available&&<button type="button" disabled={busy} onClick={()=>openRecord({...empty,referenceDate:localizedToday()})}>Cadastrar estrutura</button>}</div>
  {canEdit&&available&&<button type="button" disabled={busy} onClick={prepareVidasBooster}>Preparar Booster Vidas Novas (sem duplicar)</button>}
  {canEdit&&available&&LOCALIZED_DATABASE_ENABLED&&<div className="localized-batch-update"><button type="button" disabled={busy} onClick={()=>setBatchConfirm(v=>!v)}>Aplicar atualizações técnicas em lote</button>{batchConfirm&&<div role="group" aria-label="Confirmação das atualizações técnicas"><p>Atualizar 4 EEEs e Booster São João; incluir um único Booster Vidas Novas (553_AF_88, atende também 553_AF_0001N). Preservar históricos e evitar duplicidades. As potências, vazões e HMTs serão registradas como dados de projeto, sem alterar situação física ou orçamentária.</p><button type="button" disabled={busy} onClick={()=>void applyTechnicalBatch()}>Confirmar e salvar no Supabase</button><button type="button" disabled={busy} onClick={()=>setBatchConfirm(false)}>Cancelar</button></div>}</div>}

  {notice&&<p role="alert" className="localized-warning">{notice}</p>}
  <p className="localized-warning">{LOCALIZED_DATABASE_ENABLED?'Cadastros centralizados com histórico permanente. Cada atualização acrescenta um novo registro.':'Cadastro central aguardando liberação. Os rascunhos anteriores permanecem neste navegador.'}</p>
  <div className="localized-preview-actions"><button type="button" onClick={exportBackup}>Exportar registros</button>{!LOCALIZED_DATABASE_ENABLED&&<><button type="button" disabled={!canEdit} onClick={()=>fileInput.current?.click()}>Importar arquivo</button><input ref={fileInput} type="file" accept="application/json,.json" aria-label="Importar arquivo de Obras Localizadas" style={{display:'none'}} onChange={e=>{const file=e.target.files?.[0];if(file)void importBackup(file);e.target.value='';}}/><button type="button" onClick={()=>setShowHistory(v=>!v)}>{showHistory?'Ocultar histórico local':'Histórico local'}</button></>}</div>
  {historyWork&&<section className="localized-history" aria-label={`Histórico de ${historyWork.name}`}><h3>Histórico permanente · {historyWork.name}</h3>
   <button type="button" onClick={()=>{setHistoryWork(null);setRemoteHistory([]);}}>Fechar histórico</button>
   {remoteHistory.map(snapshot=><article key={snapshot.id}><h4>Referência: {new Intl.DateTimeFormat('pt-BR').format(new Date(snapshot.reference_date+'T12:00:00'))}</h4>
    <p>Registrado em {new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(snapshot.created_at))} · Autor: {snapshot.created_by}</p>
    <p>Projetos: {statusLabels[snapshot.project_status]} · Execução: {localizedPhysicalLabels[snapshot.physical_status]} · Orçamento: {budgetLabels[snapshot.budget_status]}</p>
    <p>Hidráulico: {snapshot.hydraulic_project_status?statusLabels[snapshot.hydraulic_project_status]:'A informar'}{historyWork.kind==='EEE'?` · Elétrico: ${snapshot.electrical_project_status?statusLabels[snapshot.electrical_project_status]:'A informar'} · Estrutural: ${snapshot.structural_project_status?statusLabels[snapshot.structural_project_status]:'A informar'}`:''}</p>
    <p>{historyWork.kind==='RESERVOIR'?`Capacidade: ${snapshot.capacity_m3??'A informar'} m³ · Material: ${snapshot.material??'A informar'}`:`Potência: ${snapshot.pump_power_cv??'A informar'} CV · Vazão: ${snapshot.flow_lps??'A informar'} L/s · HMT: ${snapshot.head_mca??'A informar'} mca`}</p>
    <p>Item contratual: {snapshot.contractual_item_code??'A informar'} · Valor aprovado: {snapshot.approved_budget_brl==null?'A informar':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(snapshot.approved_budget_brl)}</p>
    {snapshot.notes&&<p>{snapshot.notes}</p>}
   </article>)}
   {historyBusy&&<p role="status">Carregando histórico…</p>}{historyError&&<p role="alert">{historyError}</p>}
   {!historyBusy&&!historyError&&!remoteHistory.length&&<p>Sem atualizações registradas.</p>}
   {historyError&&<button type="button" disabled={historyBusy} onClick={()=>void readHistory(historyWork,remoteHistory.length>0)}>Tentar novamente</button>}
   {historyMore&&!historyError&&<button type="button" disabled={historyBusy} onClick={()=>void readHistory(historyWork,true)}>Carregar mais registros</button>}
  </section>}
  {showHistory&&<div role="region" aria-label="Histórico local de demonstração"><h3>Alterações nesta sessão</h3>{history.length?history.map(h=><p key={h.key}>{h.at} · {h.action} · {h.name}</p>):<p>Sem alterações nesta sessão.</p>}<p><small>Registro temporário somente nesta aba, não é histórico de banco.</small></p></div>}
  <div className="localized-types"><article className="localized-type"><h3>Reservatórios</h3><strong>{counts('RESERVOIR')} registro(s)</strong><p>Capacidade m³, material e projeto</p></article><article className="localized-type"><h3>Boosters</h3><strong>{counts('BOOSTER')} registro(s)</strong><p>CV, vazão (L/s) e HMT (mca)</p></article><article className="localized-type"><h3>Estações elevatórias (EEE)</h3><strong>{counts('EEE')} registro(s)</strong><p>Motobombas; hidráulico, elétrico e estrutural</p></article></div>
  <div className="localized-preview-filter"><label>Tipo de obra <select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="ALL">Todas</option>{Object.entries(kindLabels).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label></div>
  {!visible.length&&available&&<p>Sem estruturas cadastradas para este filtro.</p>}
  <div className="localized-table-wrap"><table className="localized-table"><thead><tr><th>Obra / estrutura</th><th>Município</th><th>Mancha</th><th>Tipo</th><th>Quant.</th><th>Dados técnicos</th><th>Orçamento</th><th>Ação</th></tr></thead><tbody>{visible.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.city}</td><td>{r.stain||'A informar'}</td><td>{kindLabels[r.kind]}</td><td>{r.units}</td><td>{r.kind==='RESERVOIR'?(r.capacity?`${r.capacity} m³`:'Capacidade pendente'):`${r.power?`${r.power} CV · `:''}${r.flow?`${r.flow} L/s · `:''}${r.hmt?`${r.hmt} mca`:'Dados pendentes'}`}</td><td>{budgetLabels[r.budget]}</td><td>{canEdit&&available&&<button type="button" disabled={busy} onClick={()=>prepareEquipment(r)}>{isPersisted(r.id)?'Atualizar':'Editar'}</button>}{isPersisted(r.id)&&<button type="button" disabled={historyBusy} onClick={()=>void readHistory(r)}>Histórico</button>}</td></tr>)}</tbody></table></div>
  {editing&&canEdit&&available&&<form onSubmit={submit} className="localized-preview-form"><h3>{editingPersisted?'Nova atualização':'Cadastrar estrutura'}</h3><fieldset disabled={busy} className="localized-preview-fields">
   <label>Obra / estrutura<input required maxLength={150} disabled={editingPersisted||busy} value={editing.name} onChange={e=>update('name',e.target.value)}/></label>
   <label>Município<select disabled={editingPersisted||busy} value={editing.city} onChange={e=>setEditing(old=>old?{...old,city:e.target.value,stain:'',planRowKey:'',engineeringProjectId:''}:old)}>{cities.map(c=><option key={c}>{c}</option>)}</select></label>
   <label>ID da mancha — Plano de Ataque 2026<select required disabled={editingPersisted||busy} value={selectedPlan?.rowKey??''} onChange={e=>setEditing(old=>{const plan=planOptions.find(r=>r.rowKey===e.target.value);return old?{...old,stain:plan?.stainId??'',planRowKey:plan?.rowKey??'',engineeringProjectId:''}:old;})}>
    <option value="">Selecione a frente</option>{planOptions.map(r=><option key={r.rowKey} value={r.rowKey}>{r.stainId} · {r.front}</option>)}
   </select></label>
   <label>Tipo<select disabled={editingPersisted||busy} value={editing.kind} onChange={e=>setEditing(old=>old?{...old,kind:e.target.value as Kind,stain:'',planRowKey:'',engineeringProjectId:''}:old)}>{Object.entries(kindLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <label>Projeto de Engenharia associado<select disabled={editingPersisted||busy} value={editing.engineeringProjectId??''} onChange={e=>update('engineeringProjectId',e.target.value)}><option value="">Sem projeto associado</option>{eligibleProjects.map(p=><option key={p.id} value={p.id}>{p.project_name}</option>)}</select></label>
   {!editingPersisted&&suggestedLink?.status==='MATCHED'&&!editing.engineeringProjectId&&<button type="button" onClick={()=>update('engineeringProjectId',suggestedLink.projectId!)}>Associar projeto correspondente</button>}
   {!editingPersisted&&suggestedLink?.status==='AMBIGUOUS'&&<p className="localized-warning localized-wide">Há mais de um projeto correspondente. Confirme o projeto correto na lista ou mantenha a frente sem associação.</p>}
   <label>Data de referência<input type="date" required value={editing.referenceDate??localizedToday()} onChange={e=>update('referenceDate',e.target.value)}/></label>
   <label>Situação da execução<select value={editing.physical??'NOT_STARTED'} onChange={e=>update('physical',e.target.value)}>{Object.entries(localizedPhysicalLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   {sameIdOptions.length>1&&<p className="localized-warning localized-wide">Atenção: o ID {editing.stain} consta em {sameIdOptions.length} frentes. Confirme o vínculo antes de registrar.</p>}
   <label>Quantidade<input type="number" min="1" step="1" required disabled={editingPersisted||busy} value={editing.units} onChange={e=>update('units',e.target.value)}/></label>
   {editing.kind==='RESERVOIR'?<><label>Capacidade (m³)<input type="number" min="0" step="any" value={editing.capacity} onChange={e=>update('capacity',e.target.value)}/></label><label>Material<input maxLength={80} value={editing.material} onChange={e=>update('material',e.target.value)} placeholder="PRFV, concreto..."/></label></>:<><label>Potência (CV)<input type="number" min="0" step="any" value={editing.power} onChange={e=>update('power',e.target.value)}/></label><label>Vazão (L/s)<input type="number" min="0" step="any" value={editing.flow} onChange={e=>update('flow',e.target.value)}/></label><label>HMT (mca)<input type="number" min="0" step="any" value={editing.hmt} onChange={e=>update('hmt',e.target.value)}/></label></>}
   <label>Projeto hidráulico<select value={editing.hydraulic} onChange={e=>update('hydraulic',e.target.value)}>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   {editing.kind==='EEE'&&<><label>Projeto elétrico<select value={editing.electrical} onChange={e=>update('electrical',e.target.value)}>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Projeto estrutural<select value={editing.structural} onChange={e=>update('structural',e.target.value)}>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></>}
   <label>Situação orçamentária<select value={editing.budget} onChange={e=>setEditing(old=>old?{...old,budget:e.target.value as Budget,approvedBudget:e.target.value==='APPROVED'?old.approvedBudget:''}:old)}>{Object.entries(budgetLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   {editing.budget==='APPROVED'&&<label>Valor do orçamento aprovado (R$)<input type="number" min="0" step="0.01" value={editing.approvedBudget??''} onChange={e=>update('approvedBudget',e.target.value)}/></label>}
   <label>Item contratual / SPE / CPU<input maxLength={80} value={editing.contractualCode} onChange={e=>update('contractualCode',e.target.value)}/></label>
   <label className="localized-wide">Observações<textarea maxLength={2000} rows={3} value={editing.notes} onChange={e=>update('notes',e.target.value)}/></label>
  </fieldset><div className="localized-preview-actions"><button type="submit" disabled={busy}>{LOCALIZED_DATABASE_ENABLED?'Salvar atualização':'Salvar rascunho'}</button><button type="button" disabled={busy} onClick={()=>{setEditing(null);setMessage('');}}>Cancelar</button></div></form>}
  {message&&<p role="status" className="localized-warning">{message}</p>}
 </section>;
}
