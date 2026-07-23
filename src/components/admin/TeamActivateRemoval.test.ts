import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Phase 1C Activate removal', () => {
  it('removes the membership activate endpoint', () => {
    expect(
      existsSync(
        resolve(process.cwd(), 'src/pages/api/admin/team/members/[memberId]/activate.ts'),
      ),
    ).toBe(false);
  });

  it('Team overview has no Activate / Reactivate / activation handlers', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/admin/BarbersOverview.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/\bActivate\b/);
    expect(src).not.toMatch(/\bReactivate\b/);
    expect(src).not.toMatch(/handleActivate|canActivate|onActivate/);
    expect(src).not.toMatch(/\/activate/);
    expect(src).not.toMatch(/awaiting activation/i);
    expect(src).toMatch(/invitationsSectionRevealLabel|INVITATIONS_SECTION_HIDE_LABEL|Hide invitations/);
    expect(src).toMatch(/partitionTeamCards/);
  });

  it('roster card has no Activate CTA props', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/admin/AdminBarberRosterCard.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/\bActivate\b/);
    expect(src).not.toMatch(/\bReactivate\b/);
    expect(src).not.toMatch(/canActivate|onActivate/);
  });

  it('Team DTO drops canActivate', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/admin/teamCards.ts'), 'utf8');
    expect(src).not.toMatch(/canActivate/);
    expect(src).toMatch(/Invitation pending/);
    expect(src).not.toMatch(/Invite pending/);
  });

  it('Team GET does not emit canActivate', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/pages/api/admin/team/index.ts'), 'utf8');
    expect(src).not.toMatch(/canActivate/);
    expect(src).toMatch(/cardStatus: 'active'/);
  });
});
