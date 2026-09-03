import { describe, expect, it } from 'vitest';

import { RETAIL_NEED_DOMAINS, domainsForOverlapNeeds } from './retailNeedDomains';
import { RETAIL_NEEDS } from './taxonomy';

describe('retailNeedDomains', () => {
  it('covers every retail need in the taxonomy', () => {
    for (const need of RETAIL_NEEDS) {
      expect(RETAIL_NEED_DOMAINS[need]).toBeDefined();
    }
  });

  it('maps hair styling needs to HAIR', () => {
    expect(RETAIL_NEED_DOMAINS.HAIR_STYLING_CONTROL).toEqual(['HAIR']);
    expect(RETAIL_NEED_DOMAINS.HAIR_TEXTURE_DEFINITION).toEqual(['HAIR']);
  });

  it('maps beard needs to beard and moustache domains', () => {
    expect(RETAIL_NEED_DOMAINS.BEARD_SOFTENING).toEqual(['BEARD', 'MOUSTACHE']);
    expect(RETAIL_NEED_DOMAINS.MOUSTACHE_STYLING).toEqual(['MOUSTACHE']);
  });

  it('returns deduplicated domains in deterministic order', () => {
    expect(domainsForOverlapNeeds(['HAIR_STYLING_CONTROL', 'HAIR_CLEANSING'])).toEqual(['HAIR']);
    expect(domainsForOverlapNeeds(['BEARD_SOFTENING', 'MOUSTACHE_STYLING'])).toEqual([
      'BEARD',
      'MOUSTACHE',
    ]);
    expect(domainsForOverlapNeeds(['COLOUR_MAINTENANCE'])).toEqual(['HAIR', 'BEARD', 'MOUSTACHE']);
  });

  it('returns no domains for UNKNOWN', () => {
    expect(domainsForOverlapNeeds(['UNKNOWN'])).toEqual([]);
  });
});
