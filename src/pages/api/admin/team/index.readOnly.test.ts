import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('GET /api/admin/team', () => {
  it('remains read-only (no database writes)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/pages/api/admin/team/index.ts'), 'utf8');
    expect(src).not.toMatch(/\.create\(/);
    expect(src).not.toMatch(/\.update\(/);
    expect(src).not.toMatch(/\.delete\(/);
    expect(src).not.toMatch(/\$transaction/);
    expect(src).toMatch(/findMany/);
    // Legacy NEW must not be silently written to ACTIVE on GET.
    expect(src).not.toMatch(/teamStatus:\s*['"]ACTIVE['"]/);
  });
});
