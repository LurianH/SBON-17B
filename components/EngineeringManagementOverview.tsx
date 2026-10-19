'use client';
import Link from 'next/link';
import {ClipboardList,Droplets,Layers3,Ruler,Warehouse,Waves} from 'lucide-react';
import type {CurrentProject} from '@/lib/engineering';
import type {LocalizedWorkRow} from '@/lib/localized-works-model';
import {projectReviewLabels,type ProjectReviewRow,type ProjectReviewStatus} from '@/lib/project-review-status';
import './engineering-management.css';

const number=(v:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(v);
const length=(v:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(v/1000)+' km';
const missing='Aguardando dados técnicos';
const statusKeys:ProjectReviewStatus[]=['NO_OBJECTION','NO_OBJECTION_RESERVATIONS','IN_PREPARATION','IN_REVIEW','NOT_STARTED','CANCELLED','UNCLASSIFIED'];

function Kpi({label,value,sub,icon:Icon}:{label:string;value:string;sub:string;icon:typeof Layers3}){
 return <article className="em-scorecard"><div className="em-scorecard-head"><Icon size={20}/><span>{label}</span></div><strong>{value}</strong><small>{sub}</small></article>;
}
function Metric({name,amount,sub}:{name:string;amount:string;sub:string}){
 return <div className="em-measure"><span>{name}</span><strong>{amount}</strong><small>{sub}</small></div>;
}
function metricSum(projects:CurrentProject[],field:'approved_length_m'|'pead_de63_length_m'|'pead_de110_length_m'){
 const numbers=projects.map(p=>p.current?.[field]).filter(v=>v!==null&&v!==undefined);
 return {value:numbers.length?numbers.reduce<number>((a,v)=>a+Math.round(Number(v)*1000),0)/1000:null,partial:numbers.length<projects.length};
}
function MeasureLength({value,partial}:{value:number|null;partial:boolean}){
 return <><strong>{value===null?missing:length(value)}</strong>{partial&&<small>Valor parcial: há projetos sem metragem técnica cadastrada</small>}</>;
}
function SystemStatus({segment,projects,statusByProject}:{segment:'WATER'|'SEWER';projects:CurrentProject[];statusByProject:Map<string,ProjectReviewStatus>}){
 const filtered=projects.filter(project=>project.segment_type===segment);
 const all=filtered.length;
 const counts=statusKeys.map(key=>({
  key,
  label:key==='UNCLASSIFIED'?'Sem classificação':projectReviewLabels[key],
  count:filtered.filter(project=>(statusByProject.get(project.id)??'UNCLASSIFIED')===key).length
 })).filter(entry=>entry.count>0);
 const open=counts.find(row=>row.key==='UNCLASSIFIED')?.count??0;
 const Icon=segment==='WATER'?Droplets:Waves;
 return <article className="em-block em-status-block" aria-label={'Status dos projetos de '+(segment==='WATER'?'Água':'Esgoto')}>
  <div className="em-block-title"><Icon size={20}/><h3>{segment==='WATER'?'Água':'Esgoto'} · status dos projetos</h3></div>
  <div className="em-status-head"><strong>{number(all)} <span>projetos</span></strong><small>{number(all-open)} com status informado{open?' · '+number(open)+' sem classificação':''}</small></div>
  <div className="em-status-rows">
   {counts.map(item=><div className="em-status-row" key={item.key}>
    <div className="em-status-label"><span>{item.label}</span><strong>{number(item.count)} <small>· {all?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(item.count/all*100):'0'}%</small></strong></div>
    <div className="em-status-track" role="img" aria-label={item.label+': '+item.count+' de '+all+' projetos'}>
     <span data-status={item.key} style={{width:(all?item.count/all*100:0)+'%'}}/>
    </div>
   </div>)}
  </div>
 </article>;
}
export function EngineeringManagementOverview({projects,localizedWorks,reviews}:{projects:CurrentProject[];localizedWorks:LocalizedWorkRow[];reviews:ProjectReviewRow[]}){
 const statusByProject=new Map<string,ProjectReviewStatus>(reviews.map(row=>[row.engineering_project_id,row.status]));
 const water=projects.filter(p=>p.segment_type==='WATER');
 const sewer=projects.filter(p=>p.segment_type==='SEWER');
 const classified=projects.filter(project=>(statusByProject.get(project.id)??'UNCLASSIFIED')!=='UNCLASSIFIED').length;
 const cancelled=projects.filter(project=>statusByProject.get(project.id)==='CANCELLED').length;
 const waterLinear=water.filter(p=>p.project_category==='WATER_LINEAR');
 const de63=metricSum(waterLinear,'pead_de63_length_m'),de110=metricSum(waterLinear,'pead_de110_length_m');
 const sewerKm=metricSum(sewer,'approved_length_m');
 const works=(kind:'RESERVOIR'|'BOOSTER'|'EEE')=>localizedWorks.filter(w=>w.active&&w.kind===kind).reduce((sum,w)=>sum+w.quantity,0);
 return <section className="em-overview" aria-label="Panorama de projetos de Engenharia">
  <div className="em-overview-header">
   <div><span>PAINEL DE CONTROLE · ENGENHARIA</span><h2>Projetos por sistema e situação</h2><p>Um projeto por mancha GIS e por sistema. Status gerencial não representa, por si só, aprovação técnica de concepção ou de projeto executivo.</p></div>
   <div className="em-overview-actions"><a href="#engenharia-classificacao">Classificar projetos →</a><Link href="/manchas">Consultar manchas GIS →</Link></div>
  </div>
  <div className="em-scorecards">
   <Kpi icon={Layers3} label="Projetos cadastrados" value={number(projects.length)} sub="Total de Água e Esgoto, nos filtros selecionados"/>
   <Kpi icon={Droplets} label="Projetos de Água" value={number(water.length)} sub="Uma linha de projeto por mancha de Água"/>
   <Kpi icon={Waves} label="Projetos de Esgoto" value={number(sewer.length)} sub="Uma linha de projeto por mancha de Esgoto"/>
   <Kpi icon={ClipboardList} label="Com status informado" value={number(classified)+' / '+number(projects.length)} sub={number(projects.length-classified)+' sem classificação · '+number(cancelled)+' cancelados (por sistema)'}/>
  </div>
  <div className="em-highlight-row">
   <SystemStatus segment="WATER" projects={projects} statusByProject={statusByProject}/>
   <SystemStatus segment="SEWER" projects={projects} statusByProject={statusByProject}/>
  </div>
  <div className="em-highlight-row">
   <article className="em-block">
    <div className="em-block-title"><Ruler size={20}/><h3>Obras lineares · extensão cadastrada</h3></div>
    <div className="em-progress-data">
     <div className="em-measure"><span>Água · PEAD DE63</span><MeasureLength value={de63.value} partial={de63.partial}/></div>
     <div className="em-measure"><span>Água · PEAD DE110</span><MeasureLength value={de110.value} partial={de110.partial}/></div>
     <div className="em-measure"><span>Esgoto · rede aprovada</span><MeasureLength value={sewerKm.value} partial={sewerKm.partial}/></div>
    </div>
    <p className="em-note">Somente metragens informadas na Engenharia são somadas; as economias GIS não são convertidas em metros. Ausência de dados técnicos não significa aprovação negada.</p>
    <a href="#water-linear-title" className="em-inline-link">Consultar redes de Água →</a>
   </article>
   <article className="em-block">
    <div className="em-block-title"><Warehouse size={20}/><h3>Obras localizadas · registradas</h3></div>
    <div className="em-progress-data">
     <Metric name="Reservatórios" amount={number(works('RESERVOIR'))} sub="Unidades cadastradas"/>
     <Metric name="Boosters" amount={number(works('BOOSTER'))} sub="Unidades cadastradas"/>
     <Metric name="EEEs" amount={number(works('EEE'))} sub="Unidades cadastradas"/>
    </div>
    <p className="em-note">Reservatórios, boosters e EEEs são obras localizadas e não devem ser confundidos com o número de projetos da categoria Estática.</p>
    <a href="#engenharia-estruturas" className="em-inline-link">Consultar obras localizadas →</a>
   </article>
  </div>
 </section>;
}
