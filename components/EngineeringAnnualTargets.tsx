'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase/client';

type Annual={year:number;total:number;municipalities:Record<string,number>};
const cities=['Conchas','Pereiras','Porangaba','Quadra','Tatuí'];
const officialAnnual:Record<number,{total:number;municipalities:Record<string,number>}>= {2026:{total:1709,municipalities:{Conchas:163,Pereiras:15,Porangaba:567,Quadra:157,'Tatuí':807}},2027:{total:8124,municipalities:{Conchas:1123,Pereiras:254,Porangaba:2607,Quadra:747,'Tatuí':3393}},2028:{total:4588,municipalities:{Conchas:680,Pereiras:512,Porangaba:1398,Quadra:601,'Tatuí':1397}}};
const fmt=(v:number|null)=>v===null?'—':new Intl.NumberFormat('pt-BR').format(v);
export function EngineeringAnnualTargets({contractId}:{contractId:string|null}){
 const [rows,setRows]=useState<Annual[]>([]);
 const [state,setState]=useState<'loading'|'ready'|'missing'>('loading');
 useEffect(()=>{
  let active=true;
  void (async()=>{
   const db=createClient();if(!contractId||!db){if(active)setState('missing');return;}
   const targets=await db.from('annual_targets').select('id,year,target_economies').eq('contract_id',contractId).gte('year',2026).lte('year',2028).order('year');
   if(targets.error||!targets.data?.length){if(active){setRows([2026,2027,2028].map(year=>({year,...officialAnnual[year]})));setState('ready');}return;}
   const ids=targets.data.map(r=>r.id);
   const details=await db.from('annual_target_details').select('annual_target_id,municipality,target_economies').in('annual_target_id',ids);
   if(!active)return;
   setRows([2026,2027,2028].map(year=>{const r=targets.data.find(row=>Number(row.year)===year);
    const municipalities:Record<string,number>={};
    if(!details.error)for(const d of details.data??[]){
     if(r&&d.annual_target_id===r.id)municipalities[d.municipality]=(municipalities[d.municipality]??0)+Number(d.target_economies??0);
    }
    return {year,total:r&&Number(r.target_economies)>0?Number(r.target_economies):officialAnnual[year].total,municipalities:Object.keys(municipalities).length?municipalities:officialAnnual[year].municipalities};
   }));
   setState('ready');
  })();
  return()=>{active=false};
 },[contractId]);
 return <section className="panel engineering-annual-targets" aria-label="Metas anuais de execução">
  <h2>Metas do contrato por ano</h2>
  <p>Recorte anual de execução em economias. O cronograma dos projetos deve estar concluído até maio/2027. Valores oficiais informados são utilizados quando o cadastro anual está ausente ou zerado.</p>
  {state==='loading'?<p>Carregando metas…</p>:state==='missing'?<p>Metas anuais ainda não disponíveis para consulta.</p>:
  <div style={{overflowX:'auto'}}><table><thead><tr><th>Ano</th>{cities.map(c=><th key={c}>{c}</th>)}<th>Total (economias)</th></tr></thead><tbody>
   {rows.map(r=><tr key={r.year}><th>{r.year}</th>{cities.map(c=><td key={c}>{Object.hasOwn(r.municipalities,c)?fmt(r.municipalities[c]):'—'}</td>)}<td><strong>{fmt(r.total)}</strong></td></tr>)}
   <tr><th>Total</th>{cities.map(c=><td key={c}>{rows.every(r=>Object.hasOwn(r.municipalities,c))?fmt(rows.reduce((n,r)=>n+r.municipalities[c],0)):'—'}</td>)}<td><strong>{rows.length===3?fmt(rows.reduce((n,r)=>n+r.total,0)):'—'}</strong></td></tr>
  </tbody></table></div>}
 </section>;
}
