'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {BarChart3,Building2,CalendarDays,CheckCircle2,ClipboardList,Droplets,FileCheck2,FileText,Landmark,MapPin,Network,Target,TrendingUp,TriangleAlert,Waves} from 'lucide-react';
import {loadDashboardData,type DashboardData} from '@/lib/dashboard-data';
import {VitaluxChrome} from '@/components/VitaluxChrome';
import {createClient} from '@/lib/supabase/client';
import './approved-dashboard.css';

type Structures={reservoirs:number;boosters:number;eees:number};
const count=(v:number|null,decimals=0)=>v===null?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:decimals}).format(v);
const currency=(v:number|null)=>v===null?'Em apuração':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:2}).format(v);
const km=(v:number|null)=>v===null?'—':count(v/1000,2)+' km';
const percentage=(v:number|null)=>v===null?'—':count(v,1)+'%';
const ratio=(numerator:number|null,denominator:number|null)=>numerator===null||denominator===null||denominator<=0?null:numerator/denominator*100;
// Mostra o valor conhecido mesmo quando outra frente liberada ainda não tem quantitativos.
// A origem gerencial segue exigindo o total completo para cálculos de desvio.
const knownReleased=(water:number|null,sewer:number|null)=>
 water===null&&sewer===null?null:(water??0)+(sewer??0);
const date=(v:string|null)=>v?new Intl.DateTimeFormat('pt-BR').format(new Date(v+'T12:00:00')):'Aguardando atualização';
const absence='Ainda não informado';
// Recorte contratual confirmado pela fiscalização; não representa execução realizada.
const officialAnnualTargets:Record<number,number>={2026:1709,2027:8124,2028:4588};
const officialContractTotal=14421;
const staticGroups=[['553-AF-92'],['553-AF-91'],['687-AF-73'],['687-AF-47','687-AF-52'],['764-AF-109','764-AF-111','764-AF-113','764-AF-97']];
const releasedStatus=(v:string)=>v==='NO_OBJECTION'||v==='NO_OBJECTION_RESERVATIONS';

