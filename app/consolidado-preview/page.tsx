'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {loadDashboardData,type DashboardData} from '@/lib/dashboard-data';
import './style.css';
import {AttackPlan2026} from '@/components/AttackPlan2026';
type View='consolidado'|'agua'|'esgoto';
const fmt=(n:number|null,unit='')=>n==null?'Aguardando atualização':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n)+unit;
const money=(n:number|null)=>n==null?'Aguardando atualização':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:2}).format(n);
function Kpi({name,value,help}:{name:string;value:string;help?:string}){return <article className="sb-card sb-kpi"><span>{name}</span><strong>{value}</strong>{help&&<small>{help}</small>}</article>}
export default function ConsolidadoPreview(){
 const [data,setData]=useState<DashboardData|null>(null);
 const [view,setView]=useState<View>('consolidado');
 useEffect(()=>{void loadDashboardData().then(setData)},[]);
 if(!data)return <main className="sb-preview"><p>Carregando indicadores…</p></main>;
 const b=data.engineeringBreakdown;
 const water=view==='agua',sewer=view==='esgoto';
 return <main className="sb-preview">
  <header className="sb-heading"><div><p>VITALUX · SBON 17B · PRÉVIA DE DESENVOLVIMENTO</p><h1>Painel Gerencial de Engenharia</h1><span>Consolidado de performance, entregas e medições do contrato</span></div><Link href="/">Voltar ao painel atual ↗</Link></header>
  <nav className="sb-switch" aria-label="Sistema">{(['consolidado','agua','esgoto'] as const).map(s=><button key={s} aria-pressed={view===s} onClick={()=>setView(s)}>{s==='consolidado'?'Consolidado':s==='agua'?'Água':'Esgoto'}</button>)}</nav>
  {view==='consolidado'&&<>
   <section className="sb-cards"><Kpi name="Valor do contrato" value={money(data.contractValue)} help="Indicador original preservado"/><Kpi name="Faturado no ano" value={money(data.billingYtd)} help="Competências do exercício"/><Kpi name={`Meta ${data.targetYear}`} value={fmt(data.target,' economias')}/><Kpi name="Projeção anual" value={fmt(data.annualProjection,' economias')}/></section>
   <section className="sb-cards"><Kpi name="Economias aprovadas" value={fmt(data.available)}/><Kpi name="Rede aprovada" value={fmt(data.networkApproved,' m')}/><Kpi name="Economias executadas" value={fmt(data.executed)}/><Kpi name="Rede executada" value={fmt(data.networkExecuted,' m')}/></section>
  </>}
  <div className="sb-section-head"><h2>{water?'Entregas de Água':sewer?'Entregas de Esgoto':'Entregas por sistema'}</h2><span>Dados de Engenharia já existentes</span></div>
  <section className="sb-two">
   {!sewer&&<article className="sb-card"><h3>Água</h3><dl><div><dt>Economias aprovadas</dt><dd>{fmt(b?.waterEconomies??null)}</dd></div><div><dt>Extensão aprovada</dt><dd>{fmt(b?.waterNetwork??null,' m')}</dd></div></dl></article>}
   {!water&&<article className="sb-card"><h3>Esgoto</h3><dl><div><dt>Economias aprovadas</dt><dd>{fmt(b?.sewerEconomies??null)}</dd></div><div><dt>Extensão aprovada</dt><dd>{fmt(b?.sewerNetwork??null,' m')}</dd></div></dl></article>}
  </section>
  <AttackPlan2026 segment={view}/>
  <div className="sb-section-head"><h2>Obras e medições</h2><span>Novos cadastros em preparação</span></div>
  <section className="sb-cards sb-new"><Kpi name="EEE · unidades e CV" value="A cadastrar" help="Esgoto · enquadramento contratual"/><Kpi name="Boosters · unidades e CV" value="A cadastrar" help="Água · medição contratual"/><Kpi name="Reservatórios · unidades e m³" value="A cadastrar" help="Água · capacidade e medição"/><Kpi name="Obras sem orçamento" value="A cadastrar" help="Sem atribuir valor fictício"/></section>
  <section className="sb-two sb-lower"><article className="sb-card"><h3>Estática · controle da subcontratada</h3><p>Extensão atribuída → entregue → validada → medida → paga.</p><div className="sb-placeholder">Dados pendentes de cadastro por município, ID da mancha e sistema</div></article><article className="sb-card"><h3>Municípios e manchas</h3><p>Porangaba · Quadra · Tatuí · Conchas · Pereiras</p><div className="sb-placeholder">Detalhamento por ID da mancha, Água/Esgoto, materiais e diâmetros</div><Link href="/engenharia">Abrir Engenharia existente ↗</Link></article></section>
  <footer>Prévia sem alterações no Supabase. Indicadores existentes são carregados da mesma origem do dashboard atual; novas medições ainda não estão cadastradas.</footer>
 </main>;
}
