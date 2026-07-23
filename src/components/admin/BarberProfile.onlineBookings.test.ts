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

  it('does not expose Turn online/offline or onToggleActive', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/admin/BarberProfile.tsx'), 'utf8');
    expect(src).not.toMatch(/Turn online/);
    expect(src).not.toMatch(/Turn offline/);
    expect(src).not.toMatch(/onToggleActive/);
  });

  it('uses canManageOnlineBookings for the Accept online bookings control', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/admin/BarberProfile.tsx'), 'utf8');
    expect(src).toMatch(/canManageOnlineBookings/);
    expect(src).toMatch(/Accept online bookings/);
  });
});

describe('BookingsAdminPanel online bookings wiring', () => {
  it('does not pass onToggleActive or define updateBarberStatus', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/admin/BookingsAdminPanel.tsx'), 'utf8');
    expect(src).not.toMatch(/onToggleActive/);
    expect(src).not.toMatch(/updateBarberStatus/);
  });

  it('keeps Team Accept online bookings on the canonical barberId endpoint', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/admin/BookingsAdminPanel.tsx'), 'utf8');
    expect(src).toMatch(/booking-profiles\/\$\{encodeURIComponent\(barberId\)\}\/online-bookings/);
    expect(src).toMatch(/canManageOnlineBookings/);
    expect(src).toMatch(/onToggleBookable/);
  });
});