function PanelTitle({icon:Icon,title,action}:{icon:typeof Target,title:string,action?:React.ReactNode}){
 return <div className="va-panel-title"><div><Icon size={22} strokeWidth={2.2}/><h2>{title}</h2></div>{action}</div>;
}
function Kpi({icon:Icon,title,value,note}:{icon:typeof Target,title:string,value:string,note:string}){
 return <article className="va-card va-kpi"><div className="va-kpi-title"><Icon size={20}/><h2>{title}</h2></div><strong>{value}</strong><small>{note}</small></article>;
}
function GoalRow({system,goal,approved,missingQuantities=0,executedTotal,icon:Icon}:{system:'Água'|'Esgoto';goal:number|null;approved:number|null;missingQuantities?:number;executedTotal:number|null;icon:typeof Droplets}){
 const executionKnown=executedTotal===0;
 return <div className="va-goal-row">
  <div className="va-goal-system"><Icon size={30} className={system==='Água'?'va-water':'va-sewer'}/><div><b>{system}</b><small>Meta de execução do ano: {goal===null?absence:count(goal)+' economias'}</small></div></div>
  <div className="va-goal-graphic va-double-progress">
   <div className="va-measure"><div className="va-measure-heading"><b>Execução</b><small>{executionKnown?'0%':'Sem segregação por sistema'}</small></div>{executionKnown?<div className="va-progress" role="progressbar" aria-label={'Execução de '+system} aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}><span style={{width:'0%',background:'#1879C4'}}/></div>:<div className="va-progress va-progress-unclassified" role="status"><span>Execução por sistema em apuração</span></div>}<div className="va-goal-numbers"><span>Executadas: <b>{executionKnown?'0':'—'}</b></span><span>A executar: <b>{executionKnown?count(goal):'—'}</b></span></div></div>
   <div className="va-measure"><div className="va-measure-heading"><b>Projetos / Engenharia</b><small>{goal!==null?'Meta de Engenharia 2026: '+count(goal)+' economias':'Meta por sistema ainda em apuração'}</small></div>{goal!==null&&approved!==null&&goal>0?<><div className="va-progress" role="progressbar" aria-label={"Projetos de "+system+" liberados para a meta de Engenharia de 2026"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,approved/goal*100)}><span style={{width:Math.min(100,approved/goal*100)+'%',background:'#007977'}}/></div><div className="va-goal-numbers"><span>Liberadas: <b>{count(approved)}</b>{missingQuantities>0?' (parcial)':''}</span><span><b>{percentage(approved/goal*100)}</b> da meta 2026</span></div></>:<><div className="va-progress va-progress-unclassified" role="note" aria-label={"Projetos de "+system+": percentual ainda não classificável"}><span>Percentual em apuração</span></div><div className="va-goal-numbers"><span>Liberadas conhecidas: <b>{count(approved)}</b>{missingQuantities>0?' (parcial)':''}</span><span>Saldo do marco: <b>—</b></span></div></>}</div>
  </div>
 </div>;
}
type StainState={totals:Record<'WATER'|'SEWER',number>;counts:Record<'WATER'|'SEWER',Record<string,number>>};
const categoryColors:Record<string,string>={NO_OBJECTION:'#007977',NO_OBJECTION_RESERVATIONS:'#43A68E',IN_PREPARATION:'#FB7707',IN_REVIEW:'#003399',NOT_STARTED:'#B85A00',CANCELLED:'#8A9595',UNCLASSIFIED:'#D7E2E1'};
const categoryLabels:Record<string,string>={NO_OBJECTION:'Sem objeção',NO_OBJECTION_RESERVATIONS:'S/Obj. com ressalvas',IN_PREPARATION:'Em elaboração',IN_REVIEW:'Em revisão',NOT_STARTED:'A iniciar',CANCELLED:'Cancelado',UNCLASSIFIED:'Não classificadas'};
function StatusSystem({system,total,counts}:{system:'Água'|'Esgoto';total:number;counts:Record<string,number>|null}){
 const Icon=system==='Água'?Droplets:Waves;
 const classified=Object.entries(counts??{}).filter(([key])=>key!=='UNCLASSIFIED').reduce((sum,[,quantity])=>sum+quantity,0);
 const unclassified=Math.max(0,total-classified);
 const steps=Object.keys(categoryColors).map(key=>({key,label:categoryLabels[key],count:key==='UNCLASSIFIED'?unclassified:(counts?.[key]??0),color:categoryColors[key]}));
 let current=0;
 const stops=steps.filter(item=>item.count>0).map(item=>{const from=current;current+=total>0?item.count/total*100:0;return item.color+' '+from+'% '+current+'%';});
 const fill=total>0?'conic-gradient('+stops.join(', ')+')':'#D7E2E1';
 return <div className="va-status-system">
  <div className="va-status-name"><Icon size={22} className={system==='Água'?'va-water':'va-sewer'}/><div><b>{system}</b><small>Total contratual: {total} manchas</small></div></div>
  <div className="va-status-detail">
   <div className="va-status-donut" style={{background:fill}} role="img" aria-label={total+' manchas de '+system+'; '+(total-unclassified)+' com status registrado'}><div><small>Total</small><strong>{total}</strong></div></div>
   <div className="va-status-legend">{steps.map(item=><div key={item.key}><span><i className="va-dot" style={{background:item.color}}/>{item.label}</span><b>{item.count} · {total>0?percentage(item.count/total*100):'—'}</b></div>)}</div>
  </div>
 </div>;
}
function Deviation({data}:{data:DashboardData}){
 const rows=[{title:'Aprovação de projetos',value:data.origin?.engineeringPercent??null,color:'orange'},{title:'Execução física',value:data.origin?.executionPercent??null,color:'teal'},{title:'Interferências',value:null,color:'blue'},{title:'Licenças / terceiros',value:null,color:'gold'},{title:'Outros',value:null,color:'gray'}];
 return <article className="va-card va-deviation"><PanelTitle icon={TriangleAlert} title="ORIGEM DO DESVIO"/><div className="va-deviation-rows">{rows.map(item=><div className="va-deviation-row" key={item.title}><span>{item.title}</span><div className="va-deviation-track"><i data-color={item.color} style={{width:item.value===null?'0%':Math.min(100,Math.max(0,item.value))+'%'}}/></div><b>{percentage(item.value)}</b></div>)}</div><p className="va-notice-small">{data.origin?'Percentuais disponíveis: estimativa de Engenharia e Execução baseada em economias. Demais causas ainda não possuem rateio cadastrado.':'A atribuição percentual dos desvios aguarda informações compatíveis; não são presumidos percentuais.'}</p></article>;
}
function Mini({label,value,context}:{label:string,value:string,context?:string}){return <div className="va-mini"><span>{label}</span><strong>{value}</strong>{context&&<small>{context}</small>}</div>}
export default function Dashboard(){
 const [data,setData]=useState<DashboardData|null>(null);
 const [structures,setStructures]=useState<Structures|null>(null);
 const [stainState,setStainState]=useState<StainState|null>(null);
 const [annualTargets,setAnnualTargets]=useState<{year:number;total:number}[]>([]);
 const [attack2026,setAttack2026]=useState<{economies:number;stains:number}|null>(null);
 const [staticDelivery,setStaticDelivery]=useState<{date:string;count:number}[]|null>(null);
 useEffect(()=>{
  let active=true;
  void (async()=>{
   const result=await loadDashboardData();
   if(!active)return;
   setData(result);
   if(!result.contractId||result.source!=='supabase')return;
   const db=createClient();if(!db)return;
   const [works,targets,stains,annual,attack]=await Promise.all([
    db.from('engineering_localized_works').select('kind,quantity').eq('contract_id',result.contractId).eq('active',true),
    db.from('contract_stain_targets').select('segment_type,total_count').eq('contract_id',result.contractId),
    db.from('gis_stain_system_effective').select('segment_type,effective_status').eq('contract_id',result.contractId),
    db.from('annual_targets').select('year,target_economies').eq('contract_id',result.contractId).gte('year',2026).lte('year',2028).order('year'),
    db.from('engineering_attack_plan_2026').select('stain_id,planned_economies')
   ]);
   if(!active)return;

   const projectResult=await db.from('engineering_projects').select('id,project_name').eq('contract_id',result.contractId).eq('segment_type','SEWER').eq('active',true);
   if(active&&projectResult.data&&!projectResult.error){
    const projects=projectResult.data.filter(p=>staticGroups.some(group=>group.some(code=>String(p.project_name).includes(code))));
    if(projects.length){
     const ids=projects.map(p=>String(p.id));
     const [reviewResult,historyResult]=await Promise.all([
      db.from('engineering_project_review_status').select('engineering_project_id,status,updated_at').in('engineering_project_id',ids),
      db.from('engineering_project_review_history').select('engineering_project_id,new_status,changed_at').in('engineering_project_id',ids).order('changed_at',{ascending:true})
     ]);
     if(active&&reviewResult.data&&!reviewResult.error){
      const byId=new Map(reviewResult.data.map(r=>[String(r.engineering_project_id),r]));
      const dates:string[]=[];
      for(const group of staticGroups){
       const matching=group.map(code=>projects.find(p=>String(p.project_name).includes(code)));
       if(matching.some(p=>!p))continue;
       if(matching.some(p=>!releasedStatus(String(byId.get(String(p!.id))?.status??''))))continue;
       const stamps=matching.map(p=>{
        const events=(historyResult.data??[]).filter(h=>String(h.engineering_project_id)===String(p!.id)&&releasedStatus(String(h.new_status)));
        return String(events[0]?.changed_at??byId.get(String(p!.id))?.updated_at??'');
       });
       if(stamps.every(Boolean))dates.push(stamps.sort().at(-1)!.slice(0,10));
      }
      setStaticDelivery(dates.sort().map((date,i)=>({date,count:i+1})));
     }
    }
   }
   if(!attack.error&&attack.data){const unique=new Set(attack.data.map(row=>String(row.stain_id)).filter(Boolean));setAttack2026({economies:attack.data.reduce((n,row)=>n+(Number.isFinite(Number(row.planned_economies))?Math.max(0,Number(row.planned_economies)):0),0),stains:unique.size});}
   if(!annual.error&&annual.data)setAnnualTargets(annual.data.map(row=>({year:Number(row.year),total:Number(row.target_economies)})));
   if(!works.error&&works.data){
    const next={reservoirs:0,boosters:0,eees:0};
    for(const row of works.data){const q=Number(row.quantity)||0;if(row.kind==='RESERVOIR')next.reservoirs+=q;if(row.kind==='BOOSTER')next.boosters+=q;if(row.kind==='EEE')next.eees+=q;}
    setStructures(next);
   }
   if(!targets.error&&!stains.error&&targets.data&&stains.data){
    const totals:StainState['totals']={WATER:38,SEWER:84};
    for(const row of targets.data){const seg=String(row.segment_type);if(seg==='WATER')totals.WATER=Number(row.total_count);else if(seg==='SEWER')totals.SEWER=Number(row.total_count);}
    const counts:StainState['counts']={WATER:{},SEWER:{}};
    for(const row of stains.data){const seg=String(row.segment_type);const status=String(row.effective_status);if(seg==='WATER')counts.WATER[status]=(counts.WATER[status]??0)+1;else if(seg==='SEWER')counts.SEWER[status]=(counts.SEWER[status]??0)+1;}
    setStainState({totals,counts});
   }
  })();
  return()=>{active=false};
 },[]);
 if(!data)return <div className="va-loading">Carregando painel gerencial Vitalux…</div>;
 // Desagregação contratual confirmada apenas para 2026; não inferir sistemas de outros anos.
 const targetWater=data.targetBreakdown?.water??(data.targetYear===2026?352:null),targetSewer=data.targetBreakdown?.sewer??(data.targetYear===2026?1357:null);
 const release=data.releaseSummary;
 const releasedEconomies=release?knownReleased(release.water.economies.value,release.sewer.economies.value):null;
 const releasedNetwork=release?knownReleased(release.water.network.value,release.sewer.network.value):null;
 const withoutEconomies=release?release.water.economies.missing+release.sewer.economies.missing:0;
 const withoutNetwork=release?release.water.network.missing+release.sewer.network.missing:0;
 const partialRelease=withoutEconomies>0||withoutNetwork>0;
 const releasedStains=stainState?(['WATER','SEWER'] as const).reduce((sum,system)=>sum+(stainState.counts[system].NO_OBJECTION??0)+(stainState.counts[system].NO_OBJECTION_RESERVATIONS??0),0):null;
 const totalStains=stainState?stainState.totals.WATER+stainState.totals.SEWER:null;
 const annualGoal=(year:number)=>{const dbTotal=annualTargets.find(row=>row.year===year)?.total;return dbTotal&&dbTotal>0?dbTotal:officialAnnualTargets[year]??null};
 const annualTargetsSum=[2026,2027,2028].reduce((sum,year)=>sum+(annualGoal(year)??0),0);
 const annualTargetsMismatch=annualTargetsSum!==officialContractTotal;
 const currentYearGoal=annualGoal(data.targetYear);
 const systemTotalsMismatch=currentYearGoal!==null&&targetWater!==null&&targetSewer!==null&&targetWater+targetSewer!==currentYearGoal;
 const projected=ratio(data.annualProjection,currentYearGoal);
 const projectedWidth=projected===null?0:Math.max(0,Math.min(100,projected));
 return <VitaluxChrome lastUpdated={data.latestDate} year={data.targetYear}>
  <main className="va-main">
   <section className="va-top-grid">
    <Kpi icon={FileText} title="VALOR DO CONTRATO" value={currency(data.contractValue)} note="Contrato consolidado"/>
    <Kpi icon={BarChart3} title="FATURADO NO ANO" value={currency(data.billingYtd)} note="Acumulado do exercício"/>
    <Kpi icon={Target} title={'META '+data.targetYear} value={currentYearGoal===null?'Em apuração':count(currentYearGoal)+' economias'} note={systemTotalsMismatch?'Divergência no cadastro por sistema: Água '+count(targetWater)+' + Esgoto '+count(targetSewer):'Água '+count(targetWater)+' · Esgoto '+count(targetSewer)}/>
    <article className="va-card va-projection"><PanelTitle icon={TrendingUp} title="PROJEÇÃO ANUAL"/><div className="va-projection-inner"><div className="va-half-gauge" style={{'--gauge':projectedWidth/2+'%'} as React.CSSProperties}><div><b>{percentage(projected)}</b><small>{projected===null?'Em apuração':'da meta anual'}</small></div></div><p>{projected!==null?'Projeção calculada pela produtividade observada, normalizada por dias de acompanhamento.':data.executed===0&&data.networkExecuted!==null&&data.networkExecuted>0?'Rede executada: '+count(data.networkExecuted,3)+' m. Ainda são 0 economias executadas; não há produtividade de economias para extrapolar a meta anual.':'Projeção aguardando pelo menos três registros ao longo de 14 dias, com avanço positivo e consistente de economias executadas.'}</p></div></article>
   </section>
   <section className="va-center-grid">
    <article className="va-card va-goals va-goals-rev">
     <PanelTitle icon={Target} title="METAS DO CONTRATO"/>
     <div className="va-goal-upper">
      <div className="va-goal-systems"><GoalRow system="Água" goal={targetWater} approved={release?.water.economies.value??null} missingQuantities={release?.water.economies.missing??0} executedTotal={data.executed} icon={Droplets}/><GoalRow system="Esgoto" goal={targetSewer} approved={release?.sewer.economies.value??null} missingQuantities={release?.sewer.economies.missing??0} executedTotal={data.executed} icon={Waves}/></div>
      <div className="va-plan-timelines va-timeline-executive">
 <h3>CRONOGRAMA · METAS DISTINTAS</h3>
 <div className="va-exec-lane">
  <b>Execução física <small>· meta anual de economias</small></b>
  <div className="va-exec-milestones">
  {[2026,2027,2028].map((year)=><div key={year}><strong>{count(annualGoal(year))}</strong><span className="va-lane-point"/><small>{year}</small></div>)}
  </div>
 </div>
 <div className="va-exec-lane">
  <b>Engenharia <small>· projetos liberados</small></b>
  <div className="va-exec-milestones va-engineering-milestones">
   <div><strong>Início</strong><span className="va-lane-point"/><small>20/07/2026</small></div>
   <div><strong>{count(releasedEconomies)}</strong><span className="va-lane-point va-point-current"/><small>Liberadas · parcial</small></div>
   <div><strong>1.709</strong><span className="va-lane-point"/><small>Dez/2026</small></div>
   <div><strong>14.421</strong><span className="va-lane-point"/><small>Mai/2027</small></div>
  </div>
 </div>
 <div className="va-exec-kpis">
  <div><small>EXECUÇÃO {data.targetYear}</small><b>{count(data.executed)} / {count(currentYearGoal)}</b><span>Avanço físico</span></div>
  <div><small>PROJETOS DEZ/2026</small><b>{count(releasedEconomies)} / 1.709</b><span>Liberações parciais</span></div>
  <div><small>PROJETOS MAI/2027</small><b>{count(releasedEconomies)} / 14.421</b><span>Prazo final</span></div>
 </div>
</div>
</div>
<div className="va-plan-lower va-plan-lower-executive">
 <div className="va-plan-assessment"><h3>COBERTURA DOS PROJETOS POR ANO</h3><div className="va-plan-years">{[2026,2027,2028].map(year=>{const base=annualGoal(year);const known=year===2026?releasedEconomies:null;const pct=base!==null&&base>0&&known!==null?Math.min(100,known/base*100):null;return <div key={year}><b>{year}</b><strong>{count(base)} <small>economias</small></strong><div className="va-mini-track" role={pct===null?'status':'progressbar'} aria-label={'Cobertura conhecida de projetos para '+year} aria-valuemin={pct===null?undefined:0} aria-valuemax={pct===null?undefined:100} aria-valuenow={pct===null?undefined:pct}><i style={{width:pct===null?'0%':pct+'%',background:'#007977'}}/></div>{year===2026&&<small>{count(known)} liberadas · {pct===null?'em apuração':percentage(pct)+' da meta'}{withoutEconomies>0?' (parcial)':''}</small>}{year===2026?<><em className="va-traffic va-traffic-warning"><i/>Engenharia: Atenção</em><em className="va-traffic va-traffic-critical"><i/>Execução: Risco crítico</em></>:<em className="va-traffic va-traffic-unknown"><i/>Em acompanhamento</em>}</div>})}</div></div>
 <div className="va-plan-targets"><h3>METAS POR ANO</h3>{[2026,2027,2028].map(year=><div key={year}><span>{year}</span><b>{count(annualGoal(year))}</b></div>)}<div className="va-plan-total"><span>Total</span><b>{count(officialContractTotal)}</b></div>{annualTargetsMismatch&&<small>Revisar metas anuais cadastradas.</small>}</div>
</div>
    </article>
    <article className="va-card va-status"><PanelTitle icon={CheckCircle2} title="STATUS DAS MANCHAS POR SISTEMA" action={<Link className="va-inline-link" href="/engenharia#engenharia-classificacao">Atualizar status ↗</Link>}/><div className="va-status-grid"><StatusSystem system="Água" total={stainState?.totals.WATER??38} counts={stainState?.counts.WATER??null}/><StatusSystem system="Esgoto" total={stainState?.totals.SEWER??84} counts={stainState?.counts.SEWER??null}/></div><p className="va-notice-small">Uma mancha corresponde a um projeto por sistema: a classificação da Engenharia é refletida aqui. Projetos sem avaliação permanecem como não classificados.</p><div className="va-static-chart"><h3>CURVA S · ESTÁTICA ESGOTO</h3><div className="va-static-legend">Planejado <span style={{color:'#008681'}}>━━</span> · Em finalização <span style={{color:'#df8b24'}}>┄┄</span></div><svg viewBox="0 0 400 172" role="img" aria-label="Curva acumulada planejada suavizada: duas frentes em 16 de outubro, três em 23 de outubro e cinco em 30 de outubro. Duas frentes estão em finalização, sem conclusão formal registrada."><line x1="36" y1="135" x2="382" y2="135" stroke="#b9d3d0"/><line x1="36" y1="20" x2="36" y2="135" stroke="#b9d3d0"/><path d="M36 135 C78 135 105 116 142 90 S212 76 250 67 S335 29 374 20" fill="none" stroke="#008681" strokeWidth="3" strokeLinecap="round"/>{staticDelivery!==null&&staticDelivery.length>0&&<polyline points={['36,135',...staticDelivery.map(item=>{const t=(Date.parse(item.date+'T12:00:00')-Date.parse('2026-10-09T12:00:00'))/(Date.parse('2026-10-30T12:00:00')-Date.parse('2026-10-09T12:00:00'));return (36+Math.max(0,Math.min(1,t))*338)+','+(135-item.count*23)})].join(' ')} fill="none" stroke="#df8b24" strokeWidth="3" strokeDasharray="7 5" strokeLinecap="round" strokeLinejoin="round"/>}<path d="M36 135 C85 135 113 102 142 90 L208 90" fill="none" stroke="#df8b24" strokeWidth="3" strokeDasharray="7 5" strokeLinecap="round"/><circle cx="208" cy="90" r="5" fill="#fff" stroke="#df8b24" strokeWidth="3"/><circle cx="142" cy="90" r="4" fill="#008681"/><circle cx="250" cy="67" r="4" fill="#008681"/><circle cx="374" cy="20" r="4" fill="#008681"/><text x="27" y="139" textAnchor="end" fontSize="11">0</text><text x="27" y="93" textAnchor="end" fontSize="11">2</text><text x="27" y="70" textAnchor="end" fontSize="11">3</text><text x="27" y="24" textAnchor="end" fontSize="11">5</text><text x="142" y="157" textAnchor="middle" fontSize="11">16/10</text><text x="250" y="157" textAnchor="middle" fontSize="11">23/10</text><text x="374" y="157" textAnchor="middle" fontSize="11">30/10</text></svg><div className="va-static-foot"><span>Planejado em 20/10: <b>2 de 5</b></span><span>Em finalização: <b>2 de 5 (Ypê I e II)</b></span><span>Concluídas: <b>{staticDelivery===null?'em apuração':staticDelivery.length+' de 5'}</span></div><small>Ypê I e Ypê II em finalização, ainda não concluídos formalmente. A linha laranja tracejada indica andamento operacional informado (não é aprovação). Conclusões formais são consultadas automaticamente ao recarregar.</small></div></article>
   </section>
   <section className="va-bottom-grid">
    <article className="va-card"><PanelTitle icon={FileCheck2} title="ENTREGA DA ENGENHARIA"/><p className="va-notice-small"><b>{release?.projects??'—'} projetos liberados</b>{partialRelease?' · Quantitativos parciais':' · Quantitativos informados'}</p><div className="va-two-metrics"><Mini label={'Economias liberadas'+(withoutEconomies?' · parcial':'')} value={count(releasedEconomies)} context={'Água '+count(release?.water.economies.value??null)+' · Esgoto '+count(release?.sewer.economies.value??null)}/><Mini label={'Rede liberada'+(withoutNetwork?' · parcial':'')} value={km(releasedNetwork)} context={'Água '+km(release?.water.network.value??null)+' · Esgoto '+km(release?.sewer.network.value??null)}/></div>{partialRelease&&<p className="va-notice-small">Pendências: {withoutEconomies} sem economias · {withoutNetwork} sem metragem. Consulte os projetos em Engenharia.</p>}<Link className="va-card-action" href="/engenharia">Detalhar Engenharia ↗</Link></article>
    <article className="va-card"><PanelTitle icon={Network} title="EXECUÇÃO REAL"/><div className="va-two-metrics"><Mini label="Economias executadas" value={count(data.executed)} context="Acumulado informado"/><Mini label="Rede executada" value={km(data.networkExecuted)} context="Acumulado informado"/></div><Link className="va-card-action" href="/atualizar">Atualizar execução ↗</Link></article>
    <article className="va-card va-structures"><PanelTitle icon={Building2} title="ESTRUTURAS CADASTRADAS"/><div className="va-structure-rows"><div><Landmark size={17}/><span>Reservatórios</span><b>{structures?count(structures.reservoirs):'—'}</b></div><div><Target size={17}/><span>Boosters</span><b>{structures?count(structures.boosters):'—'}</b></div><div><Network size={17}/><span>EEEs</span><b>{structures?count(structures.eees):'—'}</b></div></div><Link className="va-card-action" href="/engenharia">Abrir obras localizadas ↗</Link></article>
    <article className="va-card va-distribution"><PanelTitle icon={MapPin} title="DISTRIBUIÇÃO DAS MANCHAS"/><div className="va-distribution-inner"><div><Droplets size={24} className="va-water"/><span>Água</span><strong>{stainState?.totals.WATER??38}</strong><small>manchas</small></div><div><Waves size={24} className="va-sewer"/><span>Esgoto</span><strong>{stainState?.totals.SEWER??84}</strong><small>manchas</small></div></div><Link className="va-card-action" href="/engenharia">Visualizar por município ↗</Link></article>
   </section>
   <div className="va-bottom-note"><span>SBON 17B · Informações provenientes dos cadastros e atualizações registrados no sistema</span><Link href="/engenharia">Vitalux Ecoativa · Engenharia</Link></div>
  </main>
 </VitaluxChrome>;
}
