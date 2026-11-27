import {isOperationallyReleased,RELEASE_POLICY_DESCRIPTION} from '@/lib/engineering-release-policy';
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
const date=(v:string|null)=>v?new Intl.DateTimeFormat('pt-BR').format(new Date(v+'T12:00:00')):'Aguardando atualização';
const absence='Ainda não informado';
// Recorte contratual confirmado pela fiscalização; não representa execução realizada.
const officialAnnualTargets:Record<number,number>={2026:1709,2027:8124,2028:4588};
const officialContractTotal=14421;
// Cronograma Fase 1, revisão 0B (E2786-00-CR-GR-001): datas da linha principal de cada frente.
// São marcos de término previstos, não aprovações formais nem percentuais físicos interpolados.
const staticSchedule=[
 {name:'Vila Americana',codes:['687-AF-73'],due:'2026-10-02'},
 {name:'Ypê I',codes:['553-AF-92'],due:'2026-11-13'},
 {name:'Ypê II',codes:['553-AF-91'],due:'2026-11-13'},
 {name:'Lagoa Vermelha',codes:['687-AF-47','687-AF-20','687-AF-52'],due:'2026-11-20'},
 {name:'Vila Angélica',codes:['687-AF-66'],due:'2026-11-23'},
 {name:'São Bento / Vaz / Centro',codes:['764-AF-109','764-AF-111','764-AF-113','764-AF-93','764-AF-97','764-AF-98'],due:'2026-12-11'},
 {name:'Gramado',codes:['687-AF-403'],due:'2027-01-15'}
] as const;
const scheduleStart='2026-09-30',scheduleEnd='2027-01-15';
const dateOffset=(value:string)=>(Date.parse(value+'T12:00:00Z')-Date.parse(scheduleStart+'T12:00:00Z'))/(Date.parse(scheduleEnd+'T12:00:00Z')-Date.parse(scheduleStart+'T12:00:00Z'));
const chartX=(day:string)=>36+Math.max(0,Math.min(1,dateOffset(day)))*338;
const chartY=(n:number)=>135-Math.max(0,Math.min(staticSchedule.length,n))/staticSchedule.length*112;
const stepPath=(points:{date:string;count:number}[],end:string)=>{
 let result='M '+chartX(scheduleStart)+' '+chartY(0);
 for(const point of points)result+=' H '+chartX(point.date)+' V '+chartY(point.count);
 return result+' H '+chartX(end);
};
// Suavização monotônica do plano: passa exatamente pelos marcos sem ultrapassar
// a faixa [0,7]. Não representa produtividade diária medida.
const smoothPlannedPath=(milestones:{date:string;count:number}[])=>{
 const nodes=[{x:chartX(scheduleStart),y:chartY(0)},...milestones.map(p=>({x:chartX(p.date),y:chartY(p.count)}))];
 if(nodes.length<2)return '';
 const secants=nodes.slice(1).map((p,i)=>(p.y-nodes[i].y)/(p.x-nodes[i].x));
 const slopes=nodes.map((_,i)=>{
   if(i===0)return secants[0];
   if(i===nodes.length-1)return secants[secants.length-1];
   const before=secants[i-1],after=secants[i];
   if(before*after<=0)return 0;
   const left=nodes[i].x-nodes[i-1].x,right=nodes[i+1].x-nodes[i].x;
   const w1=2*right+left,w2=right+2*left;
   return (w1+w2)/(w1/before+w2/after);
 });
 // Clamp each Bézier derivative to preserve monotonicity.
 const safe=[...slopes];
 for(let i=0;i<secants.length;i++){
   const d=secants[i];
   if(d===0){safe[i]=0;safe[i+1]=0;continue;}
   const a=safe[i]/d,b=safe[i+1]/d;
   const magnitude=a*a+b*b;
   if(magnitude>9){const scale=3/Math.sqrt(magnitude);safe[i]=scale*a*d;safe[i+1]=scale*b*d;}
 }
 let path='M '+nodes[0].x+' '+nodes[0].y;
 for(let i=0;i<nodes.length-1;i++){
   const a=nodes[i],b=nodes[i+1],dx=(b.x-a.x)/3;
   path+=' C '+(a.x+dx)+' '+(a.y+dx*safe[i])+' '+(b.x-dx)+' '+(b.y-dx*safe[i+1])+' '+b.x+' '+b.y;
 }
 return path;
};
const projectCode=(name:string)=>{
 const match=name.match(/(?:^|\s)(\d{3}[-_](?:AF|AR)[-_]\d+N?)(?=\s|·|$)/i);
 return match?.[1]?.replaceAll('_','-').toUpperCase()??'';
};
const releasedStatus=(v:string)=>v==='NO_OBJECTION'||v==='NO_OBJECTION_RESERVATIONS';

