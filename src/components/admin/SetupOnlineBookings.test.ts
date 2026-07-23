import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Set up online bookings wiring', () => {
  it('Team GET emits canSetUpOnlineBookings for eligible members only', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/pages/api/admin/team/index.ts'), 'utf8');
    expect(src).toMatch(/canSetUpOnlineBookings/);
    expect(src).toMatch(/canActorSetUpOnlineBookings/);
    expect(src).toMatch(/canSetUpOnlineBookings:\s*false/);
  });

  it('member-only profile open passes canSetUpOnlineBookings and never writes on open', () => {
    const overview = readFileSync(
      resolve(process.cwd(), 'src/components/admin/BarbersOverview.tsx'),
      'utf8',
    );
    expect(overview).toMatch(/canSetUpOnlineBookings:\s*card\.canSetUpOnlineBookings/);
    expect(overview).toMatch(/memberOnly:\s*true/);
    expect(overview).not.toMatch(/\/booking-profile/);
  });

  it('BarberProfile enables setup CTA only when canSetUpOnlineBookings', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/admin/BarberProfile.tsx'), 'utf8');
    expect(src).toMatch(/canSetUpOnlineBookings/);
    expect(src).toMatch(/mode="setup-member"/);
    expect(src).toMatch(/Set up online bookings/);
    expect(src).not.toMatch(/coming soon/i);
  });

  it('setup-member wizard uses atomic member booking-profile endpoint only', () => {
    const wizard = readFileSync(
      resolve(process.cwd(), 'src/components/admin/barber-wizard/BarberWizard.tsx'),
      'utf8',
    );
    expect(wizard).toMatch(/setup-member/);
    expect(wizard).toMatch(/\/api\/admin\/team\/members\/\$\{memberId\}\/booking-profile/);
    expect(wizard).toMatch(/createSubmissionGate/);
    expect(wizard).toMatch(/Online bookings ready/);
    expect(wizard).toMatch(/Setting up…/);
    expect(wizard).toMatch(/TEAM_SETUP_ONLINE_BOOKINGS_REFRESH_WARNING/);

    const setupStart = wizard.indexOf('async function saveSetupMember');
    expect(setupStart).toBeGreaterThan(-1);
    const nextFn = wizard.indexOf('\n  async function ', setupStart + 1);
    const setupFn = wizard.slice(setupStart, nextFn === -1 ? undefined : nextFn);
    expect(setupFn).toMatch(/booking-profile/);
    expect(setupFn).not.toMatch(/\/api\/admin\/barbers/);
    expect(setupFn).not.toMatch(/\/rules/);
  });

  it('BookingsAdminPanel transitions memberOnly to false after setup success', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/admin/BookingsAdminPanel.tsx'),
      'utf8',
    );
    expect(src).toMatch(/onSetupOnlineBookingsSaved/);
    expect(src).toMatch(/memberOnly:\s*false/);
    expect(src).toMatch(/bookable:\s*true/);
    expect(src).toMatch(/booking-profiles\/\$\{encodeURIComponent\(barberId\)\}\/online-bookings/);
  });
});
