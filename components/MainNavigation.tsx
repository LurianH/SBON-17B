'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect, useState} from 'react';
import {canAccessRoute, type AppRole} from '@/lib/authorization';
import {createClient} from '@/lib/supabase/client';

const links = [['/', 'Dashboard'], ['/engenharia', 'Engenharia'], ['/atualizar', 'Atualização'], ['/analise', 'Análise'], ['/historico', 'Histórico'], ['/admin', 'Administração']];
export function MainNavigation() {
  const path = usePathname(), [role, setRole] = useState<AppRole | null>(null);
  useEffect(() => {
    let active = true;
    const db = createClient();
    if (db) void db.auth.getUser().then(async ({data: {user}}) => {
      if (!user) return;
      const {data} = await db.from('profiles').select('role,active').eq('id', user.id).maybeSingle();
      if (active && data?.active) setRole(data.role as AppRole);
    }).catch(() => {});
    return () => {active = false;};
  }, []);
  return <nav className="main-navigation" aria-label="Navegação principal">{links.filter(([href]) => role ? canAccessRoute(href, role) : ['/', '/engenharia', '/analise'].includes(href)).map(([href, label]) => <Link key={href} href={href} className={path === href ? 'active' : ''} aria-current={path === href ? 'page' : undefined}>{label}</Link>)}</nav>;
}
