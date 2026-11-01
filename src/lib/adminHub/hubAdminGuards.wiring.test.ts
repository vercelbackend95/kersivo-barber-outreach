import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function src(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('hub side-effect guards (handler layer)', () => {
  it('blocks dashboard invites and resends before mail', () => {
    expect(src('src/pages/api/admin/team/invite.ts')).toContain('denyHubInvite');
    expect(src('src/pages/api/admin/members/invite.ts')).toContain('denyHubInvite');
    expect(src('src/pages/api/admin/team/invitations/[inviteId]/resend.ts')).toContain('denyHubInvite');
  });

  it('blocks enabling retail from barbershop settings', () => {
    expect(src('src/pages/api/admin/barbershop-settings/retail.ts')).toContain('denyHubRestricted');
  });

  it('locks hub shops out of clearing the construction pause', () => {
    expect(src('src/lib/preview/guestPreviewConstruction.ts')).toContain("input.via === 'hub'");
  });
});
