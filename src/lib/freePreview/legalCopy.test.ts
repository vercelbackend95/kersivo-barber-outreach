import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCEPTED_PRIOR_TERMS_VERSIONS, CURRENT_TERMS_VERSION } from '@/lib/legal/termsVersion';
import { FREE_PREVIEW_PRIVACY_RETENTION_TEXT, FREE_PREVIEW_TERMS_TEXT } from './legalCopy';

describe('free preview legal copy (spec §12)', () => {
  it('reads expiry and retention from config', () => {
    expect(FREE_PREVIEW_TERMS_TEXT).toContain('remains available for 30 days');
    expect(FREE_PREVIEW_TERMS_TEXT).toContain('within 90 days of the preview expiring');
    expect(FREE_PREVIEW_PRIVACY_RETENTION_TEXT).toContain('within 90 days of the preview expiring');
  });

  it('is rendered on /terms and /privacy with the lawful basis', () => {
    const terms = readFileSync('src/pages/terms.astro', 'utf8');
    const privacy = readFileSync('src/pages/privacy.astro', 'utf8');
    expect(terms).toContain('{FREE_PREVIEW_TERMS_TEXT}');
    expect(privacy).toContain('{FREE_PREVIEW_PRIVACY_RETENTION_TEXT}');
    expect(privacy).toContain('{FREE_PREVIEW_PRIVACY_HUB_FILES_TEXT}');
    expect(privacy.replace(/\s+/g, ' ')).toContain('steps taken at your request before entering into a contract');
  });

  it('keeps the previous Terms version valid after the bump', () => {
    expect(CURRENT_TERMS_VERSION).toBe('2026-10-30');
    expect(ACCEPTED_PRIOR_TERMS_VERSIONS).toContain('2026-10-28');
  });
});