function PanelTitle({icon:Icon,title,action}:{icon:typeof Target,title:string,action?:React.ReactNode}){
 return <div className="va-panel-title"><div><Icon size={22} strokeWidth={2.2}/><h2>{title}</h2></div>{action}</div>;
}
function Kpi({icon:Icon,title,value,note}:{icon:typeof Target,title:string,value:string,note:string}){
 return <article className="va-card va-kpi"><div className="va-kpi-title"><Icon size={20}/><h2>{title}</h2></div><strong>{value}</strong><small>{note}</small></article>;
}
function GoalRow({system,goal,considered,missingQuantities=0,executedTotal,icon:Icon}:{system:'Água'|'Esgoto';goal:number|null;considered:number|null;missingQuantities?:number;executedTotal:number|null;icon:typeof Droplets}){
 const executionKnown=executedTotal===0;
 return <div className="va-goal-row">
  <div className="va-goal-system"><Icon size={30} className={system==='Água'?'va-water':'va-sewer'}/><div><b>{system}</b><small>Meta de execução do ano: {goal===null?absence:count(goal)+' economias'}</small></div></div>
  <div className="va-goal-graphic va-double-progress">
   <div className="va-measure"><div className="va-measure-heading"><b>Execução</b><small>{executionKnown?'0%':'Sem segregação por sistema'}</small></div>{executionKnown?<div className="va-progress" role="progressbar" aria-label={'Execução de '+system} aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}><span style={{width:'0%',background:'#1879C4'}}/></div>:<div className="va-progress va-progress-unclassified" role="status"><span>Execução por sistema em apuração</span></div>}<div className="va-goal-numbers"><span>Executadas: <b>{executionKnown?'0':'—'}</b></span><span>A executar: <b>{executionKnown?count(goal):'—'}</b></span></div></div>
   <div className="va-measure"><div className="va-measure-heading"><b>Projetos / Engenharia</b><small>{goal!==null?'Meta de Engenharia 2026: '+count(goal)+' economias':'Meta por sistema ainda em apuração'}</small></div>{goal!==null&&considered!==null&&goal>0?<><div className="va-progress" role="progressbar" aria-label={"Economias de "+system+" liberadas para obra conforme critério operacional de Engenharia de 2026"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,considered/goal*100)}><span style={{width:Math.min(100,considered/goal*100)+'%',background:'#007977'}}/></div><div className="va-goal-numbers"><span>Liberadas para obra: <b>{count(considered)}</b>{missingQuantities>0?' (parcial)':''}</span><span><b>{percentage(considered/goal*100)}</b> da meta 2026</span></div></>:<><div className="va-progress va-progress-unclassified" role="note" aria-label={"Projetos de "+system+": percentual ainda não classificável"}><span>Percentual em apuração</span></div><div className="va-goal-numbers"><span>Consideradas conhecidas: <b>{count(considered)}</b>{missingQuantities>0?' (parcial)':''}</span><span>Saldo do marco: <b>—</b></span></div></>}</div>
  </div>
 </div>;
}
type StainState={totals:Record<'WATER'|'SEWER',number>;counts:Record<'WATER'|'SEWER',Record<string,number>>};
const categoryColors:Record<string,string>={NO_OBJECTION:'#007977',UNDER_SABESP_REVIEW:'#1369B2',NO_OBJECTION_RESERVATIONS:'#43A68E',IN_PROGRESS:'#FB7707',NOT_STARTED:'#B85A00',OTHER:'#8A9595',UNCLASSIFIED:'#D7E2E1'};
const categoryLabels:Record<string,string>={NO_OBJECTION:'Sem objeção',UNDER_SABESP_REVIEW:'Em análise SABESP',NO_OBJECTION_RESERVATIONS:'S/Obj. com ressalvas',IN_PROGRESS:'Em elaboração / revisão',NOT_STARTED:'Não iniciado',OTHER:'Outros',UNCLASSIFIED:'Não classificadas'};
function StatusSystem({system,total,counts}:{system:'Água'|'Esgoto';total:number;counts:Record<string,number>|null}){
 const Icon=system==='Água'?Droplets:Waves;
 const classified=Object.entries(counts??{}).filter(([key])=>key!=='UNCLASSIFIED').reduce((sum,[,quantity])=>sum+quantity,0);
 const unclassified=Math.max(0,total-classified);
 const steps=Object.keys(categoryColors).map(key=>({key,label:categoryLabels[key],count:key==='UNCLASSIFIED'?unclassified:(counts?.[key]??0),color:categoryColors[key]}));
 let current=0;
 const stops=steps.filter(item=>item.count>0).map(item=>{const from=current;current+=total>0?item.count/total*100:0;return item.color+' '+from+'% '+current+'%';});
 const fill=total>0?'conic-gradient('+stops.join(', ')+')':'#D7E2E1';
 return <div className="va-status-system">
  <div className="va-status-name"><Icon size={22} className={system==='Água'?'va-water':'va-sewer'}/><div><b>{system}</b><small>Manchas com rede identificada: {total}</small></div></div>
  <div className="va-status-detail">
   <div className="va-status-donut" style={{background:fill}} role="img" aria-label={total+' manchas de '+system+'; '+(total-unclassified)+' com status registrado'}><div><small>Total</small><strong>{total}</strong></div></div>
   <div className="va-status-legend">{steps.map(item=><div key={item.key}><span><i className="va-dot" style={{background:item.color}}/>{item.label}</span><b>{item.count} · {total>0?percentage(item.count/total*100):'—'}</b></div>)}</div>
  </div>
 </div>;
}
function Deviation({data}:{data:DashboardData}){
 const rows=[{title:'Cobertura de projetos',value:data.origin?.engineeringPercent??null,color:'orange'},{title:'Execução física',value:data.origin?.executionPercent??null,color:'teal'},{title:'Interferências',value:null,color:'blue'},{title:'Licenças / terceiros',value:null,color:'gold'},{title:'Outros',value:null,color:'gray'}];
 return <article className="va-card va-deviation"><PanelTitle icon={TriangleAlert} title="ORIGEM DO DESVIO"/><div className="va-deviation-rows">{rows.map(item=><div className="va-deviation-row" key={item.title}><span>{item.title}</span><div className="va-deviation-track"><i data-color={item.color} style={{width:item.value===null?'0%':Math.min(100,Math.max(0,item.value))+'%'}}/></div><b>{percentage(item.value)}</b></div>)}</div><p className="va-notice-small">{data.origin?'Percentuais estimados a partir da liberação operacional para obra (Sem objeção + Em análise SABESP) e execução registrada. Não representam aprovação formal integral pela SABESP. Demais causas não possuem rateio cadastrado.':'A atribuição percentual dos desvios aguarda informações compatíveis; não são presumidos percentuais.'}</p></article>;
}
function Mini({label,value,context}:{label:string,value:string,context?:string}){return <div className="va-mini"><span>{label}</span><strong>{value}</strong>{context&&<small>{context}</small>}</div>}
export default function Dashboard(){
 const [data,setData]=useState<DashboardData|null>(null);
 const [sourceTotals,setSourceTotals]=useState<{water:{count:number,economies:number,meters:number,missing:number};sewer:{count:number,economies:number,meters:number,missing:number};matched:number}|null>(null);
 const [structures,setStructures]=useState<Structures|null>(null);
 const [masterStructures,setMasterStructures]=useState<Structures|null>(null);
 const [documentCurves,setDocumentCurves]=useState<Array<{system:string;reference_date:string;planned_accum_fraction:number;realized_accum_fraction:number;realized_current_fraction:number;document_weight:number}>>([]);
 const [stainState,setStainState]=useState<StainState|null>(null);
 const [annualTargets,setAnnualTargets]=useState<{year:number;total:number}[]>([]);
 const [attack2026,setAttack2026]=useState<{economies:number;stains:number}|null>(null);
 const [staticDelivery,setStaticDelivery]=useState<{date:string;count:number}[]|null>(null);
 const [staticMissing,setStaticMissing]=useState<string[]>([]);
 useEffect(()=>{
  let active=true;
  void (async()=>{
   const result=await loadDashboardData();
   if(!active)return;
   setData(result);
   if(!result.contractId||result.source!=='supabase')return;
   const db=createClient();if(!db)return;
   const [works,targets,stains,annual,attack,sources,masterLocal,masterCurve]=await Promise.all([
    db.from('engineering_localized_works').select('kind,quantity').eq('contract_id',result.contractId).eq('active',true),
    db.from('contract_stain_targets').select('segment_type,total_count').eq('contract_id',result.contractId),
    db.from('gis_stain_system_effective').select('segment_type,effective_status').eq('contract_id',result.contractId),
    db.from('annual_targets').select('year,target_economies').eq('contract_id',result.contractId).gte('year',2026).lte('year',2028).order('year'),
    db.from('engineering_attack_plan_2026').select('stain_id,planned_economies'),
    db.from('engineering_source_snapshot').select('segment_type,monday_economies,monday_network_m,fallback_network_m,master_network_m,master_economies,master_front,monday_project_status,network_document_status').eq('contract_id',result.contractId),
    db.from('engineering_master_local_snapshot').select('work_type,quantity').eq('contract_id',result.contractId),
    db.from('engineering_master_curve_snapshot').select('system,reference_date,planned_accum_fraction,realized_accum_fraction,realized_current_fraction,document_weight').eq('contract_id',result.contractId)
   ]);
   if(!active)return;

   const projectResult=await db.from('engineering_projects').select('id,project_name').eq('contract_id',result.contractId).eq('segment_type','SEWER').eq('active',true);
   if(active&&projectResult.data&&!projectResult.error){
     const byCode=new Map<string,{id:string;project_name:string}[]>();
     for(const row of projectResult.data){
       const code=projectCode(String(row.project_name));
       if(code)byCode.set(code,[...(byCode.get(code)??[]),row]);
     }
     const missing=staticSchedule.filter(group=>group.codes.some(code=>(byCode.get(code)?.length??0)!==1)).map(group=>group.name);
     setStaticMissing(missing);
     const ids=Array.from(new Set(staticSchedule.flatMap(group=>group.codes.flatMap(code=>(byCode.get(code)??[]).map(row=>String(row.id))))));
     if(ids.length){
       const [reviewResult,historyResult]=await Promise.all([
         db.from('engineering_project_review_status').select('engineering_project_id,status,updated_at').in('engineering_project_id',ids),
         db.from('engineering_project_review_history').select('engineering_project_id,new_status,changed_at').in('engineering_project_id',ids).order('changed_at',{ascending:true})
       ]);
       if(active&&reviewResult.data&&!reviewResult.error&&!historyResult.error){
         const statuses=new Map(reviewResult.data.map(row=>[String(row.engineering_project_id),row]));
         const dates:string[]=[];
         for(const group of staticSchedule){
           const matches=group.codes.map(code=>byCode.get(code)?.[0]).filter(Boolean);
           if(matches.length!==group.codes.length||group.codes.some(code=>(byCode.get(code)?.length??0)!==1))continue;
           if(matches.some(row=>!releasedStatus(String(statuses.get(String(row!.id))?.status??''))))continue;
           const stamps=matches.map(row=>{
             const events=(historyResult.data??[]).filter(event=>String(event.engineering_project_id)===String(row!.id)&&releasedStatus(String(event.new_status)));
             return String(events[0]?.changed_at??statuses.get(String(row!.id))?.updated_at??'');
           });
           if(stamps.every(Boolean))dates.push(stamps.sort().at(-1)!.slice(0,10));
         }
         setStaticDelivery(dates.sort().map((value,i)=>({date:value,count:i+1})));
       }
     }else setStaticDelivery([]);
   }
   if(!sources.error&&sources.data){
    const next={water:{count:0,economies:0,meters:0,missing:0},sewer:{count:0,economies:0,meters:0,missing:0},matched:0};
    for(const r of sources.data){if(r.master_network_m==null)continue;if(r.master_front)next.matched++;
      if(!isOperationallyReleased(r.network_document_status))continue;
      const group=r.segment_type==='WATER'?next.water:next.sewer;
      group.count++;group.economies+=Number(r.master_economies??0);group.meters+=Number(r.master_network_m??0);
      if(r.master_network_m==null)group.missing++;
    }
    setSourceTotals(next);
   }
   if(!attack.error&&attack.data){const unique=new Set(attack.data.map(row=>String(row.stain_id)).filter(Boolean));setAttack2026({economies:attack.data.reduce((n,row)=>n+(Number.isFinite(Number(row.planned_economies))?Math.max(0,Number(row.planned_economies)):0),0),stains:unique.size});}
   if(!annual.error&&annual.data)setAnnualTargets(annual.data.map(row=>({year:Number(row.year),total:Number(row.target_economies)})));
   if(!masterCurve.error&&masterCurve.data)setDocumentCurves(masterCurve.data.map(r=>({...r,planned_accum_fraction:Number(r.planned_accum_fraction),realized_accum_fraction:Number(r.realized_accum_fraction),realized_current_fraction:Number(r.realized_current_fraction),document_weight:Number(r.document_weight)})));
   if(!masterLocal.error&&masterLocal.data){
    const ms={reservoirs:0,boosters:0,eees:0};
    for(const row of masterLocal.data){const n=Number(row.quantity)||0;
      if(row.work_type==='Reservatório')ms.reservoirs+=n;
      if(row.work_type==='Booster')ms.boosters+=n;
      if(row.work_type==='EEE')ms.eees+=n;
    }
    setMasterStructures(ms);
   }
   if(!works.error&&works.data){
    const next={reservoirs:0,boosters:0,eees:0};
    for(const row of works.data){const q=Number(row.quantity)||0;if(row.kind==='RESERVOIR')next.reservoirs+=q;if(row.kind==='BOOSTER')next.boosters+=q;if(row.kind==='EEE')next.eees+=q;}
    setStructures(next);
   }
   if(!sources.error&&sources.data){
    const totals:StainState['totals']={WATER:0,SEWER:0};
    const counts:StainState['counts']={WATER:{},SEWER:{}};
    for(const row of sources.data){
      if(row.master_network_m==null)continue;
      const seg=row.segment_type as 'WATER'|'SEWER';
      if(seg!=='WATER'&&seg!=='SEWER')continue;
      totals[seg]++;
      const status=String(row.network_document_status??'UNCLASSIFIED');
      counts[seg][status]=(counts[seg][status]??0)+1;
    }
    setStainState({totals,counts});
   }
  })();
  return()=>{active=false};
 },[]);
 if(!data)return <div className="va-loading">Carregando painel gerencial Vitalux…</div>;
 // Desagregação contratual confirmada apenas para 2026; não inferir sistemas de outros anos.
 const targetWater=data.targetBreakdown?.water??(data.targetYear===2026?352:null),targetSewer=data.targetBreakdown?.sewer??(data.targetYear===2026?1357:null);
 const consideredEconomies=sourceTotals?sourceTotals.water.economies+sourceTotals.sewer.economies:null;
 const consideredWater=sourceTotals?.water.economies??null,consideredSewer=sourceTotals?.sewer.economies??null;
 const releasedStains=stainState?(['WATER','SEWER'] as const).reduce((sum,system)=>sum+(stainState.counts[system].NO_OBJECTION??0)+(stainState.counts[system].NO_OBJECTION_RESERVATIONS??0),0):null;
 const totalStains=stainState?stainState.totals.WATER+stainState.totals.SEWER:null;
 const todaySchedule=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date());
 const todayInChart=todaySchedule<scheduleStart?scheduleStart:todaySchedule>scheduleEnd?scheduleEnd:todaySchedule;
 const plannedMilestones=staticSchedule
   .map((group)=>group.due)
   .filter((value,index,all)=>all.indexOf(value)===index)
   .sort()
   .map((value)=>({date:value,count:staticSchedule.filter(group=>group.due<=value).length}));
 const plannedNow=staticSchedule.filter(group=>group.due<=todaySchedule).length;
 const actualNow=staticDelivery===null?null:staticDelivery.filter(item=>item.date<=todaySchedule).length;
 const adherence=plannedNow>0&&actualNow!==null?actualNow/plannedNow*100:null;
 const showDate=(iso:string)=>iso.slice(8,10)+'/'+iso.slice(5,7)+(iso.slice(0,4)==='2027'?'/27':'');
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
     <p className="va-notice-small">Para fins de liberação operacional à obra: <b>Sem objeção</b> e <b>Em análise SABESP</b> são considerados <b>liberados para obra</b>. O status documental de cada frente permanece conforme a Lista Mestra; a classificação interna não altera a aprovação formal da SABESP.</p>
     <div className="va-goal-upper">
      <div className="va-goal-systems"><GoalRow system="Água" goal={targetWater} considered={consideredWater} missingQuantities={0} executedTotal={data.executed} icon={Droplets}/><GoalRow system="Esgoto" goal={targetSewer} considered={consideredSewer} missingQuantities={0} executedTotal={data.executed} icon={Waves}/></div>
      <div className="va-plan-timelines va-timeline-executive">
 <h3>CRONOGRAMA · METAS DISTINTAS</h3><small>Cobertura da Engenharia: inclui documentos em análise SABESP; não representa liberações formais.</small>
 <div className="va-exec-lane">
  <b>Execução física <small>· meta anual de economias</small></b>
  <div className="va-exec-milestones">
  {[2026,2027,2028].map((year)=><div key={year}><strong>{count(annualGoal(year))}</strong><span className="va-lane-point"/><small>{year}</small></div>)}
  </div>
 </div>
 <div className="va-exec-lane">
  <b>Engenharia <small>· liberadas para obra (critério interno)</small></b>
  <div className="va-exec-milestones va-engineering-milestones">
   <div><strong>Início</strong><span className="va-lane-point"/><small>20/07/2026</small></div>
   <div><strong>{count(consideredEconomies)}</strong><span className="va-lane-point va-point-current"/><small>Liberadas para obra · sem objeção + análise SABESP</small></div>
   <div><strong>1.709</strong><span className="va-lane-point"/><small>Dez/2026</small></div>
   <div><strong>14.421</strong><span className="va-lane-point"/><small>Mai/2027</small></div>
  </div>
 </div>
 <div className="va-exec-kpis">
  <div><small>EXECUÇÃO {data.targetYear}</small><b>{count(data.executed)} / {count(currentYearGoal)}</b><span>Avanço físico</span></div>
  <div><small>COBERTURA PROJETOS DEZ/2026</small><b>{count(consideredEconomies)} / 1.709</b><span>Cobertura da Engenharia</span></div>
  <div><small>COBERTURA PROJETOS MAI/2027</small><b>{count(consideredEconomies)} / 14.421</b><span>Prazo final</span></div>
 </div>
