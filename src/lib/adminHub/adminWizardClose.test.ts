import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('admin wizard close buttons keep their aria-labels', () => {
  it('does not change close aria-labels on wizards and team sheets', () => {
    expect(read('src/components/admin/TeamInviteWizard.tsx')).toContain('aria-label="Close invite wizard"');
    expect(read('src/components/admin/barber-wizard/BarberWizard.tsx')).toContain('aria-label="Close barber wizard"');
    expect(read('src/components/admin/service-wizard/ServiceWizard.tsx')).toContain(
      'aria-label="Close service wizard"',
    );
    expect(read('src/components/admin/product-wizard/ProductWizard.tsx')).toContain(
      'aria-label="Close product wizard"',
    );
    expect(read('src/components/admin/TeamChangeRoleSheet.tsx')).toContain('aria-label="Close"');
    expect(read('src/components/admin/TeamDashboardAccountSheet.tsx')).toContain('aria-label="Close"');
    expect(read('src/components/admin/TeamDeleteBarberSheet.tsx')).toContain('aria-label="Close"');
    expect(read('src/components/admin/OnlineBookingsSheet.tsx')).toContain('aria-label="Close"');
  });
});
