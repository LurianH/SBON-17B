import {describe, expect, it, vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {weeklyProgressSchema} from './validation';
import {WeeklyForm} from '../components/EntryForms';

vi.mock('@/lib/supabase/client', () => ({createClient: vi.fn()}));
const execution = {reference_date: '2026-09-14', economies_executed: 120, network_executed_m: 123.456};
describe('weekly execution input', () => {
  it('accepts execution only and strips legacy engineering fields from the write payload', () => {
    expect(weeklyProgressSchema.parse(execution)).toEqual(execution);
    expect(weeklyProgressSchema.parse({...execution, economies_available: 10, network_approved_m: 2})).toEqual(execution);
    expect(weeklyProgressSchema.parse({...execution, economies_available: null, network_approved_m: null})).toEqual(execution);
  });
  it('keeps execution required, nonnegative and economies integral', () => {
    for (const change of [{economies_executed: undefined}, {network_executed_m: undefined}, {economies_executed: -1}, {economies_executed: 1.5}, {network_executed_m: -1}]) {
      expect(weeklyProgressSchema.safeParse({...execution, ...change}).success).toBe(false);
    }
  });
  it('renders only the three execution fields', () => {
    const html = renderToStaticMarkup(createElement(WeeklyForm));
    expect([...html.matchAll(/<input[^>]*name="([^"]+)"/g)].map(m => m[1])).toEqual(['reference_date', 'economies_executed', 'network_executed_m']);
    expect(html).toContain('Economias executadas');
    expect(html).not.toMatch(/disponíveis|aprovad|consolidado/);
    expect(html).toContain('step="0.001"');
  });
});