</div>
</div>
<div className="va-plan-lower va-plan-lower-executive">
 <div className="va-plan-assessment"><h3>COBERTURA DOS PROJETOS POR ANO</h3><small>Escopo da Lista Mestra · liberação operacional para obra</small><div className="va-plan-years">{[2026,2027,2028].map(year=>{const base=annualGoal(year);const known=year===2026?consideredEconomies:null;const pct=base!==null&&base>0&&known!==null?Math.min(100,known/base*100):null;return <div key={year}><b>{year}</b><strong>{count(base)} <small>economias</small></strong><div className="va-mini-track" role={pct===null?'status':'progressbar'} aria-label={'Cobertura de projetos liberados para obra para '+year} aria-valuemin={pct===null?undefined:0} aria-valuemax={pct===null?undefined:100} aria-valuenow={pct===null?undefined:pct}><i style={{width:pct===null?'0%':pct+'%',background:'#007977'}}/></div>{year===2026&&<small>{count(known)} liberadas para obra · {pct===null?'em apuração':percentage(pct)+' da meta'}</small>}{year===2026?<><em className="va-traffic va-traffic-warning"><i/>Engenharia: Atenção</em><em className="va-traffic va-traffic-critical"><i/>Execução: Risco crítico</em></>:<em className="va-traffic va-traffic-unknown"><i/>Em acompanhamento</em>}</div>})}</div></div>
 <div className="va-plan-targets"><h3>METAS POR ANO</h3>{[2026,2027,2028].map(year=><div key={year}><span>{year}</span><b>{count(annualGoal(year))}</b></div>)}<div className="va-plan-total"><span>Total</span><b>{count(officialContractTotal)}</b></div>{annualTargetsMismatch&&<small>Revisar metas anuais cadastradas.</small>}</div>
