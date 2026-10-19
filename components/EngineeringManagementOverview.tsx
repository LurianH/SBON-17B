'use client';
import Link from 'next/link';
import {Building2,CheckCheck,ClipboardCheck,Layers3,MapPinned,Ruler,SquareStack,Warehouse} from 'lucide-react';
import {summarizeEngineering,type CurrentProject} from '@/lib/engineering';
import type {LocalizedWorkRow} from '@/lib/localized-works-model';
import type {ProjectReviewRow} from '@/lib/project-review-status';
import './engineering-management.css';

type StainSummary={waterTotal:number;sewerTotal:number;waterClassified:number;sewerClassified:number};
const number=(v:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(v);
const length=(v:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(v/1000)+' km';
const missing='Aguardando atualização';
function Kpi({label,value,sub,icon:Icon}:{label:string;value:string;sub:string;icon:typeof Layers3}){
 return <article className="em-scorecard"><div className="em-scorecard-head"><Icon size={20}/><span>{label}</span></div><strong>{value}</strong><small>{sub}</small></article>;
}
function Metric({name,amount,sub}:{name:string;amount:string;sub:string}){return <div className="em-measure"><span>{name}</span><strong>{amount}</strong><small>{sub}</small></div>;}
function metricSum(projects:CurrentProject[],field:'approved_length_m'|'pead_de63_length_m'|'pead_de110_length_m'){
 const numbers=projects.map(p=>p.current?.[field]).filter(v=>v!==null&&v!==undefined);
 return {value:numbers.length?numbers.reduce<number>((a,v)=>a+Math.round(Number(v)*1000),0)/1000:null,partial:numbers.length<projects.length};
}
function MeasureLength({value,partial}:{value:number|null;partial:boolean}){
 return <><strong>{value===null?missing:length(value)}</strong>{partial&&<small>Valor parcial: ainda há projetos sem medição</small>}</>;
}
export function EngineeringManagementOverview({projects,localizedWorks,stains,reviews}:{projects:CurrentProject[];localizedWorks:LocalizedWorkRow[];stains:StainSummary;reviews:ProjectReviewRow[]}){
 const total=summarizeEngineering(projects);
 const conceptKnown=projects.filter(project=>project.current?.concept_status!=null);
 const executiveKnown=projects.filter(project=>project.current?.executive_status!=null);
 const statusByProject=new Map(reviews.map(row=>[row.engineering_project_id,row.status]));
 const classified=projects.filter(project=>{const status=statusByProject.get(project.id);return status&&status!=='UNCLASSIFIED';}).length;
 const estatica=projects.filter(p=>p.project_category==='STATIC');
 const staticSummary=summarizeEngineering(estatica);
 const water=projects.filter(p=>p.segment_type==='WATER');
 const sewer=projects.filter(p=>p.segment_type==='SEWER');
 const waterLinear=water.filter(p=>p.project_category==='WATER_LINEAR');
 const de63=metricSum(waterLinear,'pead_de63_length_m'),de110=metricSum(waterLinear,'pead_de110_length_m');
 const sewerKm=metricSum(sewer,'approved_length_m');
 const works=(kind:'RESERVOIR'|'BOOSTER'|'EEE')=>localizedWorks.filter(w=>w.active&&w.kind===kind).reduce((sum,w)=>sum+w.quantity,0);
 return <section className="em-overview" aria-label="Visão gerencial de Engenharia">
  <div className="em-overview-header"><div><span>PAINEL DE CONTROLE · ENGENHARIA</span><h2>Projetos, aprovação e entregas</h2><p>Resumo baseado exclusivamente nos cadastros atuais do SBON 17B. Os quantitativos detalhados permanecem nas seções abaixo.</p></div><div className="em-overview-actions"><a href="#engenharia-classificacao">Classificar projetos →</a><Link href="/manchas">Consultar manchas GIS →</Link></div></div>
  <div className="em-scorecards">
   <Kpi icon={Layers3} label="Projetos cadastrados" value={number(total.count)} sub={number(classified)+' classificados · '+number(total.count-classified)+' pendentes'}/>
   <Kpi icon={CheckCheck} label="Concepções aprovadas · dados técnicos" value={conceptKnown.length?number(total.approved):'—'} sub={conceptKnown.length?`${number(total.approved)} de ${number(conceptKnown.length)} com status técnico informado`:'Aguardando informação de aprovação técnica'}/>
   <Kpi icon={ClipboardCheck} label="Executivos finalizados · dados técnicos" value={executiveKnown.length?number(total.completed):'—'} sub={executiveKnown.length?`${number(total.completed)} de ${number(executiveKnown.length)} com status técnico informado`:'Aguardando informação técnica dos executivos'}/>
   <Kpi icon={Building2} label="Contratada Estática" value={number(estatica.length)} sub="Projetos classificados como Estática"/>
  </div>
  <div className="em-highlight-row">
   <article className="em-block">
    <div className="em-block-title"><Building2 size={20}/><h3>Controle de entregas · Estática</h3></div>
    <div className="em-progress-data"><Metric name="Projetos registrados" amount={number(estatica.length)} sub="Categoria Estática"/><Metric name="Concepções aprovadas" amount={number(staticSummary.approved)} sub="Sala de Guerra"/><Metric name="Executivos finalizados" amount={number(staticSummary.completed)} sub="Status do cadastro"/></div>
    {estatica.length===0?<p className="em-note">Nenhum projeto atualmente classificado como Estática. Quando os registros forem identificados nessa categoria, estes indicadores serão atualizados automaticamente.</p>:<div className="em-progress-bar"><div style={{width:Math.min(100,staticSummary.executivePercent??0)+'%'}}/></div>}
   </article>
   <article className="em-block">
    <div className="em-block-title"><MapPinned size={20}/><h3>Manchas contratuais · por sistema</h3></div>
    <div className="em-stain-grid"><div><span>Água</span><strong>{number(stains.waterTotal)}</strong><small>{stains.waterClassified} classificadas</small></div><div><span>Esgoto</span><strong>{number(stains.sewerTotal)}</strong><small>{stains.sewerClassified} classificadas</small></div></div>
    <p className="em-note">Cada mancha GIS corresponde a um projeto por sistema: 38 projetos de Água e 84 de Esgoto. Classifique pela Engenharia; Manchas e Dashboard mostram os mesmos status.</p>
   </article>
  </div>
  <div className="em-highlight-row">
   <article className="em-block">
    <div className="em-block-title"><Ruler size={20}/><h3>Obras lineares · extensão cadastrada</h3></div>
    <div className="em-progress-data">
     <div className="em-measure"><span>Água · PEAD DE63</span><MeasureLength value={de63.value} partial={de63.partial}/></div>
     <div className="em-measure"><span>Água · PEAD DE110</span><MeasureLength value={de110.value} partial={de110.partial}/></div>
     <div className="em-measure"><span>Esgoto · rede aprovada</span><MeasureLength value={sewerKm.value} partial={sewerKm.partial}/></div>
    </div>
    <p className="em-note">Detalhamento por mancha e município na tabela de Obras Lineares de Água; Esgoto sem diâmetros cadastrados não recebe valores presumidos.</p>
    <a href="#water-linear-title" className="em-inline-link">Consultar rede por mancha →</a>
   </article>
   <article className="em-block">
    <div className="em-block-title"><Warehouse size={20}/><h3>Obras localizadas · registradas</h3></div>
    <div className="em-progress-data"><Metric name="Reservatórios" amount={number(works('RESERVOIR'))} sub="Unidades cadastradas"/><Metric name="Boosters" amount={number(works('BOOSTER'))} sub="Unidades cadastradas"/><Metric name="EEEs" amount={number(works('EEE'))} sub="Unidades cadastradas"/></div>
    <p className="em-note">As situações de projeto, execução, orçamento e o histórico permanente permanecem editáveis na seção de obras localizadas.</p>
    <a href="#engenharia-estruturas" className="em-inline-link">Consultar estruturas →</a>
   </article>
  </div>
 </section>;
}
