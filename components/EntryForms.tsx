'use client';
import {useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {monthlyFinancialSchema,weeklyProgressSchema} from '@/lib/validation';
async function contractId(){const db=createClient();if(!db)return {db:null,id:null};const {data}=await db.from('contracts').select('id').eq('code','SBON 17B').eq('active',true).maybeSingle();return {db,id:data?.id??null}}
export function WeeklyForm(){
 const [message,setMessage]=useState('');
 async function submit(formData:FormData){
  setMessage('Conferindo acumulados…');
  const parsed=weeklyProgressSchema.safeParse(Object.fromEntries(formData));
  if(!parsed.success){setMessage('Revise os valores acumulados e a data.');return;}
  const {db,id}=await contractId();
  if(!db){setMessage('Modo local: Supabase não configurado.');return;}
  if(!id){setMessage('Contrato SBON 17B não encontrado.');return;}
  const timeline=await db.from('weekly_progress')
    .select('reference_date,economies_executed,network_executed_m')
    .eq('contract_id',id).eq('active',true).order('reference_date',{ascending:true});
  if(timeline.error){setMessage('Não foi possível conferir as atualizações anteriores.');return;}
  const date=parsed.data.reference_date;
  const rows=timeline.data??[];
  if(rows.some(row=>row.reference_date===date)){
   setMessage('Já existe atualização nessa data. Não duplique o lançamento; solicite retificação do registro existente.');
   return;
  }
  const previous=[...rows].reverse().find(row=>row.reference_date<date);
  const next=rows.find(row=>row.reference_date>date);
  const economies=parsed.data.economies_executed;
  const meters=parsed.data.network_executed_m;
  if(previous&&(economies<Number(previous.economies_executed)||meters<Number(previous.network_executed_m))){
   setMessage('Valores acumulados não podem ser menores que os da atualização anterior. Informe o total do contrato até esta data.');
   return;
  }
  if(next&&(economies>Number(next.economies_executed)||meters>Number(next.network_executed_m))){
   setMessage('Valores acumulados não podem ultrapassar os já registrados em uma data posterior. Verifique a sequência.');
   return;
  }
  const {error}=await db.from('weekly_progress').insert({...parsed.data,contract_id:id});
  setMessage(error?error.message:'Atualização semanal acumulada salva.');
 }
 return <form action={submit} className="data-form">
  <p className="hint"><strong>Informe o acumulado do contrato até a data de referência, não apenas o executado no dia.</strong> Exemplo: 23,68 + 76,32 + 65,00 = 165 m acumulados. Na semana seguinte, sem produção nova, o acumulado permanece em 165 m.</p>
  <div className="fields">
   <label>Data de referência<input name="reference_date" type="date" required/></label>
   <label>Economias executadas · acumulado<input name="economies_executed" type="number" min="0" required/></label>
   <label>Rede executada (m) · acumulado<input name="network_executed_m" type="number" min="0" step="0.001" required/></label>
  </div>
  <button type="submit">Salvar atualização</button>
  <span className="form-message" role="status">{message}</span>
 </form>;
}
export function FinancialForm(){const [message,setMessage]=useState('');async function submit(formData:FormData){setMessage('Salvando…');const competence=String(formData.get('competence'));const [year,month]=competence.split('-').map(Number);const parsed=monthlyFinancialSchema.safeParse({reference_year:year,reference_month:month,amount:formData.get('amount'),notes:formData.get('notes')});if(!parsed.success){setMessage('Revise os campos informados.');return}const {db,id}=await contractId();if(!db){setMessage('Modo local: Supabase não configurado.');return}if(!id){setMessage('Contrato SBON 17B não encontrado.');return}const {error}=await db.from('monthly_financials').insert({...parsed.data,contract_id:id});setMessage(error?error.message:'Faturamento mensal salvo.')}return <form action={submit} className="data-form"><div className="fields"><label>Competência<input name="competence" type="month" required/></label><label>Faturamento do mês (R$)<input name="amount" type="number" min="0" step=".01" required/></label><label className="wide">Observação<textarea name="notes" maxLength={1000}/></label></div><button type="submit">Salvar faturamento</button><span className="form-message">{message}</span></form>}
