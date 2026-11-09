import { describe, expect, it } from 'vitest';
import { functionalTypeGroup } from './grouping';
import type { PermitActivity } from './types';

const row = (well_type_label: string) => ({ well_type_label }) as PermitActivity;

describe('functionalTypeGroup', () => {
  it('groups CalGEM injection well types as injectors', () => {
    for (const label of ['Injection', 'Steamflood', 'Waterflood', 'Water Disposal', 'Gas Disposal']) {
      expect(functionalTypeGroup(row(label))).toBe('injector');
    }
  });

  it('leaves gas storage and other types as other', () => {
    expect(functionalTypeGroup(row('Gas Storage'))).toBe('other');
    expect(functionalTypeGroup(row('Water Source'))).toBe('other');
  });
});
