'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {BarChart3,Building2,CalendarDays,CheckCircle2,ClipboardList,Droplets,FileCheck2,FileText,Landmark,MapPin,Network,Target,TrendingUp,TriangleAlert,Waves} from 'lucide-react';
import {MainNavigation} from '@/components/MainNavigation';
import {LogoutButton} from '@/components/LogoutButton';
import {loadDashboardData,type DashboardData} from '@/lib/dashboard-data';
import {createClient} from '@/lib/supabase/client';
import './approved-dashboard.css';

type Structures={reservoirs:number;boosters:number;eees:number};
const count=(v:number|null,decimals=0)=>v===null?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:decimals}).format(v);
const currency=(v:number|null)=>v===null?'Em apuração':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:2}).format(v);
const km=(v:number|null)=>v===null?'—':count(v/1000,2)+' km';
const percentage=(v:number|null)=>v===null?'—':count(v,1)+'%';
const ratio=(numerator:number|null,denominator:number|null)=>numerator===null||denominator===null||denominator<=0?null:numerator/denominator*100;
const date=(v:string|null)=>v?new Intl.DateTimeFormat('pt-BR').format(new Date(v+'T12:00:00')):'Aguardando atualização';
const absence='Ainda não informado';

function PanelTitle({icon:Icon,title,action}:{icon:typeof Target,title:string,action?:React.ReactNode}){
 return <div className="va-panel-title"><div><Icon size={22} strokeWidth={2.2}/><h2>{title}</h2></div>{action}</div>;
}
function Kpi({icon:Icon,title,value,note}:{icon:typeof Target,title:string,value:string,note:string}){
 return <article className="va-card va-kpi"><div className="va-kpi-title"><Icon size={20}/><h2>{title}</h2></div><strong>{value}</strong><small>{note}</small></article>;
}
function GoalRow({system,goal,approved,icon:Icon}:{system:'Água'|'Esgoto';goal:number|null;approved:number|null;icon:typeof Droplets}){
 const engineeringRatio=ratio(approved,goal);
 return <div className="va-goal-row">
  <div className="va-goal-system"><Icon size={30} className={system==='Água'?'va-water':'va-sewer'}/><div><b>{system}</b><small>Meta: {goal===null?absence:count(goal)+' economias'}</small></div></div>
  <div className="va-goal-graphic"><div className="va-progress va-progress-empty" aria-label={'Execução de '+system+' ainda não segregada por sistema'}><span/></div><div className="va-goal-numbers"><span>Executadas: <b>—</b></span><span>A executar: <b>—</b></span></div><small className="va-goal-context">Aprovadas na Engenharia: {count(approved)}{engineeringRatio===null?'':' ('+percentage(engineeringRatio)+' da meta)'}</small></div>
  <div className="va-goal-percent"><strong>—</strong><small>execução por sistema pendente</small></div>
 </div>;
}
function StatusSystem({system,total}:{system:'Água'|'Esgoto';total:number}){
 const Icon=system==='Água'?Droplets:Waves;
 return <div className="va-status-system">
  <div className="va-status-name"><Icon size={22} className={system==='Água'?'va-water':'va-sewer'}/><div><b>{system}</b><small>Total contratual: {total} manchas</small></div></div>
  <div className="va-status-detail">
   <div className="va-status-donut" role="img" aria-label={total+' manchas de '+system+'; situação de cada mancha ainda não classificada'}><div><small>Total</small><strong>{total}</strong></div></div>
   <div className="va-status-legend"><div><span><i className="va-dot va-dot-unclassified"/>Sem classificação</span><b>{total} · 100%</b></div><div><span><i className="va-dot va-dot-approved"/>Sem objeção</span><b>—</b></div><div><span><i className="va-dot va-dot-reserved"/>Com ressalvas</span><b>—</b></div><div><span><i className="va-dot va-dot-review"/>Em elaboração/revisão</span><b>—</b></div><div><span><i className="va-dot va-dot-notstarted"/>A iniciar</span><b>—</b></div></div>
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
 useEffect(()=>{
  let active=true;
  void (async()=>{
   const result=await loadDashboardData();
   if(!active)return;
   setData(result);
   if(!result.contractId||result.source!=='supabase')return;
   const db=createClient();if(!db)return;
   const {data:rows,error}=await db.from('engineering_localized_works').select('kind,quantity').eq('contract_id',result.contractId).eq('active',true);
   if(!active||error||!rows)return;
   const next={reservoirs:0,boosters:0,eees:0};
   for(const row of rows){const q=Number(row.quantity)||0;if(row.kind==='RESERVOIR')next.reservoirs+=q;if(row.kind==='BOOSTER')next.boosters+=q;if(row.kind==='EEE')next.eees+=q;}
   setStructures(next);
  })();
  return()=>{active=false};
 },[]);
 if(!data)return <div className="va-loading">Carregando painel gerencial Vitalux…</div>;
 const targetWater=data.targetBreakdown?.water??null,targetSewer=data.targetBreakdown?.sewer??null;
 const engWater=data.engineeringBreakdown?.waterEconomies??null,engSewer=data.engineeringBreakdown?.sewerEconomies??null;
 const netWater=data.engineeringBreakdown?.waterNetwork??null,netSewer=data.engineeringBreakdown?.sewerNetwork??null;
 const projected=ratio(data.annualProjection,data.target);
 const projectedWidth=projected===null?0:Math.max(0,Math.min(100,projected));
 return <div className="va-app">
  <header className="va-header"><div className="va-wordmark"><div><b>vitalux</b><em>eco</em></div><small>projetos sustentáveis</small></div><div className="va-header-rule"/><div className="va-breadcrumb">Painel Gerencial <span>›</span> <strong>SBON 17B</strong></div><div className="va-header-right"><div className="va-date"><CalendarDays size={20}/><span>Dados de execução<small>{date(data.latestDate)}</small></span></div><div className="va-period"><span>Período<small>{data.targetYear} (ano)</small></span></div><LogoutButton/></div></header>
  <aside className="va-sidebar"><MainNavigation/><div className="va-sidebar-end"><span className="va-leaf">♧</span><p>Infraestrutura<br/>para um futuro<br/>mais sustentável.</p></div></aside>
  <main className="va-main">
   <section className="va-top-grid">
    <Kpi icon={FileText} title="VALOR DO CONTRATO" value={currency(data.contractValue)} note="Contrato consolidado"/>
    <Kpi icon={BarChart3} title="FATURADO NO ANO" value={currency(data.billingYtd)} note="Acumulado do exercício"/>
    <Kpi icon={Target} title={'META '+data.targetYear} value={data.target===null?'Em apuração':count(data.target)+' economias'} note={'Água '+count(targetWater)+' · Esgoto '+count(targetSewer)}/>
    <article className="va-card va-projection"><PanelTitle icon={TrendingUp} title="PROJEÇÃO ANUAL"/><div className="va-projection-inner"><div className="va-half-gauge" style={{'--gauge':projectedWidth+'%'} as React.CSSProperties}><div><b>{percentage(projected)}</b><small>{projected===null?'Em apuração':'da meta anual'}</small></div></div><p>{projected===null?'Sem série de execução suficiente para projeção confiável.':'Projeção calculada a partir dos registros disponíveis.'}</p></div></article>
   </section>
   <section className="va-center-grid">
    <article className="va-card va-goals"><PanelTitle icon={Target} title="METAS DO CONTRATO" action={<span className="va-caption-legend">Execução segregada por sistema: pendente</span>}/><GoalRow system="Água" goal={targetWater} approved={engWater} icon={Droplets}/><GoalRow system="Esgoto" goal={targetSewer} approved={engSewer} icon={Waves}/><p className="va-notice-small">A execução cadastrada hoje é consolidada. Não distribuímos as economias executadas entre Água e Esgoto sem o registro de origem.</p></article>
    <article className="va-card va-status"><PanelTitle icon={CheckCircle2} title="STATUS POR SISTEMA"/><div className="va-status-grid"><StatusSystem system="Água" total={28}/><StatusSystem system="Esgoto" total={74}/></div><p className="va-notice-small">Manchas contratuais: classificação individual ainda não registrada. Os totais 28 e 74 não são os quantitativos de projetos.</p></article>
    <Deviation data={data}/>
   </section>
   <section className="va-bottom-grid">
    <article className="va-card"><PanelTitle icon={FileCheck2} title="ENTREGA DA ENGENHARIA"/><div className="va-two-metrics"><Mini label="Economias aprovadas" value={count(data.available)} context={'Água '+count(engWater)+' · Esgoto '+count(engSewer)}/><Mini label="Rede aprovada" value={km(data.networkApproved)} context={'Água '+km(netWater)+' · Esgoto '+km(netSewer)}/></div><Link className="va-card-action" href="/engenharia">Detalhar Engenharia ↗</Link></article>
    <article className="va-card"><PanelTitle icon={Network} title="EXECUÇÃO REAL"/><div className="va-two-metrics"><Mini label="Economias executadas" value={count(data.executed)} context="Acumulado informado"/><Mini label="Rede executada" value={km(data.networkExecuted)} context="Acumulado informado"/></div><Link className="va-card-action" href="/atualizar">Atualizar execução ↗</Link></article>
    <article className="va-card va-structures"><PanelTitle icon={Building2} title="ESTRUTURAS CADASTRADAS"/><div className="va-structure-rows"><div><Landmark size={17}/><span>Reservatórios</span><b>{structures?count(structures.reservoirs):'—'}</b></div><div><Target size={17}/><span>Boosters</span><b>{structures?count(structures.boosters):'—'}</b></div><div><Network size={17}/><span>EEEs</span><b>{structures?count(structures.eees):'—'}</b></div></div><Link className="va-card-action" href="/engenharia">Abrir obras localizadas ↗</Link></article>
    <article className="va-card va-distribution"><PanelTitle icon={MapPin} title="DISTRIBUIÇÃO DAS MANCHAS"/><div className="va-distribution-inner"><div><Droplets size={24} className="va-water"/><span>Água</span><strong>28</strong><small>manchas</small></div><div><Waves size={24} className="va-sewer"/><span>Esgoto</span><strong>74</strong><small>manchas</small></div></div><Link className="va-card-action" href="/engenharia">Visualizar por município ↗</Link></article>
   </section>
   <div className="va-bottom-note"><span>SBON 17B · Informações provenientes dos cadastros e atualizações registrados no sistema</span><Link href="/engenharia">Vitalux Ecoativa · Engenharia</Link></div>
  </main>
 </div>;
}
