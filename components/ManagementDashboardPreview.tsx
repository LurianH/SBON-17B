'use client';

import {useMemo, useState} from 'react';
import {summarizeMunicipalities, summarizeSystem, type ContractorMeasurement, type LocalizedWork, type NetworkSection, type Segment} from '@/lib/management-metrics';

const cities = ['Porangaba','Quadra','Tatuí','Conchas','Pereiras'];
type Tab = 'ALL' | Segment;
type Panel = 'overview' | 'municipalities' | 'statica' | 'structures';
const nf = new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
const money = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const show = (value:number|null, suffix='',partial=false) => value === null ? 'Aguardando dados' : `${nf.format(value)}${suffix}${partial?' · parcial':''}`;
const metrics = (n:number|null,p:boolean,unit='') => show(n,unit,p);

export function ManagementDashboardPreview({networks=[],works=[],measurements=[]}:{networks?:NetworkSection[];works?:LocalizedWork[];measurements?:ContractorMeasurement[]}) {
  const [tab,setTab]=useState<Tab>('ALL');
  const [panel,setPanel]=useState<Panel>('overview');
  const [city,setCity]=useState('');
  const filtered = useMemo(()=>({
    networks:networks.filter(x=>(!city||x.municipality===city)&&(tab==='ALL'||x.segment===tab)),
    works:works.filter(x=>(!city||x.municipality===city)&&(tab==='ALL'||x.segment===tab)),
    measurements:measurements.filter(x=>(!city||x.municipality===city)&&(tab==='ALL'||x.segment===tab)),
  }),[networks,works,measurements,city,tab]);
  const water=summarizeSystem('WATER',filtered.networks,filtered.works,filtered.measurements);
  const sewer=summarizeSystem('SEWER',filtered.networks,filtered.works,filtered.measurements);
  const allCities=summarizeMunicipalities(filtered.networks,filtered.works,filtered.measurements);
  const anyData=filtered.networks.length+filtered.works.length+filtered.measurements.length>0;
  const selected=tab==='WATER'?[water]:tab==='SEWER'?[sewer]:[water,sewer];
  const total=(selector:(x:typeof water)=>number|null)=>{const values=selected.map(selector);return values.every(x=>x===null)?null:values.reduce<number>((a,b)=>a+(b??0),0);};
  const incomplete=(selector:(x:typeof water)=>{partial:boolean})=>selected.some(x=>selector(x).partial);
  return <main className="mgmt">
    <header className="mgmt-header"><div><p className="mgmt-eyebrow">VITALUX · SBON 17B</p><h1>Painel Gerencial de Engenharia</h1><p>Consolidado, Água, Esgoto, Estática e medições — visualização preliminar</p></div><span className="mgmt-tag">Prévia · leitura</span></header>
    <section className="mgmt-tabs" aria-label="Segmento"><button aria-pressed={tab==='ALL'} onClick={()=>setTab('ALL')}>Consolidado</button><button aria-pressed={tab==='WATER'} onClick={()=>setTab('WATER')}>Água</button><button aria-pressed={tab==='SEWER'} onClick={()=>setTab('SEWER')}>Esgoto</button></section>
    <section className="mgmt-filters"><label>Município <select value={city} onChange={e=>setCity(e.target.value)}><option value="">Todos os municípios</option>{cities.map(c=><option key={c}>{c}</option>)}</select></label><p>As quantidades sem cadastro permanecem vazias. Nenhum valor foi estimado.</p></section>
    <nav className="mgmt-nav" aria-label="Seções do painel">{([{key:'overview',label:'Visão executiva'},{key:'municipalities',label:'Municípios e manchas'},{key:'statica',label:'Estática'},{key:'structures',label:'Obras localizadas'}] as const).map(x=><button key={x.key} aria-current={panel===x.key?'page':undefined} onClick={()=>setPanel(x.key)}>{x.label}</button>)}</nav>
    {!anyData&&<p role="status" className="mgmt-info">Nenhum registro vinculado a esta prévia. Os cartões abaixo mostram os campos que serão alimentados após a implantação dos cadastros.</p>}
    {panel==='overview'&&<><div className="mgmt-grid">{[
      ['Extensão original',total(x=>x.networkByStage.ORIGINAL.value), ' m',incomplete(x=>x.networkByStage.ORIGINAL)],
      ['Extensão aprovada',total(x=>x.networkByStage.APPROVED.value),' m',incomplete(x=>x.networkByStage.APPROVED)],
      ['Extensão executada',total(x=>x.networkByStage.EXECUTED.value),' m',incomplete(x=>x.networkByStage.EXECUTED)],
      ['Estática validada',total(x=>x.contractorValidatedKm.value),' km',incomplete(x=>x.contractorValidatedKm)],
      ['Estática medida',total(x=>x.contractorMeasuredKm.value),' km',incomplete(x=>x.contractorMeasuredKm)],
      ['Obras localizadas sem orçamento',anyData?selected.reduce((a,x)=>a+x.localizedWithoutBudget,0):null,' un.',false],
    ].map(([label,value,unit,partial])=><article className="mgmt-card" key={String(label)}><span>{label}</span><strong>{metrics(value as number|null,Boolean(partial),String(unit))}</strong></article>)}</div>
    <h2>Entregas por sistema</h2><div className="mgmt-systems">{[{label:'Água',data:water},{label:'Esgoto',data:sewer}].filter(x=>tab==='ALL'||(tab==='WATER'?x.label==='Água':x.label==='Esgoto')).map(({label,data})=><article className="mgmt-card" key={label}><h3>{label}</h3><dl><div><dt>Rede aprovada</dt><dd>{show(data.networkByStage.APPROVED.value,' m',data.networkByStage.APPROVED.partial)}</dd></div><div><dt>Obras localizadas</dt><dd>{filtered.works.some(w=>w.segment===data.system)?data.localizedUnits:'Aguardando dados'}</dd></div><div><dt>Sem orçamento</dt><dd>{filtered.works.some(w=>w.segment===data.system)?data.localizedWithoutBudget:'Aguardando dados'}</dd></div></dl></article>)}</div></>}
    {panel==='municipalities'&&<><h2>Engenharia por município e sistema</h2><div className="mgmt-scroll"><table><thead><tr><th>Município</th><th>Água aprovada</th><th>Esgoto aprovado</th><th>Obras localizadas</th></tr></thead><tbody>{cities.filter(c=>!city||c===city).map(c=>{const r=allCities.find(x=>x.municipality===c);return <tr key={c}><th>{c}</th><td>{r?show(r.water.networkByStage.APPROVED.value,' m',r.water.networkByStage.APPROVED.partial):'—'}</td><td>{r?show(r.sewer.networkByStage.APPROVED.value,' m',r.sewer.networkByStage.APPROVED.partial):'—'}</td><td>{r?(r.water.localizedUnits+r.sewer.localizedUnits):'—'}</td></tr>})}</tbody></table></div><p className="mgmt-muted">O detalhamento de cada mancha será vinculado ao ID e aos projetos existentes na Fase 4.</p></>}
    {panel==='statica'&&<><h2>Controle da Estática</h2><div className="mgmt-grid">{[['Km validados',total(x=>x.contractorValidatedKm.value),' km'],['Km medidos',total(x=>x.contractorMeasuredKm.value),' km'],['Valor medido',total(x=>x.contractorMeasuredBrl.value),''],['Valor pago',total(x=>x.contractorPaidBrl.value),'']].map(([label,value,unit])=><article className="mgmt-card" key={String(label)}><span>{label}</span><strong>{value===null?'Aguardando dados':String(label).startsWith('Valor')?money.format(Number(value)):show(Number(value),String(unit))}</strong></article>)}</div><p className="mgmt-muted">Controle físico e financeiro por sistema, município e, após integração, por mancha e competência.</p></>}
    {panel==='structures'&&<><h2>EEE, boosters, reservatórios e demais estruturas</h2><div className="mgmt-scroll"><table><thead><tr><th>Município</th><th>ID da mancha</th><th>Sistema</th><th>Obra localizada</th><th>Unidades</th><th>Potência (CV)</th><th>Capacidade (m³)</th><th>Orçamento</th></tr></thead><tbody>{filtered.works.length?filtered.works.map(w=><tr key={w.workId}><td>{w.municipality}</td><td>{w.stainId||'Não informado'}</td><td>{w.segment==='WATER'?'Água':'Esgoto'}</td><td>{w.kind}</td><td>{w.units}</td><td>{w.cv===null?'—':nf.format(w.cv)}</td><td>{w.capacityM3===null?'—':nf.format(w.capacityM3)}</td><td>{w.budgetStatus==='NOT_BUDGETED'?'Sem orçamento':w.budgetStatus}</td></tr>):<tr><td colSpan={8}>Nenhuma obra localizada vinculada.</td></tr>}</tbody></table></div></>}
    <p className="mgmt-footer">Prévia sem escrita em banco. Medição contratual, importação da SPO e formulários de edição serão implementados em etapas posteriores.</p>
  </main>;
}
