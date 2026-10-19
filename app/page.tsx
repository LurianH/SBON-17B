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

function PanelTitle({icon:Icon,title,action}:{icon:typeof Target,title:string,action?:React.ReactNode}){
 return <div className="va-panel-title"><div><Icon size={22} strokeWidth={2.2}/><h2>{title}</h2></div>{action}</div>;
}
function Kpi({icon:Icon,title,value,note}:{icon:typeof Target,title:string,value:string,note:string}){
 return <article className="va-card va-kpi"><div className="va-kpi-title"><Icon size={20}/><h2>{title}</h2></div><strong>{value}</strong><small>{note}</small></article>;
}
function GoalRow({system,goal,approved,executedTotal,icon:Icon}:{system:'Água'|'Esgoto';goal:number|null;approved:number|null;executedTotal:number|null;icon:typeof Droplets}){
 const engineeringRatio=ratio(approved,goal);
 const confirmedZero=executedTotal===0;
 return <div className="va-goal-row">
  <div className="va-goal-system"><Icon size={30} className={system==='Água'?'va-water':'va-sewer'}/><div><b>{system}</b><small>Meta: {goal===null?absence:count(goal)+' economias'}</small></div></div>
  <div className="va-goal-graphic"><div className="va-progress va-progress-empty" aria-label={'Execução de '+system+' ainda não segregada por sistema'}><span/></div><div className="va-goal-numbers"><span>Executadas: <b>{confirmedZero?'0':'—'}</b></span><span>A executar: <b>{confirmedZero?count(goal):'—'}</b></span></div><small className="va-goal-context">Aprovadas na Engenharia: {count(approved)}{engineeringRatio===null?'':' ('+percentage(engineeringRatio)+' da meta)'}</small></div>
  <div className="va-goal-percent"><strong>—</strong><small>execução por sistema pendente</small></div>
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
 useEffect(()=>{
  let active=true;
  void (async()=>{
   const result=await loadDashboardData();
   if(!active)return;
   setData(result);
   if(!result.contractId||result.source!=='supabase')return;
   const db=createClient();if(!db)return;
   const [works,targets,stains,annual]=await Promise.all([
    db.from('engineering_localized_works').select('kind,quantity').eq('contract_id',result.contractId).eq('active',true),
    db.from('contract_stain_targets').select('segment_type,total_count').eq('contract_id',result.contractId),
    db.from('gis_stain_system_effective').select('segment_type,effective_status').eq('contract_id',result.contractId),
    db.from('annual_targets').select('year,target_economies').eq('contract_id',result.contractId).gte('year',2026).lte('year',2028).order('year')
   ]);
   if(!annual.error&&annual.data)setAnnualTargets(annual.data.map(row=>({year:Number(row.year),total:Number(row.target_economies)})));
   if(!active)return;
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
 const targetWater=data.targetBreakdown?.water??null,targetSewer=data.targetBreakdown?.sewer??null;
 const engWater=data.engineeringBreakdown?.waterEconomies??null,engSewer=data.engineeringBreakdown?.sewerEconomies??null;
 const netWater=data.engineeringBreakdown?.waterNetwork??null,netSewer=data.engineeringBreakdown?.sewerNetwork??null;
 const release=data.releaseSummary;
 const releasedEconomies=release?knownReleased(release.water.economies.value,release.sewer.economies.value):null;
 const releasedNetwork=release?knownReleased(release.water.network.value,release.sewer.network.value):null;
 const withoutEconomies=release?release.water.economies.missing+release.sewer.economies.missing:0;
 const withoutNetwork=release?release.water.network.missing+release.sewer.network.missing:0;
 const partialRelease=withoutEconomies>0||withoutNetwork>0;
 const releasedStains=stainState?(['WATER','SEWER'] as const).reduce((sum,system)=>sum+(stainState.counts[system].NO_OBJECTION??0)+(stainState.counts[system].NO_OBJECTION_RESERVATIONS??0),0):null;
 const totalStains=stainState?stainState.totals.WATER+stainState.totals.SEWER:null;
 const engineeringDeadline=new Date(2027,4,31,23,59,59).getTime();
 const engineeringStart=new Date(2026,6,20).getTime();
 const engineeringElapsed=Math.max(0,Math.min(1,(Date.now()-engineeringStart)/(engineeringDeadline-engineeringStart)));
 const engineeringCoverage=releasedEconomies===null?null:releasedEconomies/officialContractTotal;
 const engineeringPlannedEconomies=Math.round(officialContractTotal*engineeringElapsed);
 const engineeringRemainingDays=Math.max(0,Math.ceil((engineeringDeadline-Date.now())/86400000));
 const engineeringRequiredDaily=releasedEconomies===null||engineeringRemainingDays===0?null:Math.max(0,(officialContractTotal-releasedEconomies)/engineeringRemainingDays);
 const engineeringComplete=withoutEconomies===0 && release!==null && releasedEconomies!==null;
 const engineeringSignal=engineeringCoverage===null||!engineeringComplete?'INCOMPLETO':engineeringCoverage>=engineeringElapsed*.9?'VERDE':engineeringCoverage>=engineeringElapsed*.7?'AMARELO':'VERMELHO';
 const annualGoal=(year:number)=>{const dbTotal=annualTargets.find(row=>row.year===year)?.total;return dbTotal&&dbTotal>0?dbTotal:officialAnnualTargets[year]??null};
 const projected=ratio(data.annualProjection,data.target);
 const projectedWidth=projected===null?0:Math.max(0,Math.min(100,projected));
 return <VitaluxChrome lastUpdated={data.latestDate} year={data.targetYear}>
  <main className="va-main">
   <section className="va-top-grid">
    <Kpi icon={FileText} title="VALOR DO CONTRATO" value={currency(data.contractValue)} note="Contrato consolidado"/>
    <Kpi icon={BarChart3} title="FATURADO NO ANO" value={currency(data.billingYtd)} note="Acumulado do exercício"/>
    <Kpi icon={Target} title={'META '+data.targetYear} value={data.target===null?'Em apuração':count(data.target)+' economias'} note={'Água '+count(targetWater)+' · Esgoto '+count(targetSewer)}/>
    <article className="va-card va-projection"><PanelTitle icon={TrendingUp} title="PROJEÇÃO ANUAL"/><div className="va-projection-inner"><div className="va-half-gauge" style={{'--gauge':projectedWidth/2+'%'} as React.CSSProperties}><div><b>{percentage(projected)}</b><small>{projected===null?'Em apuração':'da meta anual'}</small></div></div><p>{projected!==null?'Projeção calculada pela produtividade observada, normalizada por dias de acompanhamento.':data.executed===0&&data.networkExecuted!==null&&data.networkExecuted>0?'Rede executada: '+count(data.networkExecuted,3)+' m. Ainda são 0 economias executadas; não há produtividade de economias para extrapolar a meta anual.':'Projeção aguardando pelo menos três registros ao longo de 14 dias, com avanço positivo e consistente de economias executadas.'}</p></div></article>
   </section>
   <section className="va-center-grid">
    <article className="va-card va-goals va-goals-rev">
     <PanelTitle icon={Target} title="METAS DO CONTRATO"/>
     <div className="va-goal-upper">
      <div className="va-goal-systems"><GoalRow system="Água" goal={targetWater} approved={engWater} executedTotal={data.executed} icon={Droplets}/><GoalRow system="Esgoto" goal={targetSewer} approved={engSewer} executedTotal={data.executed} icon={Waves}/></div>
      <div className="va-plan-timelines">
       <h3>CRONOGRAMA DO CONTRATO</h3>
       <div className="va-plan-timeline"><div><b>Execução contratual</b><small>Meta do contrato: {count(officialContractTotal)} economias · até 2028</small></div><div className="va-time-track"><span>2026 · {count(annualGoal(2026))}</span><span>2027 · {count(annualGoal(2027))}</span><span>2028 · {count(annualGoal(2028))}</span></div></div>
       <div className="va-plan-timeline"><div><b>Projetos / manchas</b><small>Meta da Engenharia: {count(officialContractTotal)} economias em projetos liberados até 31/05/2027</small><small className="va-project-delivery">Liberadas: {count(releasedEconomies)} economias{withoutEconomies>0?" (parcial — "+withoutEconomies+" mancha(s) sem quantitativo)":""} · {releasedStains===null?"Manchas: em apuração":count(releasedStains)+" de "+count(totalStains)+" manchas liberadas"}</small></div><div className="va-time-area"><div className="va-project-progress" role="progressbar" aria-label="Economias liberadas em projetos com quantitativos técnicos conhecidos" aria-valuemin={0} aria-valuemax={officialContractTotal} aria-valuenow={releasedEconomies??0}><i style={{width:releasedEconomies===null?"0%":Math.min(100,releasedEconomies/officialContractTotal*100)+"%"}}/></div><small className="va-project-progress-label">{releasedEconomies===null?"Aguardando liberação":count(releasedEconomies)+" economias liberadas ("+percentage(releasedEconomies/officialContractTotal*100)+" da meta"+(withoutEconomies>0?" · parcial":"")+")"}</small><div className="va-plan-signal"><span className={"va-signal-dot va-signal-"+engineeringSignal.toLowerCase()}/><b>{engineeringSignal==='INCOMPLETO'?'Ritmo não classificável — cadastro parcial':engineeringSignal==='VERDE'?'No ritmo planejado':engineeringSignal==='AMARELO'?'Atenção ao ritmo de liberações':'Ritmo abaixo do necessário'}</b><small>Referência linear de 20/07/2026 a 31/05/2027 (assinatura até meta da Engenharia). Previsto até hoje: {count(engineeringPlannedEconomies)} economias. Ritmo mínimo remanescente: {engineeringRequiredDaily===null?'—':count(engineeringRequiredDaily,1)+' economias/dia'} (estimativa, total liberado parcial).</small></div><div className="va-time-track va-time-project"><span>20/07/2026</span><span>2027</span><span>31/05/2027</span></div></div></div>
      </div>
     </div>
     <div className="va-plan-lower">
      <div className="va-plan-assessment"><h3>LEITURA DO CRONOGRAMA E DO ATAQUE DAS MANCHAS</h3><p>Cobertura da carteira de projetos frente às metas anuais de execução</p><div className="va-plan-years">{[2026,2027,2028].map(year=><div key={year}><b>{year}</b><span>Meta: {count(annualGoal(year))} economias</span><small>Projetos para estas economias: aguardando vínculo das manchas</small><em className="va-traffic va-traffic-unknown"><i/>Semáforo: não avaliado</em></div>)}</div></div>
      <div className="va-plan-targets"><h3>METAS POR ANO</h3>{[2026,2027,2028].map(year=><div key={year}><span>{year}</span><b>{count(annualGoal(year))}</b></div>)}<div className="va-plan-total"><span>Total</span><b>{count(officialContractTotal)}</b></div><small>Economias · recorte oficial informado. Números zerados no cadastro serão sinalizados para correção.</small></div>
     </div>
     <p className="va-notice-small">A execução por sistema permanece pendente enquanto não houver origem segregada. A Engenharia deve liberar até maio/2027 projetos para todas as 14.421 economias contratadas. O semáforo depende do avanço comprovado dessas entregas, não apenas da quantidade de manchas.</p>
    </article>
    <article className="va-card va-status"><PanelTitle icon={CheckCircle2} title="STATUS DAS MANCHAS POR SISTEMA" action={<Link className="va-inline-link" href="/engenharia#engenharia-classificacao">Atualizar status ↗</Link>}/><div className="va-status-grid"><StatusSystem system="Água" total={stainState?.totals.WATER??38} counts={stainState?.counts.WATER??null}/><StatusSystem system="Esgoto" total={stainState?.totals.SEWER??84} counts={stainState?.counts.SEWER??null}/></div><p className="va-notice-small">Uma mancha corresponde a um projeto por sistema: a classificação da Engenharia é refletida aqui. Projetos sem avaliação permanecem como não classificados.</p></article>
   </section>
   <section className="va-bottom-grid">
    <article className="va-card"><PanelTitle icon={FileCheck2} title="ENTREGA DA ENGENHARIA"/><p className="va-notice-small">Liberados para execução: <b>{release?.projects??'—'} projetos</b> (Sem objeção + S/Obj. com ressalvas). {partialRelease?'Totais conhecidos parciais; ainda há projetos liberados sem quantitativos técnicos.':'Quantitativos técnicos dos projetos liberados.'}</p><div className="va-two-metrics"><Mini label={'Economias liberadas'+(withoutEconomies?' · parcial':'')} value={count(releasedEconomies)} context={'Água '+count(release?.water.economies.value??null)+' · Esgoto '+count(release?.sewer.economies.value??null)}/><Mini label={'Rede liberada'+(withoutNetwork?' · parcial':'')} value={km(releasedNetwork)} context={'Água '+km(release?.water.network.value??null)+' · Esgoto '+km(release?.sewer.network.value??null)}/></div>{partialRelease&&<p className="va-notice-small">Pendente: {withoutEconomies} projeto(s) sem economias técnicas e {withoutNetwork} sem metragem de rede. O total apresentado não inclui esses valores ausentes.</p>}<Link className="va-card-action" href="/engenharia">Detalhar Engenharia ↗</Link></article>
    <article className="va-card"><PanelTitle icon={Network} title="EXECUÇÃO REAL"/><div className="va-two-metrics"><Mini label="Economias executadas" value={count(data.executed)} context="Acumulado informado"/><Mini label="Rede executada" value={km(data.networkExecuted)} context="Acumulado informado"/></div><Link className="va-card-action" href="/atualizar">Atualizar execução ↗</Link></article>
    <article className="va-card va-structures"><PanelTitle icon={Building2} title="ESTRUTURAS CADASTRADAS"/><div className="va-structure-rows"><div><Landmark size={17}/><span>Reservatórios</span><b>{structures?count(structures.reservoirs):'—'}</b></div><div><Target size={17}/><span>Boosters</span><b>{structures?count(structures.boosters):'—'}</b></div><div><Network size={17}/><span>EEEs</span><b>{structures?count(structures.eees):'—'}</b></div></div><Link className="va-card-action" href="/engenharia">Abrir obras localizadas ↗</Link></article>
    <article className="va-card va-distribution"><PanelTitle icon={MapPin} title="DISTRIBUIÇÃO DAS MANCHAS"/><div className="va-distribution-inner"><div><Droplets size={24} className="va-water"/><span>Água</span><strong>{stainState?.totals.WATER??38}</strong><small>manchas</small></div><div><Waves size={24} className="va-sewer"/><span>Esgoto</span><strong>{stainState?.totals.SEWER??84}</strong><small>manchas</small></div></div><Link className="va-card-action" href="/engenharia">Visualizar por município ↗</Link></article>
   </section>
   <div className="va-bottom-note"><span>SBON 17B · Informações provenientes dos cadastros e atualizações registrados no sistema</span><Link href="/engenharia">Vitalux Ecoativa · Engenharia</Link></div>
  </main>
 </VitaluxChrome>;
}
