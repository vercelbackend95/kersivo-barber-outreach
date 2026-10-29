import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(process.cwd(), 'src');
const MARKETING_DIRS = ['components', 'lib/seo', 'lib/pricing', 'pages'];
// Terms renders ONBOARDING_TIMELINE_CLAIM from claimsPolicy.ts: legal text, changed separately.
const EXCLUDED = new Set([join(root, 'lib/pricing/claimsPolicy.ts')]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(astro|ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('setup time on marketing pages', () => {
  it('says "a few days", never "1–2 weeks" or a fixed number of days', () => {
    const offenders = MARKETING_DIRS.flatMap((dir) => sourceFiles(join(root, dir)))
      .filter((file) => !EXCLUDED.has(file))
      .filter((file) => /\b1\s*[–-]\s*2 weeks|\b[2-9]\s*[–-]\s*\d+ (working )?days\b/i.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
