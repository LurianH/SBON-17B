import { describe, expect, it } from 'vitest';
import { canAccessRoute, type AppRole } from './authorization';

describe('autorização de rotas', () => {
  const cases: Array<[AppRole, string, boolean]> = [
    ['ADMIN', '/admin', true],
    ['EDITOR', '/admin', false],
    ['GESTOR', '/admin', false],
    ['DIRETORIA', '/admin', false],
    ['ADMIN', '/atualizar', true],
    ['EDITOR', '/atualizar', true],
    ['GESTOR', '/atualizar', false],
    ['DIRETORIA', '/atualizar', false],
    ['ADMIN', '/historico', true],
    ['GESTOR', '/historico', true],
    ['EDITOR', '/historico', false],
    ['DIRETORIA', '/historico', false],
    ['DIRETORIA', '/analise', true],
  ];

  it.each(cases)('%s em %s = %s', (role, path, expected) => {
    expect(canAccessRoute(path, role)).toBe(expected);
  });
});
