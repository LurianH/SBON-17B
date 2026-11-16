'use client';
import {useMemo,useState} from 'react';

export type EngineeringSourceRow={
 id:number;segment_type:'WATER'|'SEWER';municipality:string;gis_code:string;neighborhood:string;
 monday_economies:number|null;monday_network_m:number|string|null;master_front:string|null;
 master_document_status:string|null;master_reference_code:string|null;source_version:string;
};
const num=(x:number|null|undefined,unit='')=>x==null?'Não informado':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(x)+unit;
export function EngineeringSourceReconciliation({rows}:{rows:EngineeringSourceRow[]}){
 const [term,setTerm]=useState(''),[city,setCity]=useState(''),[segment,setSegment]=useState('ALL');
 const cityOptions=useMemo(()=>[...new Set(rows.map(r=>r.municipality))].sort(),[rows]);
 const matched=useMemo(()=>rows.filter(r=>(!city||r.municipality===city)&&(segment==='ALL'||r.segment_type===segment)&&
 [r.gis_code,r.neighborhood,r.municipality,r.master_front??''].join(' ').toLocaleLowerCase('pt-BR').includes(term.toLocaleLowerCase('pt-BR'))),[rows,city,segment,term]);
 const totals=(segmentType:'WATER'|'SEWER')=>matched.filter(r=>r.segment_type===segmentType).reduce((a,r)=>({economies:a.economies+(r.monday_economies??0),meters:a.meters+(r.monday_network_m==null?0:Number(r.monday_network_m)),withNetwork:a.withNetwork+(r.monday_network_m!=null?1:0)}),{economies:0,meters:0,withNetwork:0});
 const water=totals('WATER'),sewer=totals('SEWER');
 return <section className="panel" aria-label="Conciliação Lista Mestra e Monday" style={{padding:20,marginBottom:18}}>
  <div style={{display:'flex',gap:12,justifyContent:'space-between',alignItems:'start',flexWrap:'wrap'}}>
   <div><h2 style={{margin:'0 0 6px',fontSize:20}}>Base de projetos · Lista Mestra + Monday</h2><p style={{margin:'0 0 8px'}}>Economias e rede: <b>Monday de 16/11/2026</b>. Situação documental: <b>Lista Mestra SABESP</b>. Uma peça com “Sem objeção” não significa projeto integralmente aprovado.</p></div>
   <small>Fonte conciliada · 16/11/2026</small>
  </div>
  <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'12px 0 16px'}}>
   <div style={{flex:'1 1 180px',border:'1px solid var(--border, #cbd5e1)',borderRadius:8,padding:12}}><strong>Água</strong><p style={{margin:'8px 0 2px',fontSize:24,fontWeight:700}}>{num(water.economies)} economias</p><small>{num(water.meters,' m')} informados · {water.withNetwork} frentes com metragem</small></div>
   <div style={{flex:'1 1 180px',border:'1px solid var(--border, #cbd5e1)',borderRadius:8,padding:12}}><strong>Esgoto</strong><p style={{margin:'8px 0 2px',fontSize:24,fontWeight:700}}>{num(sewer.economies)} economias</p><small>{num(sewer.meters,' m')} informados · {sewer.withNetwork} frentes com metragem</small></div>
  </div>
  <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>
   <label style={{flex:'2 1 180px'}}>Buscar mancha ou bairro<input aria-label="Buscar projeto" value={term} onChange={e=>setTerm(e.target.value)} placeholder="Ex.: Cletos, 553_AF_164" style={{width:'100%',boxSizing:'border-box'}}/></label>
   <label style={{flex:'1 1 120px'}}>Município<select value={city} onChange={e=>setCity(e.target.value)} style={{width:'100%'}}><option value="">Todos</option>{cityOptions.map(v=><option value={v} key={v}>{v}</option>)}</select></label>
   <label style={{flex:'1 1 120px'}}>Sistema<select value={segment} onChange={e=>setSegment(e.target.value)} style={{width:'100%'}}><option value="ALL">Água e esgoto</option><option value="WATER">Água</option><option value="SEWER">Esgoto</option></select></label>
  </div>
  <div style={{overflowX:'auto'}}>
  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
   <thead><tr style={{borderBottom:'2px solid currentColor',textAlign:'left'}}><th style={{padding:8}}>Mancha / frente</th><th style={{padding:8}}>Bairro</th><th style={{padding:8}}>Sistema</th><th style={{padding:8,textAlign:'right'}}>Economias Monday</th><th style={{padding:8,textAlign:'right'}}>Rede Monday (m)</th><th style={{padding:8}}>Status documental · Lista Mestra</th></tr></thead>
   <tbody>{matched.map(r=><tr key={r.id} style={{borderBottom:'1px solid #cbd5e1'}}><td style={{padding:8,whiteSpace:'nowrap'}}><b>{r.gis_code}</b><div style={{fontSize:11,opacity:.8}}>{r.municipality} · {r.master_front??'Frente não conciliada'}</div></td><td style={{padding:8}}>{r.neighborhood}</td><td style={{padding:8}}>{r.segment_type==='WATER'?'Água':'Esgoto'}</td><td style={{padding:8,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{num(r.monday_economies)}</td><td style={{padding:8,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{num(r.monday_network_m==null?null:Number(r.monday_network_m))}</td><td style={{padding:8,maxWidth:300}}>{r.master_document_status?<span>{r.master_document_status}</span>:<span style={{opacity:.7}}>Correspondência documental não confirmada</span>}</td></tr>)}</tbody>
  </table>
  </div>
  <p style={{fontSize:12,margin:'12px 0 0'}}>Os totais acima são <b>quantitativos cadastrados no Monday</b>, não economias formalmente liberadas, aprovadas ou executadas. Metragem ausente permanece “Não informado”. Abaixo, os quadros históricos de aprovação e execução seguem separados para não alterar medições já registradas.</p>
 </section>;
}
