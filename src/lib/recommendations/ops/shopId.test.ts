import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseOpsShopId } from './shopId';

const here = dirname(fileURLToPath(import.meta.url));

describe('parseOpsShopId', () => {
  it('accepts cuid-like ids', () => {
    expect(parseOpsShopId('clxyz123ABC_-')).toEqual({ ok: true, shopId: 'clxyz123ABC_-' });
  });

  it('rejects empty, charset, and oversized', () => {
    expect(parseOpsShopId('')).toEqual({ ok: false, code: 'INVALID_QUERY' });
    expect(parseOpsShopId('  ')).toEqual({ ok: false, code: 'INVALID_QUERY' });
    expect(parseOpsShopId('bad id')).toEqual({ ok: false, code: 'INVALID_QUERY' });
    expect(parseOpsShopId('../x')).toEqual({ ok: false, code: 'INVALID_QUERY' });
    expect(parseOpsShopId('x'.repeat(200))).toEqual({ ok: false, code: 'INVALID_QUERY' });
    expect(parseOpsShopId(null)).toEqual({ ok: false, code: 'INVALID_QUERY' });
  });
});

describe('MinimalLayout and Ops page analytics/router gates', () => {
  it('defaults analytics and client router to enabled in layout', () => {
    const src = readFileSync(join(here, '../../../layouts/MinimalLayout.astro'), 'utf8');
    expect(src).toContain('enableAnalytics = true');
    expect(src).toContain('enableClientRouter = true');
    expect(src).toContain('enableAnalytics ? <GoogleAnalytics');
    expect(src).toContain('enableClientRouter ? <ClientRouter');
  });

  it('disables analytics and client router on ops overview page', () => {
    const src = readFileSync(
      join(here, '../../../pages/ops/recommendations/index.astro'),
      'utf8',
    );
    expect(src).toContain('enableAnalytics={false}');
    expect(src).toContain('enableClientRouter={false}');
    expect(src).toContain('showCookieConsent={false}');
    expect(src).not.toMatch(/<GoogleAnalytics/);
    expect(src).not.toMatch(/<ClientRouter/);
  });

  it('disables analytics and client router on ops detail page', () => {
    const src = readFileSync(
      join(here, '../../../pages/ops/recommendations/[shopId].astro'),
      'utf8',
    );
    expect(src).toContain('enableAnalytics={false}');
    expect(src).toContain('enableClientRouter={false}');
    expect(src).toContain('showCookieConsent={false}');
    expect(src).not.toMatch(/<GoogleAnalytics/);
    expect(src).not.toMatch(/<ClientRouter/);
  });
});
