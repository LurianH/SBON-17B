import type { Metadata } from 'next';
import './globals.css';
import './secondary.css';
import './logout.css';
import './target.css';
export const metadata: Metadata={title:'SBON 17B | Vitalux',description:'Painel executivo do contrato SBON 17B',openGraph:{title:'SBON 17B',description:'Painel Executivo Vitalux',images:['/og.png']},twitter:{card:'summary_large_image',title:'SBON 17B',description:'Painel Executivo Vitalux',images:['/og.png']}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="pt-BR"><body>{children}</body></html>}
