'use client';
import {useState} from 'react';
import {AppShell} from '@/components/AppShell';
import {FinancialForm,WeeklyForm} from '@/components/EntryForms';
import {createClient} from '@/lib/supabase/client';

function ConfirmedExecution(){
 const [confirm,setConfirm]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function apply(){
  if(busy)return;
  setBusy(true);setMessage('Conferindo os registros antes da gravação...');
  try{
   const db=createClient();if(!db)throw new Error('Supabase indisponível.');
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError||!user)throw new Error('Faça login com perfil ADMIN ou EDITOR.');
   const {data,error}=await db.rpc('apply_sbon17b_execution_20261103');
   if(error)throw new Error(error.message);
   const result=data as {state?:string;total_network_m?:number;executed_economies?:number}|null;
   setMessage(result?.state==='already_recorded'
      ?'Esta posição acumulada já estava registrada corretamente. Nenhuma duplicidade criada.'
      :'Posição acumulada gravada com sucesso: Estância 600 m + KM 162 900 m = 1.500 m; 0 economias executadas.');
   setConfirm(false);
  }catch(error){
   setMessage('Não foi possível concluir: '+(error instanceof Error?error.message:'Erro inesperado')+'. Nenhum dado do histórico anterior foi alterado.');
  }finally{setBusy(false);}
 }
 return <section className="panel form-panel" style={{marginTop:'16px'}}>
  <h2>Execução acumulada confirmada · 03/11/2026</h2>
  <p><b>Estância — Quadra: 600 m</b> · <b>KM 162 — Porangaba: 900 m</b> · <b>Economias executadas: 0</b>.</p>
  <p className="hint">Total acumulado do contrato: <b>1.500 m</b>. Não somar aos 551 m anteriormente registrados; os boletins anteriores permanecem preservados. A gravação utiliza sua sessão e registra uma nova posição histórica, sem atualizar nem duplicar registros anteriores.</p>
  {!confirm?<button type="button" disabled={busy} onClick={()=>setConfirm(true)}>Aplicar acumulado de 1.500 m</button>
   :<div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
    <button type="button" disabled={busy} onClick={()=>void apply()}>{busy?'Gravando…':'Confirmar e salvar no Supabase'}</button>
    <button type="button" disabled={busy} onClick={()=>setConfirm(false)}>Cancelar</button>
   </div>}
  {message&&<p role="status" className="form-message" style={{display:'block',marginTop:'10px'}}>{message}</p>}
 </section>;
}
export default function Atualizar(){
 const [tab,setTab]=useState<'weekly'|'financial'>('weekly');
 return <AppShell title="Atualizar dados" eyebrow="OPERAÇÃO">
  <div className="tabs">
   <button className={tab==='weekly'?'selected':''} onClick={()=>setTab('weekly')}>Atualização Semanal</button>
   <button className={tab==='financial'?'selected':''} onClick={()=>setTab('financial')}>Atualização Financeira</button>
  </div>
  <section className="panel form-panel">
   <h2>{tab==='weekly'?'Atualização Semanal':'Atualização Financeira'}</h2>
   <p className="hint">{tab==='weekly'?'Informe os valores físicos acumulados executados.':'Registre o valor oficial de uma única competência mensal; não informe o acumulado sem rateio.'}</p>
   {tab==='weekly'?<WeeklyForm/>:<FinancialForm/>}
  </section>
  {tab==='weekly'&&<ConfirmedExecution/>}
 </AppShell>;
}
