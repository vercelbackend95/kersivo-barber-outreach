import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('preview retail test-shop gates', () => {
  it('allows tenant admin access on test-shop pages', () => {
    const grid = readFileSync(resolve(process.cwd(), 'src/pages/admin/test-shop.astro'), 'utf8');
    const pdp = readFileSync(resolve(process.cwd(), 'src/pages/admin/test-shop/[id].astro'), 'utf8');
    for (const source of [grid, pdp]) {
      expect(source).toContain('isTenantAdminAccess');
      expect(source).toContain('if (!isTenantAdminAccess(access))');
      expect(source).not.toContain("access.via !== 'session'");
    }
  });

  it('deep-links View in my shop with category and highlight', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/admin/retail-onboarding/RetailOnboardingWizard.tsx'),
      'utf8',
    );
    expect(source).toContain(
      '`/admin/test-shop?category=${encodeURIComponent(addedSummary.category)}&highlight=1`',
    );
  });
});