</div>
    </article>
    <article className="va-card va-status"><PanelTitle icon={CheckCircle2} title="STATUS DAS REDES · LISTA MESTRA" action={<Link className="va-inline-link" href="/engenharia#engenharia-projetos">Consultar projetos ↗</Link>}/><div className="va-status-grid"><StatusSystem system="Água" total={stainState?.totals.WATER??38} counts={stainState?.counts.WATER??null}/><StatusSystem system="Esgoto" total={stainState?.totals.SEWER??84} counts={stainState?.counts.SEWER??null}/></div><p className="va-notice-small">Situação vigente das frentes de rede conforme ESCOPO_LINEARES da Lista Mestra de 27/11/2026. Uma mancha com vários trechos é contabilizada apenas uma vez por sistema; status dos documentos disponível no cadastro da Engenharia.</p><div className="va-static-chart">
 <h3>CURVA S · AVANÇO DOCUMENTAL · LISTA MESTRA</h3>
 <p className="va-notice-small">Progresso ponderado dos documentos do escopo. É distinto de economias de projeto, extensão de rede e execução física.</p>
 {documentCurves.length?['PROGRAM','WATER','SEWER'].map(key=>{
   const r=documentCurves.find(v=>v.system===key);
   if(!r)return null;
   const label=key==='PROGRAM'?'Programa geral':key==='WATER'?'Água':'Esgoto';
   const planned=r.planned_accum_fraction*100,actual=r.realized_accum_fraction*100;
   return <div key={key} style={{marginBottom:14}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><b>{label}</b><small>Previsto: {percentage(planned)} · Realizado consolidado: {percentage(actual)}</small></div>
    <div className="va-mini-track" style={{margin:'7px 0',position:'relative'}} aria-label={label+': previsto '+percentage(planned)+'; realizado '+percentage(actual)}>
      <i style={{width:Math.min(100,actual)+'%',background:'#007977'}}/>
    </div>
    <small>Última semana da planilha: 25/11/2026 · {count(r.document_weight)} documentos ponderados · avanço calculado atual: {percentage(r.realized_current_fraction*100)}</small>
   </div>;
 }):<p>Curva S documental aguardando consulta à Lista Mestra.</p>}
 <small>Fonte: CR_CURVA_S, CR_CURVA_S_AGUA e CR_CURVA_S_ESGOTO do arquivo final recebido em 27/11/2026. Não é a Curva S de economias executadas.</small>
 </div></article>
   </section>
   <section className="va-bottom-grid">
    <article className="va-card"><PanelTitle icon={FileCheck2} title="ENTREGA DA ENGENHARIA"/><p className="va-notice-small"><b>{sourceTotals?sourceTotals.water.count+sourceTotals.sewer.count:"—"} projetos liberados para obra</b> · Critério interno: Sem objeção ou Em análise SABESP</p><div className="va-two-metrics"><Mini label="Economias liberadas para obra" value={sourceTotals?count(sourceTotals.water.economies+sourceTotals.sewer.economies):"—"} context={"Água "+count(sourceTotals?.water.economies??null)+" · Esgoto "+count(sourceTotals?.sewer.economies??null)}/><Mini label="Rede liberada para obra" value={sourceTotals?km(sourceTotals.water.meters+sourceTotals.sewer.meters):"—"} context={"Água "+km(sourceTotals?.water.meters??null)+" · Esgoto "+km(sourceTotals?.sewer.meters??null)}/></div><p className="va-notice-small">Escopo vigente conforme Lista Mestra (3), 27/11/2026; registros Monday anteriores preservados para auditoria. Inclui redes em análise: não equivale a aprovação final nem execução.</p><Link className="va-card-action" href="/engenharia">Detalhar Engenharia ↗</Link></article>
    <article className="va-card"><PanelTitle icon={Network} title="EXECUÇÃO REAL"/><div className="va-two-metrics"><Mini label="Economias executadas" value={count(data.executed)} context="Acumulado informado"/><Mini label="Rede executada" value={km(data.networkExecuted)} context="Acumulado informado"/></div><Link className="va-card-action" href="/atualizar">Atualizar execução ↗</Link></article>
    <article className="va-card va-structures"><PanelTitle icon={Building2} title="ESTRUTURAS CADASTRADAS"/><div className="va-structure-rows"><div><Landmark size={17}/><span>Reservatórios</span><b>{masterStructures?count(masterStructures.reservoirs)+' previstos · ':''}{structures?count(structures.reservoirs)+' cadastrados':'—'}</b></div><div><Target size={17}/><span>Boosters</span><b>{masterStructures?count(masterStructures.boosters)+' previstos · ':''}{structures?count(structures.boosters):'—'} cadastrados</b></div><div><Network size={17}/><span>EEEs</span><b>{masterStructures?count(masterStructures.eees)+' previstas · ':''}{structures?count(structures.eees)+' cadastradas':'—'}</b></div></div><details className="va-structure-specs"><summary>Detalhes técnicos dos equipamentos</summary><div className="va-spec-section"><strong>Boosters — dados de projeto</strong><table><thead><tr><th>Unidade</th><th>Vazão</th><th>HMT</th><th>CV</th></tr></thead><tbody><tr><td>São João</td><td>1,210 L/s</td><td>31</td><td>2</td></tr><tr><td>Vidas Novas / Núcleo Santino</td><td>1,701 L/s</td><td>34</td><td>2</td></tr><tr><td>Alto da Serra</td><td>0,400 L/s</td><td>28</td><td>1,5</td></tr></tbody></table><strong>EEE — Kronox In-Line, 1+1R</strong><table><thead><tr><th>Unidade</th><th>Vazão</th><th>HMT</th><th>CV</th></tr></thead><tbody><tr><td>01 · BE06R 18,5 kW · Ypê I</td><td>3,33</td><td>50,07</td><td>25,15</td></tr><tr><td>02 · BE06H 22 kW · Ypê I</td><td>3,89</td><td>51,61</td><td>29,91</td></tr><tr><td>03 · BE01 1,5 kW · Ypê II</td><td>1,39</td><td>13,98</td><td>2,04</td></tr><tr><td>04 · BE06H 30 kW · Ypê II</td><td>10,56</td><td>54,29</td><td>40,79</td></tr></tbody></table><small>EEE: vazão em L/s; HMT em mca. Conjuntos em linha com rotor vortex cônico. Dados fornecidos para conferência técnica; não substituem os lançamentos formais.</small></div></details><Link className="va-card-action" href="/engenharia">Abrir obras localizadas ↗</Link></article>
    <article className="va-card va-distribution"><PanelTitle icon={MapPin} title="DISTRIBUIÇÃO DAS MANCHAS"/><div className="va-distribution-inner"><div><Droplets size={24} className="va-water"/><span>Água</span><strong>{stainState?.totals.WATER??38}</strong><small>manchas</small></div><div><Waves size={24} className="va-sewer"/><span>Esgoto</span><strong>{stainState?.totals.SEWER??84}</strong><small>manchas</small></div></div><Link className="va-card-action" href="/engenharia">Visualizar por município ↗</Link></article>
   </section>
   <div className="va-bottom-note"><span>SBON 17B · Informações provenientes dos cadastros e atualizações registrados no sistema</span><Link href="/engenharia">Vitalux Ecoativa · Engenharia</Link></div>
  </main>
 </VitaluxChrome>;
}
