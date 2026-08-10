import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('LaunchWizard preview via', () => {
  it('keeps guest checkout mode when launch-context returns via preview', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/admin/launch/LaunchWizard.tsx'),
      'utf8',
    );
    expect(source).toContain("data.via === 'preview'");
    expect(source).toContain("setMode('guest')");
    expect(source).toContain('// Preview cookie unlocks progress for the sidebar; purchase stays guest checkout.');
  });
});
