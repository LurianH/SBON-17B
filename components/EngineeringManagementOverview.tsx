'use client';
import Link from 'next/link';
import {ClipboardList,Droplets,Layers3,Waves} from 'lucide-react';
import type {CurrentProject} from '@/lib/engineering';
import {projectReviewLabels,type ProjectReviewRow,type ProjectReviewStatus} from '@/lib/project-review-status';
import './engineering-management.css';

const number=(v:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(v);
const statusKeys:ProjectReviewStatus[]=['NO_OBJECTION','NO_OBJECTION_RESERVATIONS','IN_PREPARATION','IN_REVIEW','NOT_STARTED','CANCELLED','UNCLASSIFIED'];

function Kpi({label,value,sub,icon:Icon}:{label:string;value:string;sub:string;icon:typeof Layers3}){
 return <article className="em-scorecard"><div className="em-scorecard-head"><Icon size={20}/><span>{label}</span></div><strong>{value}</strong><small>{sub}</small></article>;
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
export function EngineeringManagementOverview({projects,reviews}:{projects:CurrentProject[];reviews:ProjectReviewRow[]}){
 const statusByProject=new Map<string,ProjectReviewStatus>(reviews.map(r=>[r.engineering_project_id,r.status]));
 const water=projects.filter(p=>p.segment_type==='WATER');
 const sewer=projects.filter(p=>p.segment_type==='SEWER');
 const classified=projects.filter(p=>(statusByProject.get(p.id)??'UNCLASSIFIED')!=='UNCLASSIFIED').length;
 const released=projects.filter(p=>['NO_OBJECTION','NO_OBJECTION_RESERVATIONS'].includes(statusByProject.get(p.id)??'')).length;
 return <section className="em-overview" aria-label="Visão gerencial de projetos">
  <div className="em-overview-header">
   <div><span>PAINEL DE CONTROLE · ENGENHARIA</span><h2>Projetos e situação por sistema</h2>
    <p>Os status são separados por sistema. Sem objeção e S/Obj. com ressalvas entram juntos como liberação para execução.</p></div>
   <div className="em-overview-actions"><a href="#engenharia-projetos">Cadastrar / atualizar projetos →</a><Link href="/manchas">Consultar GIS →</Link></div>
  </div>
  <div className="em-scorecards">
   <Kpi icon={Layers3} label="Projetos por sistema" value={number(projects.length)} sub="Água e Esgoto conforme filtros"/>
   <Kpi icon={Droplets} label="Projetos de Água" value={number(water.length)} sub="Frentes de Água"/>
   <Kpi icon={Waves} label="Projetos de Esgoto" value={number(sewer.length)} sub="Frentes de Esgoto"/>
   <Kpi icon={ClipboardList} label="Liberados para execução" value={number(released)} sub={number(classified)+' com situação informada · '+number(projects.length-classified)+' pendente(s)'}/>
  </div>
  <div className="em-highlight-row">
   <SystemStatus segment="WATER" projects={projects} statusByProject={statusByProject}/>
   <SystemStatus segment="SEWER" projects={projects} statusByProject={statusByProject}/>
  </div>
 </section>;
}
