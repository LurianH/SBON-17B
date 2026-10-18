'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {MainNavigation} from '@/components/MainNavigation';
import {LogoutButton} from '@/components/LogoutButton';
import {loadDashboardData,type DashboardData} from '@/lib/dashboard-data';
import './executive-dashboard.css';
const fmt=(v:number|null,d=0)=>v===null?'Aguardando dados':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:d}).format(v);
const brl=(v:number|null)=>v===null?'Aguardando atualização':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:2}).format(v);
const pct=(n:number|null,d:number|null)=>n===null||d===null||d<=0?null:n/d*100;
const percent=(v:number|null)=>v===null?'—':fmt(v,1)+'%';
function Kpi({label,value,note}:{label:string;value:string;note:string}){return <article className="exec-kpi"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>}
function ManchaOverview({kind,total}:{kind:'Água'|'Esgoto';total:number}){return <article className="exec-card exec-mancha"><div className="exec-card-heading"><div><span className="exec-eyebrow">MANCHAS CONTRATUAIS</span><h3>{kind}</h3></div><Link href="/engenharia">Ver projetos →</Link></div><div className="exec-mancha-content"><div className="exec-donut" role="img" aria-label={total+' manchas de '+kind+'; classificação individual pendente'}><div><strong>{total}</strong><span>manchas</span></div></div><div className="exec-legend"><div><span>Sem classificação consolidada</span><b>{total} · 100%</b></div><div><span>Sem objeção</span><b>—</b></div><div><span>Sem objeção com ressalvas</span><b>—</b></div><div><span>Em elaboração / revisão</span><b>—</b></div><div><span>A iniciar</span><b>—</b></div></div></div><p className="exec-footnote">Base contratual: {total} manchas. Os projetos cadastrados não são equivalentes a manchas; os percentuais por situação aparecerão após classificar cada mancha.</p></article>}
export default function Home(){
 const [data,setData]=useState<DashboardData|null>(null);
 useEffect(()=>{void loadDashboardData().then(setData)},[]);
 if(!data)return <main className="exec-loading">Carregando painel SBON 17B…</main>;
 const water=data.engineeringBreakdown?.waterNetwork??null;
 const sewer=data.engineeringBreakdown?.sewerNetwork??null;
 const waterEco=data.engineeringBreakdown?.waterEconomies??null;
 const sewerEco=data.engineeringBreakdown?.sewerEconomies??null;
 const targetW=data.targetBreakdown?.water??null;
 const targetS=data.targetBreakdown?.sewer??null;
 const physicalPct=pct(data.executed,data.target);
 const today=data.latestDate?new Intl.DateTimeFormat('pt-BR').format(new Date(data.latestDate+'T12:00:00')):'Sem atualização de execução';
 return <div className="app exec-shell"><header className="topbar"><div className="brand"><span className="mark">V</span><span><b>vitalux</b><small>ECOATIVA</small></span></div><MainNavigation/><div className="header-actions"><span className="updated">Última execução: <b>{today}</b></span><LogoutButton/></div></header>
 <main className="exec-main">
  <div className="exec-title"><div><span className="exec-eyebrow">PERFORMANCE CONTRATUAL · VISÃO GERENCIAL</span><h1>SBON 17B <small>Painel executivo</small></h1><p>Indicadores de metas, engenharia, execução e situação dos projetos · Vitalux Ecoativa</p></div><Link className="exec-top-link" href="/engenharia">Abrir Engenharia ↗</Link></div>
  <section className="exec-kpi-grid" aria-label="Indicadores do contrato">
   <Kpi label="Valor do contrato" value={brl(data.contractValue)} note="Valor contratual cadastrado"/>
   <Kpi label="Faturamento acumulado no ano" value={brl(data.billingYtd)} note="Medições financeiras registradas"/>
   <Kpi label={'Meta contratual '+data.targetYear} value={data.target===null?'Aguardando meta':fmt(data.target)+' economias'} note={'Água: '+fmt(targetW)+' · Esgoto: '+fmt(targetS)}/>
   <Kpi label="Economias executadas" value={fmt(data.executed)} note={'Cumprimento da meta total: '+percent(physicalPct)+' · último registro'}/>
  </section>
  <div className="exec-section-title"><h2>01 · Situação das manchas</h2><p>Distribuição por sistema; o total de cada mancha é independente dos projetos e subprojetos.</p></div>
  <section className="exec-two"><ManchaOverview kind="Água" total={28}/><ManchaOverview kind="Esgoto" total={74}/></section>
  <div className="exec-section-title"><h2>02 · Metas do contrato</h2><p>Comparativo da meta e das entregas documentadas, sem equivalência entre economias e metros de rede.</p></div>
  <section className="exec-two">
   <article className="exec-card"><div className="exec-card-heading"><h3>Água</h3><Link href="/engenharia">Detalhes →</Link></div><div className="exec-facts"><div><span>Meta anual · economias</span><strong>{fmt(targetW)}</strong></div><div><span>Economias aprovadas · Engenharia</span><strong>{fmt(waterEco)}</strong></div><div><span>Rede aprovada</span><strong>{water===null?'Aguardando dados':fmt(water/1000,3)+' km'}</strong></div></div><p className="exec-footnote">A execução total informada não é segregada por sistema na fonte atual. Não distribuímos economias executadas entre Água e Esgoto por estimativa.</p></article>
   <article className="exec-card"><div className="exec-card-heading"><h3>Esgoto</h3><Link href="/engenharia">Detalhes →</Link></div><div className="exec-facts"><div><span>Meta anual · economias</span><strong>{fmt(targetS)}</strong></div><div><span>Economias aprovadas · Engenharia</span><strong>{fmt(sewerEco)}</strong></div><div><span>Rede aprovada</span><strong>{sewer===null?'Aguardando dados':fmt(sewer/1000,3)+' km'}</strong></div></div><p className="exec-footnote">Metragem da rede é apresentada em quilômetros, sem conversão para economias.</p></article>
  </section>
  <div className="exec-section-title"><h2>03 · Gestão de entregas</h2><p>Atalhos para acompanhar engenharia, interferências e frentes que precisam de decisão.</p></div>
  <section className="exec-three">
   <Link className="exec-navigation-card" href="/engenharia"><span>ENGENHARIA</span><strong>Projetos e entregas da Estática</strong><small>Concepções, executivos, obras localizadas, rede por diâmetro e município.</small><b>Consultar engenharia →</b></Link>
   <Link className="exec-navigation-card" href="/analise"><span>ANÁLISE GERENCIAL</span><strong>Interferências e desvios</strong><small>Identificar pendências e fatores que comprometem entregas e metas.</small><b>Acessar análise →</b></Link>
   <Link className="exec-navigation-card" href="/acoes"><span>PLANOS DE AÇÃO</span><strong>{fmt(data.openActions)} ações em aberto</strong><small>Registro e tratamento das pendências do contrato.</small><b>Ver ações →</b></Link>
  </section>
  <section className="exec-projection"><span>PROJEÇÃO ANUAL</span><strong>{data.annualProjection===null?'Em apuração':fmt(data.annualProjection)+' economias'}</strong><p>{data.annualProjection===null?'Série histórica insuficiente para projeção confiável.': 'Projeção calculada pelas atualizações de execução cadastradas.'} Os indicadores são atualizados a partir do Supabase; não há números de projeto fictícios.</p></section>
 </main><footer><span>SBON 17B · Vitalux Ecoativa</span><span>Atualização dos dados pela interface de gestão existente</span></footer></div>;
}