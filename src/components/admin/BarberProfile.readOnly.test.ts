import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('BarberProfile read-only team view', () => {
  it('gates the more-actions menu and identity edits behind readOnly', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/admin/BarberProfile.tsx'), 'utf8');
    expect(src).toMatch(/readOnly\s*=\s*false/);
    expect(src).toMatch(/showActionsMenu = Boolean\(\s*!readOnly/);
    expect(src).toMatch(/canEditIdentity = Boolean\(!readOnly && onSaveIdentity/);
    expect(src).toMatch(/canEditAvatar = Boolean\(!readOnly && !memberOnly\)/);
    expect(src).toMatch(/admin-cp-more-btn/);
  });

  it('passes readOnly into services, hours, and time-off editors', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/admin/BarberProfile.tsx'), 'utf8');
    expect(src).toMatch(/<BarberServicesEditor[\s\S]*?readOnly=\{readOnly\}/);
    expect(src).toMatch(/<BarberWorkingHoursEditor[\s\S]*?readOnly=\{readOnly\}/);
    expect(src).toMatch(/<BarberBlocksEditor[\s\S]*?readOnly=\{readOnly\}/);
  });
});

describe('BookingsAdminPanel canEditTeam wiring', () => {
  it('derives canEditTeam from catalog/members permissions and passes readOnly', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/admin/BookingsAdminPanel.tsx'),
      'utf8',
    );
    expect(src).toMatch(/setCanEditTeam\(/);
    expect(src).toMatch(/perms\.includes\('catalog\.manage'\)/);
    expect(src).toMatch(/perms\.includes\('members\.manage'\)/);
    expect(src).toMatch(/perms\.includes\('members\.invite_barber'\)/);
    expect(src).toMatch(/readOnly=\{!canEditTeam\}/);
    expect(src).toMatch(/mode === 'blocks' && canEditTeam/);
  });
});

describe('AdminLayout Team nav for team.read', () => {
  it('includes team.read in Team anyOf', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/admin/AdminLayout.tsx'), 'utf8');
    expect(src).toMatch(
      /section: 'bookings_blocks'[\s\S]*?anyOf: \[[^\]]*'team\.read'[^\]]*\]/,
    );
  });
});
