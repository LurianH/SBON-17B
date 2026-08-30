export type AppRole = 'ADMIN' | 'EDITOR' | 'GESTOR' | 'DIRETORIA';

const routeRoles: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: '/admin', roles: ['ADMIN'] },
  { prefix: '/atualizar', roles: ['ADMIN', 'EDITOR'] },
  { prefix: '/historico', roles: ['ADMIN', 'GESTOR'] },
];

export function canAccessRoute(pathname: string, role: AppRole) {
  const rule = routeRoles.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return !rule || rule.roles.includes(role);
}
