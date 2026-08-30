import { describe, expect, it } from 'vitest';
import { safeInternalPath } from './site-url';

describe('safeInternalPath', () => {
  it('accepts a local application path', () => {
    expect(safeInternalPath('/account/update-password')).toBe('/account/update-password');
  });

  it('rejects protocol-relative and absolute redirects', () => {
    expect(safeInternalPath('//evil.example')).toBe('/');
    expect(safeInternalPath('https://evil.example')).toBe('/');
  });
});
