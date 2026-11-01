import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('POST /api/admin/shop/products/create hub guard', () => {
  it('does not mark retail onboarding complete for via hub', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/pages/api/admin/shop/products/create.ts'), 'utf8');
    expect(src).toContain("if (access.via !== 'hub')");
    expect(src).toContain('markRetailOnboardingCompleted');
    const skips = src.match(/if \(access\.via !== 'hub'\) \{\s*await markRetailOnboardingCompleted/g);
    expect(skips?.length).toBe(2);
  });
});
