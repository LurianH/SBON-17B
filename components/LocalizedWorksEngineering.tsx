'use client';

import {useEffect, useRef, useState} from 'react';
import './localized-works-engineering.css';
import {attackPlan2026} from '@/lib/attack-plan-2026';
import {prepareLocalizedWork} from '@/lib/localized-works-persistence';
import {LOCALIZED_DATABASE_ENABLED, saveNewLocalizedWork, saveLocalizedWorkUpdate, listLocalizedWorkHistory, type LocalizedDbUpdate} from '@/lib/localized-works-remote';

type Kind = 'RESERVOIR'|'BOOSTER'|'EEE';
type Status = 'NOT_STARTED'|'IN_PROGRESS'|'COMPLETED';
type Budget = 'NOT_BUDGETED'|'IN_PREPARATION'|'BUDGETED'|'UNDER_REVIEW'|'APPROVED';
type RecordWork = {id:string; name:string; city:string; stain:string; kind:Kind; units:string; capacity:string; material:string; power:string; flow:string; hmt:string; hydraulic:Status; electrical:Status; structural:Status; budget:Budget; contractualCode:string; notes:string};
const cities = ['Porangaba','Quadra','Tatuí','Conchas','Pereiras'];
const kindLabels:Record<Kind,string> = {RESERVOIR:'Reservatório',BOOSTER:'Booster',EEE:'EEE'};
const statusLabels:Record<Status,string> = {NOT_STARTED:'Não iniciado',IN_PROGRESS:'Em andamento',COMPLETED:'Finalizado'};
const budgetLabels:Record<Budget,string> = {NOT_BUDGETED:'Sem orçamento',IN_PREPARATION:'Em elaboração',BUDGETED:'Orçado',UNDER_REVIEW:'Em análise',APPROVED:'Aprovado'};
const empty:RecordWork={id:'',name:'',city:'Porangaba',stain:'',kind:'RESERVOIR',units:'1',capacity:'',material:'',power:'',flow:'',hmt:'',hydraulic:'NOT_STARTED',electrical:'NOT_STARTED',structural:'NOT_STARTED',budget:'NOT_BUDGETED',contractualCode:'',notes:''};
const LOCAL_DRAFT_KEY='sbon17b:localized-works:preview:v1';
const initial:RecordWork[]=[
 {...empty,id:'ref-alto',name:'Booster Alto da Serra',stain:'553_AR_0002N',kind:'BOOSTER',flow:'0.4',hmt:'28',notes:'Informação de referência de projeto; aprovação e potência pendentes.'},
 {...empty,id:'ref-saojoao',name:'Booster São João',stain:'553_AF_292',kind:'BOOSTER',notes:'Referência de planejamento; completar dados técnicos.'},
 {...empty,id:'ref-vidas',name:'Reservação Vidas Novas / Núcleo Santino',kind:'RESERVOIR',notes:'Reservação em estudo; capacidade definitiva pendente.'},
];
function validNonnegative(value:string){return value.trim()===''||(Number.isFinite(Number(value))&&Number(value)>=0);}
export function LocalizedWorksEngineering(){
 const [hydrated,setHydrated]=useState(false);
 const [busy,setBusy]=useState(false);
 const [remoteHistory,setRemoteHistory]=useState<string[]>([]);
 const [rows,setRows]=useState<RecordWork[]>(initial),[editing,setEditing]=useState<RecordWork|null>(null),[message,setMessage]=useState(''),[filter,setFilter]=useState<'ALL'|Kind>('ALL');
 const [history,setHistory]=useState<Array<{key:string;name:string;action:string;at:string}>>([]);
 const [showHistory,setShowHistory]=useState(false);
 const fileInput=useRef<HTMLInputElement|null>(null);
 // O rascunho local é individual deste navegador/dispositivo e não substitui o banco.
 useEffect(()=>{
  try{
   const saved=window.localStorage.getItem(LOCAL_DRAFT_KEY);
   if(saved){
    const parsed:unknown=JSON.parse(saved);
    if(parsed && typeof parsed==='object'){
     const draft=parsed as {works?:unknown;version?:unknown};
     if(draft.version===1 && Array.isArray(draft.works) && draft.works.length<=2000 &&
        draft.works.every(item=>item && typeof item==='object' && typeof item.id==='string' &&
          typeof item.name==='string' && typeof item.kind==='string' && typeof item.city==='string')){
      setRows(draft.works as RecordWork[]);
     }
    }
   }
  }catch{/* Falha ao ler rascunho: manter os dados iniciais. */}
  setHydrated(true);
 },[]);
 useEffect(()=>{
  if(!hydrated)return;
  try{
   window.localStorage.setItem(LOCAL_DRAFT_KEY,JSON.stringify({version:1,works:rows,updatedAt:new Date().toISOString()}));
  }catch{/* Limite de armazenamento: exportação JSON continua disponível. */}
 },[rows,hydrated]);
 const visible=rows.filter(r=>filter==='ALL'||r.kind===filter);
 const planOptions=editing ? attackPlan2026.filter(r=>r.municipality===editing.city && (editing.kind==='EEE'?r.segment==='SEWER':r.segment==='WATER')) : [];
 const selectedPlan=planOptions.find(r=>r.stainId===editing?.stain);
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
  if(file.size>1024*1024){setMessage('Arquivo excede o limite de 1 MB.');return;}
  try {
   const parsed:unknown=JSON.parse(await file.text());
   if(!parsed||typeof parsed!=='object')throw new Error('Formato inválido.');
   const archive=parsed as {format?:unknown;version?:unknown;works?:unknown};
   if(archive.format!=='sbon17b-localized-works-preview'||archive.version!==1||!Array.isArray(archive.works)||archive.works.length>2000)throw new Error('Arquivo incompatível com esta versão.');
   const allowedKinds=['RESERVOIR','BOOSTER','EEE'];
   const statuses=['NOT_STARTED','IN_PROGRESS','COMPLETED'];
   const budgets=['NOT_BUDGETED','IN_PREPARATION','BUDGETED','UNDER_REVIEW','APPROVED'];
   const values:RecordWork[]=archive.works.map((item:unknown)=>{
    if(!item||typeof item!=='object')throw new Error('Registro inválido.');
    const row=item as Record<string,unknown>;
    for(const field of ['id','name','city','stain','kind','units','capacity','material','power','flow','hmt','hydraulic','electrical','structural','budget','contractualCode','notes']){
     if(typeof row[field]!=='string')throw new Error(`Campo inválido: ${field}`);
    }
    if(!cities.includes(row.city as string)||!allowedKinds.includes(row.kind as string)||!statuses.includes(row.hydraulic as string)||!statuses.includes(row.electrical as string)||!statuses.includes(row.structural as string)||!budgets.includes(row.budget as string)||!/^\d+$/.test(row.units as string)||Number(row.units)<1)throw new Error('Registro inválido para as opções do formulário.');
    for(const field of ['capacity','power','flow','hmt'])if(!validNonnegative(row[field] as string))throw new Error(`Valor técnico inválido: ${field}`);
    const textLimits:Record<string,number>={id:100,name:150,stain:80,material:80,contractualCode:80,notes:2000};
    for(const [field,max] of Object.entries(textLimits))if((row[field] as string).length>max)throw new Error(`Campo excede o limite: ${field}`);
    return row as unknown as RecordWork;
   });
   if(new Set(values.map(v=>v.id)).size!==values.length)throw new Error('Há identificadores duplicados no arquivo.');
   setRows(values);setHistory([]);setEditing(null);
   setMessage(`${values.length} registros importados apenas para esta aba. Não houve gravação no Supabase.`);
  }catch(error){setMessage(error instanceof Error?`Importação rejeitada: ${error.message}`:'Arquivo inválido.');}
 }
 const update=(key:keyof RecordWork,value:string)=>setEditing(old=>old?{...old,[key]:value}:null);
 const counts=(kind:Kind)=>rows.filter(r=>r.kind===kind).length;
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!editing)return;
  if(!editing.name.trim()||!editing.stain.trim()){setMessage('Informe a obra e selecione uma mancha do Plano de Ataque.');return;}
  if(!planOptions.some(r=>r.stainId===editing.stain)){setMessage('A mancha não corresponde ao município e ao sistema desta estrutura.');return;}
  if(sameIdOptions.length>1){setMessage('Este ID aparece em mais de uma frente; aguarde a confirmação do vínculo antes de cadastrar.');return;}
  if(!/^\d+$/.test(editing.units)||Number(editing.units)<1){setMessage('Quantidade deve ser um inteiro maior que zero.');return;}
  for(const k of ['capacity','power','flow','hmt'] as const){if(!validNonnegative(editing[k])){setMessage('Revise os valores técnicos: somente números não negativos.');return;}}
  if(editing.kind==='RESERVOIR'&&!editing.capacity.trim()){setMessage('Informe a capacidade do reservatório em m³ ou aguarde sua definição antes do cadastro.');return;}
  // Same validation boundary that will later guard persisted updates.
  const selected=planOptions.find(r=>r.stainId===editing.stain);
  if(!selected){setMessage('Selecione uma frente cadastrada no Plano de Ataque.');return;}
  const optionalNumber=(v:string)=>v.trim()===''?null:Number(v);
  try {
   prepareLocalizedWork({name:editing.name,rowKey:selected.rowKey,kind:editing.kind,quantity:Number(editing.units),capacityM3:optionalNumber(editing.capacity),powerCv:optionalNumber(editing.power),flowLps:optionalNumber(editing.flow),hmtMca:optionalNumber(editing.hmt),material:editing.material.trim()||null,hydraulic:editing.hydraulic,electrical:editing.kind==='EEE'?editing.electrical:null,structural:editing.kind==='EEE'?editing.structural:null,budget:editing.budget,contractualCode:editing.contractualCode.trim()||null,notes:editing.notes.trim()||null,referenceDate:new Date().toISOString().slice(0,10)});
  } catch(error){setMessage(error instanceof Error?`Validação: ${error.message}`:'Falha de validação dos dados.');return;}
  // Escrita remota só pode ocorrer após migração, validação de RLS e liberação explícita.
  // O serviço de banco mantém a trava independente da interface.
  if(LOCALIZED_DATABASE_ENABLED){
   const toNumber=(v:string)=>v.trim()===''?null:Number(v);
   const update:LocalizedDbUpdate={reference_date:new Date().toISOString().slice(0,10),
    project_status:editing.hydraulic,physical_status:'NOT_STARTED',budget_status:editing.budget,
    pump_power_cv:toNumber(editing.power),flow_lps:toNumber(editing.flow),head_mca:toNumber(editing.hmt),
    capacity_m3:toNumber(editing.capacity),material:editing.material.trim()||null,
    hydraulic_project_status:editing.hydraulic,electrical_project_status:editing.kind==='EEE'?editing.electrical:null,
    structural_project_status:editing.kind==='EEE'?editing.structural:null,
    contractual_item_code:editing.contractualCode.trim()||null,approved_budget_brl:null,
    notes:editing.notes.trim()||null};
   setBusy(true);
   try {
    if(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(editing.id)){
     await saveLocalizedWorkUpdate(editing.id,update);
    }else{
     await saveNewLocalizedWork({plan_row_key:selected.rowKey,engineering_project_id:null,
      kind:editing.kind,designation:editing.name.trim(),quantity:Number(editing.units)},update);
    }
    setEditing(null);setMessage('Registro enviado ao banco. Recarregue a consulta para conferir o histórico.');
   }catch(error){setMessage(error instanceof Error?error.message:'Falha ao salvar no banco.');}
   finally{setBusy(false);}
   return;
  }
  const existed=rows.some(r=>r.id===editing.id);
  const saved={...editing,name:editing.name.trim(),stain:editing.stain.trim()};
  setRows(old=>old.some(r=>r.id===saved.id)?old.map(r=>r.id===saved.id?saved:r):[...old,{...saved,id:`local-${Date.now()}-${old.length}`}]);
  setHistory(h=>[{key:`${Date.now()}-${h.length}`,name:saved.name,action:existed?'Edição validada':'Cadastro validado',at:new Date().toLocaleString('pt-BR')},...h]);
  setEditing(null);setMessage('Dados validados. Rascunho salvo neste navegador; nenhuma gravação remota.');
 }
 return <section className="panel localized-works" aria-label="Obras localizadas">
  <div className="localized-heading"><div><span className="localized-eyebrow">ENGENHARIA · OBRAS LOCALIZADAS</span><h2>Reservatórios, boosters e EEEs</h2><p>Controle técnico por mancha, separado das redes lineares, economias e medições.</p></div><button type="button" onClick={()=>{setEditing({...empty});setMessage('');}}>Cadastrar estrutura</button></div>
  <p role="status" className="localized-warning"><strong>Rascunho local, sem gravação no Supabase.</strong> Alterações validadas ficam salvas automaticamente neste navegador após clicar em "Aplicar na prévia". Exporte um JSON para ter uma cópia independente: limpar dados do navegador ou trocar de computador pode apagar este rascunho. Não é histórico oficial de banco.</p>
  <div className="localized-preview-actions"><button type="button" onClick={exportBackup}>Exportar arquivo de segurança</button><button type="button" onClick={()=>fileInput.current?.click()}>Importar arquivo</button><input ref={fileInput} type="file" accept="application/json,.json" aria-label="Importar arquivo de Obras Localizadas" style={{display:'none'}} onChange={e=>{const file=e.target.files?.[0];if(file)void importBackup(file);e.target.value='';}}/><button type="button" onClick={()=>setShowHistory(v=>!v)}>{showHistory?'Ocultar histórico da prévia':'Histórico da prévia'}</button><span>Gravação remota: {LOCALIZED_DATABASE_ENABLED?'habilitada':'bloqueada'}</span></div>
  {LOCALIZED_DATABASE_ENABLED&&editing&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(editing.id)&&<button type="button" onClick={async()=>{try{const h=await listLocalizedWorkHistory(editing.id);setRemoteHistory(h.map(x=>JSON.stringify(x)));}catch(e){setMessage(e instanceof Error?e.message:'Erro de leitura.');}}}>Consultar histórico central</button>}
  {remoteHistory.length>0&&<details><summary>Histórico central carregado</summary><pre>{remoteHistory.join('\n')}</pre></details>}
  {showHistory&&<div role="region" aria-label="Histórico local de demonstração"><h3>Alterações nesta sessão</h3>{history.length?history.map(h=><p key={h.key}>{h.at} · {h.action} · {h.name}</p>):<p>Sem alterações nesta sessão.</p>}<p><small>Registro temporário somente nesta aba, não é histórico de banco.</small></p></div>}
  <div className="localized-types"><article className="localized-type"><h3>Reservatórios</h3><strong>{counts('RESERVOIR')} referência(s)</strong><p>Capacidade m³, material e projeto</p></article><article className="localized-type"><h3>Boosters</h3><strong>{counts('BOOSTER')} referência(s)</strong><p>CV, vazão (L/s) e HMT (mca)</p></article><article className="localized-type"><h3>Estações elevatórias (EEE)</h3><strong>{counts('EEE')} referência(s)</strong><p>Motobombas; hidráulico, elétrico e estrutural</p></article></div>
  <div className="localized-preview-filter"><label>Tipo de obra <select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="ALL">Todas</option>{Object.entries(kindLabels).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label></div>
  <div className="localized-table-wrap"><table className="localized-table"><thead><tr><th>Obra / estrutura</th><th>Município</th><th>Mancha</th><th>Tipo</th><th>Quant.</th><th>Dados técnicos</th><th>Orçamento</th><th>Ação</th></tr></thead><tbody>{visible.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.city}</td><td>{r.stain||'A informar'}</td><td>{kindLabels[r.kind]}</td><td>{r.units}</td><td>{r.kind==='RESERVOIR'?(r.capacity?`${r.capacity} m³`:'Capacidade pendente'):`${r.power?`${r.power} CV · `:''}${r.flow?`${r.flow} L/s · `:''}${r.hmt?`${r.hmt} mca`:'Dados pendentes'}`}</td><td>{budgetLabels[r.budget]}</td><td><button type="button" onClick={()=>{setEditing({...r});setMessage('');}}>Editar</button></td></tr>)}</tbody></table></div>
  {editing&&<form onSubmit={submit} className="localized-preview-form"><h3>{editing.id?'Revisar estrutura':'Cadastrar estrutura'} · prévia sem gravação</h3><div className="localized-preview-fields">
   <label>Obra / estrutura<input required maxLength={150} value={editing.name} onChange={e=>update('name',e.target.value)}/></label>
   <label>Município<select value={editing.city} onChange={e=>setEditing(old=>old?{...old,city:e.target.value,stain:''}:old)}>{cities.map(c=><option key={c}>{c}</option>)}</select></label>
   <label>ID da mancha — Plano de Ataque 2026<select required value={editing.stain} onChange={e=>update('stain',e.target.value)}>
    <option value="">Selecione a frente</option>{planOptions.map(r=><option key={r.rowKey} value={r.stainId}>{r.stainId} · {r.front}</option>)}
   </select></label>
   <label>Tipo<select value={editing.kind} onChange={e=>setEditing(old=>old?{...old,kind:e.target.value as Kind,stain:''}:old)}>{Object.entries(kindLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   {sameIdOptions.length>1&&<p className="localized-warning localized-wide">Atenção: o ID {editing.stain} consta em {sameIdOptions.length} frentes. Confirme o vínculo antes de registrar.</p>}
   <label>Quantidade<input type="number" min="1" step="1" required value={editing.units} onChange={e=>update('units',e.target.value)}/></label>
   {editing.kind==='RESERVOIR'?<><label>Capacidade (m³)<input type="number" min="0" step="any" value={editing.capacity} onChange={e=>update('capacity',e.target.value)}/></label><label>Material<input maxLength={80} value={editing.material} onChange={e=>update('material',e.target.value)} placeholder="PRFV, concreto..."/></label></>:<><label>Potência (CV)<input type="number" min="0" step="any" value={editing.power} onChange={e=>update('power',e.target.value)}/></label><label>Vazão (L/s)<input type="number" min="0" step="any" value={editing.flow} onChange={e=>update('flow',e.target.value)}/></label><label>HMT (mca)<input type="number" min="0" step="any" value={editing.hmt} onChange={e=>update('hmt',e.target.value)}/></label></>}
   <label>Projeto hidráulico<select value={editing.hydraulic} onChange={e=>update('hydraulic',e.target.value)}>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   {editing.kind==='EEE'&&<><label>Projeto elétrico<select value={editing.electrical} onChange={e=>update('electrical',e.target.value)}>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Projeto estrutural<select value={editing.structural} onChange={e=>update('structural',e.target.value)}>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></>}
   <label>Situação orçamentária<select value={editing.budget} onChange={e=>update('budget',e.target.value)}>{Object.entries(budgetLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <label>Item contratual / SPE / CPU<input maxLength={80} value={editing.contractualCode} onChange={e=>update('contractualCode',e.target.value)}/></label>
   <label className="localized-wide">Observações<textarea maxLength={2000} rows={3} value={editing.notes} onChange={e=>update('notes',e.target.value)}/></label>
  </div><div className="localized-preview-actions"><button type="submit" disabled={busy}>{LOCALIZED_DATABASE_ENABLED?'Salvar no Supabase':'Aplicar na prévia'}</button><button type="button" onClick={()=>{setEditing(null);setMessage('');}}>Cancelar</button></div></form>}
  {message&&<p role="status" className="localized-warning">{message}</p>}
 </section>;
}
