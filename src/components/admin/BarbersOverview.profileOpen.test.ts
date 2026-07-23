import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';

describe('Team profile open is read-only', () => {
  it('does not PATCH bookable when opening a member without a booking profile', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/admin/BarbersOverview.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/\/team\/members\/.*\/bookable/);
    expect(src).not.toMatch(/JSON\.stringify\(\{\s*bookable:\s*false/);
    expect(src).toMatch(/memberOnly:\s*true/);
    expect(src).toMatch(/never create a Barber seat/i);
  });
});
