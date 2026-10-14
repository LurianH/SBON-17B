import {attackPlan2026,attackPlanSummary,attackPlanDuplicateIds} from '@/lib/attack-plan-2026';
import './attack-plan-2026.css';
export function AttackPlan2026({segment}: {segment:'consolidado'|'agua'|'esgoto'}) {
 const rows=attackPlan2026.filter(r=>segment==='consolidado'||r.segment===(segment==='agua'?'WATER':'SEWER'));
 const s=attackPlanSummary(rows);const duplicates=new Set(attackPlanDuplicateIds());
 const groups=Array.from(new Set(rows.map(r=>r.municipality))).map(city=>({city,water:rows.filter(r=>r.municipality===city&&r.segment==='WATER').reduce((a,r)=>a+r.plannedEconomies,0),sewer:rows.filter(r=>r.municipality===city&&r.segment==='SEWER').reduce((a,r)=>a+r.plannedEconomies,0)}));
 return <section className="attack26" aria-label="Plano de Ataque 2026">
 <div className="sb-section-head"><h2>Plano de Ataque 2026</h2><span>Planejamento informado · não equivale a aprovação ou meta contratual</span></div>
 <div className="attack26-kpis"><article><span>Frentes previstas</span><strong>{s.fronts}</strong></article><article><span>Economias previstas · Água</span><strong>{s.waterEconomies.toLocaleString('pt-BR')}</strong></article><article><span>Economias previstas · Esgoto</span><strong>{s.sewerEconomies.toLocaleString('pt-BR')}</strong></article><article><span>Total previsto</span><strong>{s.totalEconomies.toLocaleString('pt-BR')}</strong></article></div>
 <div className="attack26-panels"><section><h3>Por município</h3><table><thead><tr><th>Município</th><th>Água</th><th>Esgoto</th><th>Total</th></tr></thead><tbody>{groups.map(g=><tr key={g.city}><td>{g.city}</td><td>{g.water}</td><td>{g.sewer}</td><td>{g.water+g.sewer}</td></tr>)}</tbody></table></section><section><h3>Frentes e IDs de mancha</h3><div className="attack26-scroll"><table><thead><tr><th>ID da mancha</th><th>Município</th><th>Frente</th><th>Sistema</th><th>Economias</th></tr></thead><tbody>{rows.map(r=><tr key={r.rowKey}><td>{r.stainId}{duplicates.has(r.rowKey)&&<span className="attack26-warning" title="ID informado em duas frentes de Conchas"> · verificar ID</span>}</td><td>{r.municipality}</td><td>{r.front}</td><td>{r.segment==='WATER'?'Água':'Esgoto'}</td><td>{r.plannedEconomies}</td></tr>)}</tbody></table></div></section></div>
 {duplicates.size>0&&<p className="attack26-note">Atenção: o ID 271_AR_0001N foi informado para Estrada CH 12,5 e Aflitos (Conchas). Conferir antes de gravar no cadastro definitivo.</p>}
 <small>Fonte: relação fornecida para o Plano de Ataque 2026. Novas obras e alterações ainda serão cadastradas posteriormente. Nenhuma gravação no Supabase.</small>
 </section>;
}
