import {VitaluxChrome} from '@/components/VitaluxChrome';
export function AppShell({title,eyebrow='SBON 17B',children}:{title:string;eyebrow?:string;children:React.ReactNode}){
 return <VitaluxChrome title={title}>
  <main className="va-main va-internal-main">
   <section className="va-internal-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>SBON 17B · acompanhamento e gestão do contrato</p></section>
   {children}
   <footer className="va-internal-footer"><span>SBON 17B · Vitalux Ecoativa</span><span>Dados e históricos preservados no sistema</span></footer>
  </main>
 </VitaluxChrome>;
}