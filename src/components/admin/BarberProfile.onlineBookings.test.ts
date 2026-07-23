import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Team profile booking availability actions', () => {
  it('does not expose Deactivate/Reactivate as booking-availability controls', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/admin/BarberProfile.tsx'), 'utf8');
    expect(src).not.toMatch(/Deactivate barber\?/);
    expect(src).not.toMatch(/Reactivate barber\?/);
    expect(src).not.toMatch(/actionLabel = isActive \? 'Deactivate'/);
  });

  it('uses canManageOnlineBookings for the Accept online bookings control', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/admin/BarberProfile.tsx'), 'utf8');
    expect(src).toMatch(/canManageOnlineBookings/);
    expect(src).toMatch(/Accept online bookings/);
  });
});
