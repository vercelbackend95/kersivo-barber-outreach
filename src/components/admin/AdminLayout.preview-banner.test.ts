import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AdminLayout preview banner', () => {
  it('pitches dashboard preview and subscribe, not under construction', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/admin/AdminLayout.tsx'), 'utf8');
    expect(source).toContain('This is how your dashboard will look.');
    expect(source).toContain("Subscribe and we&apos;ll build your website around");
    expect(source).toContain('Get started — £39/month');
    expect(source).not.toContain('Your shop is under construction.');
  });
});
