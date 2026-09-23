import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Route-level wiring assertions: every user-controlled public media URL write
 * surface must invoke assertUserSuppliedPublicMediaUrlAllowed.
 */
const SURFACES = [
  'src/pages/api/admin/barbershop-settings/identity.ts',
  'src/pages/api/admin/onboarding/shop.ts',
  'src/pages/api/preview/onboarding/shop.ts',
  'src/pages/api/admin/shop/products/create.ts',
  'src/pages/api/admin/shop/products/update.ts',
  'src/pages/api/admin/services.ts',
  'src/pages/api/admin/services/[id].ts',
  'src/pages/api/admin/barbers.ts',
  'src/pages/api/admin/clients/[clientId]/index.ts',
  'src/pages/api/admin/onboarding/barbers.ts',
  'src/pages/api/preview/onboarding/barbers.ts',
] as const;

describe('user-supplied public media URL write surfaces', () => {
  for (const relativePath of SURFACES) {
    it(`${relativePath} invokes assertUserSuppliedPublicMediaUrlAllowed`, () => {
      const source = readFileSync(relativePath, 'utf8');
      expect(source).toContain('assertUserSuppliedPublicMediaUrlAllowed');
    });
  }
});
