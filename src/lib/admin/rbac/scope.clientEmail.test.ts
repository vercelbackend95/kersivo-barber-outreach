import { describe, expect, it } from 'vitest';
import { canViewClientEmail } from './scope';

describe('canViewClientEmail', () => {
  it('allows OWNER and MANAGER', () => {
    expect(canViewClientEmail({ role: 'OWNER' })).toBe(true);
    expect(canViewClientEmail({ role: 'MANAGER' })).toBe(true);
  });

  it('denies BARBER', () => {
    expect(canViewClientEmail({ role: 'BARBER' })).toBe(false);
  });
});
