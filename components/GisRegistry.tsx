'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
import './gis-registry.css';

type Segment='WATER'|'SEWER';
export type GisMasterFront={front_name:string;municipality:string;gis_code:string|null;segment_type:Segment;network_type:string|null;scope_length_m:number|string|null;scope_economies:number|null;front_status:string|null;document_status_rollup:string|null};
type Status='UNCLASSIFIED'|'NO_OBJECTION'|'NO_OBJECTION_RESERVATIONS'|'IN_PREPARATION'|'IN_REVIEW'|'NOT_STARTED'|'CANCELLED';
export type GisSystemRow={
 id:string;gis_code:string;municipality:string;classification:'BOTH'|'SEWER';
 settlement_type:string|null;neighborhood:string|null;source_sheet:string;
 economies_ica:number|null;economies_ice:number|null;economies_iec:number|null;
 cancelled:boolean;estimated_households:number|null;engineering_project_id:string|null;linked_project_name:string|null;
 segment_type:Segment;effective_status:Status;
};
type Log={id:string;old_status:Status|null;new_status:Status;changed_at:string};
const labels:Record<Status,string>={
 UNCLASSIFIED:'Não classificada',NO_OBJECTION:'Sem objeção',
 NO_OBJECTION_RESERVATIONS:'S/Obj. com ressalvas',IN_PREPARATION:'Em elaboração',
 IN_REVIEW:'Em revisão',NOT_STARTED:'A iniciar',CANCELLED:'Cancelado'
};
const number=(n:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(n);
const amount=(n:number|null)=>n===null?'—':number(n);
const cities=['Porangaba','Quadra','Tatuí','Conchas','Pereiras'];
function History({row}:{row:GisSystemRow}) {
 const [items,setItems]=useState<Log[]|null>(null),[error,setError]=useState('');
 async function load(){
  if(items!==null)return;
  const db=createClient();if(!db){setError('Conexão indisponível.');return;}
  const response=await db.from('gis_stain_system_history').select('id,old_status,new_status,changed_at')
   .eq('gis_stain_id',row.id).eq('segment_type',row.segment_type)
   .order('changed_at',{ascending:false}).limit(20);
  if(response.error)setError('Não foi possível consultar o histórico.');
  else setItems(response.data as Log[]);
 }
 return <details onToggle={e=>{if(e.currentTarget.open)void load()}}>
  <summary>Histórico</summary>
  {row.cancelled&&<p>Cancelada conforme definição contratual registrada.</p>}
  {row.engineering_project_id&&<p>O histórico atualizado da classificação deste sistema está disponível na Engenharia.</p>}
  {error&&<p role="alert">{error}</p>}
  {items?.length===0&&<p>Sem alterações nesta classificação.</p>}
  {items?.map(x=><p key={x.id}>{x.old_status?labels[x.old_status]+' → ':''}{labels[x.new_status]} · {new Date(x.changed_at).toLocaleString('pt-BR')}</p>)}
 </details>;
}
export function GisRegistry({rows,role,masterFronts=[]}:{rows:GisSystemRow[];role:string;masterFronts?:GisMasterFront[]}) {
 const router=useRouter(),editable=role==='ADMIN'||role==='EDITOR';
 const norm=(s:string)=>s.replaceAll('-','_').toUpperCase();
 const frontRank=(f:GisMasterFront)=>f.network_type==='Rede de Distribuição'||f.network_type==='Rede Coletora'?5:f.network_type==='Rede Primária'?4:f.network_type==='Coletor Tronco'?3:f.network_type==='Linha de Recalque'?2:0;
 const frontFor=(row:GisSystemRow)=>masterFronts.filter(f=>f.gis_code&&norm(f.gis_code)===norm(row.gis_code)&&f.segment_type===row.segment_type&&f.municipality===row.municipality&&frontRank(f)>0).sort((a,b)=>frontRank(b)-frontRank(a)||Number(b.scope_length_m??0)-Number(a.scope_length_m??0))[0];
 const [segment,setSegment]=useState<Segment>('WATER');
 const [city,setCity]=useState(''),[keyword,setKeyword]=useState('');
 const [filterStatus,setFilterStatus]=useState<string>('ALL');
 const [busy,setBusy]=useState<string|null>(null),[message,setMessage]=useState('');
 const byId=[...new Map(rows.map(x=>[x.id,x])).values()];
 const water=rows.filter(x=>x.segment_type==='WATER'),sewer=rows.filter(x=>x.segment_type==='SEWER');
 const current=segment==='WATER'?water:sewer;
 const filtered=current.filter(r=>(!city||r.municipality===city)
   &&(!keyword||[r.gis_code,r.neighborhood,r.linked_project_name].some(s=>s?.toLocaleLowerCase('pt-BR').includes(keyword.toLocaleLowerCase('pt-BR'))))
   &&(filterStatus==='ALL'||frontFor(r)?.front_status===filterStatus));
 const economySum=(key:'economies_ica'|'economies_ice'|'economies_iec',includeCancelled:boolean)=>{
  const found=byId.filter(r=>includeCancelled||!r.cancelled).map(r=>r[key]).filter((value):value is number=>value!==null&&value!==undefined);
  return found.reduce((sum,v)=>sum+Number(v),0);
 };
 const missing=(key:'economies_ica'|'economies_ice')=>byId.filter(r=>!r.cancelled&&(key==='economies_ice'||r.classification==='BOTH')&&r[key]===null).length;
 const byCity=cities.map(municipality=>{
   const cityWater=water.filter(r=>r.municipality===municipality);
   const citySewer=sewer.filter(r=>r.municipality===municipality);
   const cityUnique=byId.filter(r=>r.municipality===municipality&&!r.cancelled);
   const waterKnown=cityUnique.filter(r=>r.classification==='BOTH'&&r.economies_ica!==null);
   const sewerKnown=cityUnique.filter(r=>r.economies_ice!==null);
   return {municipality,water:cityWater.length,sewer:citySewer.length,
      ica:waterKnown.reduce((sum,r)=>sum+Number(r.economies_ica),0),
      ice:sewerKnown.reduce((sum,r)=>sum+Number(r.economies_ice),0),
      waterMissing:cityUnique.filter(r=>r.classification==='BOTH'&&r.economies_ica===null).length,
      sewerMissing:cityUnique.filter(r=>r.economies_ice===null).length};
 });
 async function save(row:GisSystemRow,status:Status){
  if(!editable||busy||row.cancelled||row.engineering_project_id)return;
  const db=createClient();if(!db){setMessage('Conexão indisponível.');return;}
  setBusy(row.id+row.segment_type);setMessage('');
  const {data:{user}}=await db.auth.getUser();
  if(!user){setBusy(null);setMessage('Sessão expirada. Entre novamente.');return;}
  const response=await db.from('gis_stain_system_status').upsert({
     gis_stain_id:row.id,segment_type:row.segment_type,status,updated_by:user.id
  },{onConflict:'gis_stain_id,segment_type'});
  setBusy(null);
  if(response.error)setMessage('Não foi possível salvar: '+response.error.message);
  else {setMessage('Classificação salva, com histórico permanente.');router.refresh();}
 }
 return <div className="gis-registry">
  <p className="gis-intro">Cadastro oficial baseado em <strong>Base Ondas PPM – ERN 15/10/2026</strong>, Lote 17b. As 10 novas manchas integram os dois sistemas, conforme definição do contrato. Uma mesma mancha pode aparecer em Água e Esgoto, mas o código GIS e as economias não são duplicados.</p>
  <section className="gis-kpis" aria-label="Resumo das manchas GIS">
   <article><span>Códigos GIS distintos</span><strong>{number(byId.length)}</strong><small>74 da aba principal + 10 novos</small></article>
   <article><span>Manchas de Água</span><strong>{number(water.length)}</strong><small>{water.filter(r=>r.cancelled).length} canceladas</small></article>
   <article><span>Manchas de Esgoto</span><strong>{number(sewer.length)}</strong><small>{sewer.filter(r=>r.cancelled).length} canceladas</small></article>
   <article><span>Manchas novas</span><strong>{number(byId.filter(r=>r.source_sheet==='Planilha2').length)}</strong><small>466 domicílios convertidos em estimativas</small></article>
  </section>
  <section className="panel gis-economies">
   <h2>Economias estimadas da base GIS</h2><p className="gis-context">As 10 novas manchas têm estimativas de 1 economia de Água e 1 de Esgoto por domicílio informado. Esses valores não representam aprovação técnica nem alteram metas anuais.</p>
   <div className="gis-economy-grid">
    <div><span>Economias de Água · estimativa cadastral GIS</span><strong>{number(economySum('economies_ica',false))}</strong><small>{missing('economies_ica')} manchas de Água sem quantidade informada · total parcial</small></div>
    <div><span>Economias de Esgoto · estimativa cadastral GIS</span><strong>{number(economySum('economies_ice',false))}</strong><small>{missing('economies_ice')} manchas de Esgoto sem quantidade informada · total parcial</small></div>
   </div>
   <p className="gis-context">As duas manchas canceladas permanecem no catálogo e representam {number(economySum('economies_ica',true)-economySum('economies_ica',false))} economias de Água e {number(economySum('economies_ice',true)-economySum('economies_ice',false))} economias de Esgoto, fora dos totais de escopo vigente acima. Os valores anuais de meta permanecem independentes desta base GIS e não foram substituídos.</p>
  </section>
  <section className="panel gis-cities">
   <h2>Distribuição por município</h2>
   <div className="gis-scroll"><table><thead><tr><th>Município</th><th>Água</th><th>Esgoto</th><th>Economias de Água</th><th>Economias de Esgoto</th></tr></thead><tbody>
    {byCity.map(x=><tr key={x.municipality}><th>{x.municipality}</th><td>{x.water}</td><td>{x.sewer}</td><td>{number(x.ica)}{x.waterMissing?' · parcial':''}</td><td>{number(x.ice)}{x.sewerMissing?' · parcial':''}</td></tr>)}
   </tbody></table></div>
  </section>
  <section className="panel gis-records" aria-label="Relação das manchas por sistema">
   <div className="gis-section-head"><div><h2>Manchas e situação documental por sistema</h2><p>A situação atual das redes segue a Lista Mestra de 27/11/2026, independente da classificação histórica do cadastro GIS. Cada frente mantém seu município e sistema.</p></div><Link href="/engenharia#engenharia-projetos">Abrir Engenharia →</Link></div>
   <div className="gis-filters">
    <label>Sistema<select value={segment} onChange={e=>setSegment(e.target.value as Segment)}><option value="WATER">Água</option><option value="SEWER">Esgoto</option></select></label>
    <label>Município<select value={city} onChange={e=>setCity(e.target.value)}><option value="">Todos</option>{cities.map(v=><option key={v}>{v}</option>)}</select></label>
    <label>Situação documental<select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="ALL">Todas</option>{[...new Set(masterFronts.filter(f=>frontRank(f)>0).map(f=>f.front_status).filter((v):v is string=>Boolean(v)))].sort().map(value=><option key={value} value={value}>{value}</option>)}</select></label>
    <label>Buscar código ou bairro<input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="Código GIS, bairro ou projeto"/></label>
   </div>
   <p className="gis-count">{filtered.length} manchas exibidas de {current.length} do sistema selecionado</p>
   <div className="gis-scroll"><table><thead><tr><th>GIS / Bairro</th><th>Município</th><th>Recorte</th><th>Economias de Água</th><th>Economias de Esgoto</th><th>Status da rede · Lista Mestra</th></tr></thead><tbody>
    {filtered.map(row=><tr key={row.id+row.segment_type}>
     <td><strong>{row.gis_code}</strong><small>{row.neighborhood||'Bairro não informado'}</small>{row.linked_project_name&&<small>Projeto vinculado: {row.linked_project_name}</small>}{row.source_sheet==='Planilha2'&&<small className="gis-tag">Nova · {row.estimated_households??'—'} domicílios estimados</small>}</td>
     <td>{row.municipality}</td><td>{row.settlement_type??'—'}</td><td>{amount(row.economies_ica)}</td><td>{amount(row.economies_ice)}</td>
     <td className="gis-status-cell">{frontFor(row)?<div>
      <strong>{frontFor(row)?.front_status??'Não informado'}</strong>
      <small>{frontFor(row)?.front_name} · {frontFor(row)?.scope_length_m==null?'Metragem não informada':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(Number(frontFor(row)?.scope_length_m))+' m'}</small>
      <small>{frontFor(row)?.scope_economies==null?'Economias de projeto não informadas':frontFor(row)?.scope_economies+' economias de projeto'}</small>
      <small>{frontFor(row)?.document_status_rollup??'Documentos sem status'}</small>
     </div>:<strong>Sem frente de rede correspondente na Lista Mestra</strong>}
      <History row={row}/>
     </td>
    </tr>)}
   </tbody></table></div>
   {!filtered.length&&<p>Não há manchas para os filtros selecionados.</p>}
   {message&&<p className="gis-message" role="status">{message}</p>}
  </section>
 </div>;
}
