'use client';
import Link from 'next/link';
import {CalendarDays} from 'lucide-react';
import {MainNavigation} from '@/components/MainNavigation';
import {LogoutButton} from '@/components/LogoutButton';
import '@/app/approved-dashboard.css';
import './vitalux-chrome.css';

export function VitaluxChrome({children,lastUpdated,year,title='SBON 17B'}:{children:React.ReactNode;lastUpdated?:string|null;year?:number;title?:string}){
 const date=lastUpdated?new Intl.DateTimeFormat('pt-BR').format(new Date(lastUpdated+'T12:00:00')):'Aguardando atualização';
 return <div className="va-app">
  <header className="va-header">
   <Link href="/" className="va-brand-link" aria-label="Vitalux Ecoativa, abrir Dashboard">
    <img src="/vitalux-marca-oficial.svg" alt="Vitalux Ecoativa — projetos sustentáveis" width={185} height={48}/>
   </Link>
   <div className="va-header-rule"/>
   <div className="va-breadcrumb">Painel Gerencial <span>›</span> <strong>{title}</strong></div>
   <div className="va-header-right">
    {lastUpdated!==undefined&&<div className="va-date"><CalendarDays size={20}/><span>Dados de execução<small>{date}</small></span></div>}
    {year!==undefined&&<div className="va-period"><span>Período<small>{year} (ano)</small></span></div>}
    <LogoutButton/>
   </div>
  </header>
  <aside className="va-sidebar"><MainNavigation/><div className="va-sidebar-end"><span className="va-leaf" aria-hidden="true">♧</span><p>Infraestrutura<br/>para um futuro<br/>mais sustentável.</p></div></aside>
  {children}
 </div>;
}
