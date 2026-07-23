import { describe, expect, it } from 'vitest';
import { memberCardStatus } from './teamCards';

describe('memberCardStatus', () => {
  it('maps NEW to new and ACTIVE to active', () => {
    expect(memberCardStatus('NEW')).toBe('new');
    expect(memberCardStatus('ACTIVE')).toBe('active');
  });
});
