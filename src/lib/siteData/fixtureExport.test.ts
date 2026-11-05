import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildSiteData } from './build';
import { PUBLISHED_FIXTURE_PATH, publishedFixtureJson } from './fixtures';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const committed = readFileSync(join(root, PUBLISHED_FIXTURE_PATH), 'utf8').replace(/\r\n/g, '\n');

function strings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => strings(n, out));
  else if (node && typeof node === 'object') Object.values(node).forEach((v) => strings(v, out));
  return out;
}

describe('published SiteData fixture (docs/site-data/fixture.json)', () => {
  it('is up to date with the type and the builder (run: npx tsx scripts/site-data/export-fixture.ts)', () => {
    expect(committed).toBe(publishedFixtureJson(buildSiteData));
  });

  it('contains fictional data only: every URL and email on a reserved .test domain or kersivo.co.uk', () => {
    const values = strings(JSON.parse(committed));
    const urls = values.filter((v) => /^https?:\/\//.test(v));
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      const host = new URL(url).hostname;
      expect(host === 'kersivo.co.uk' || host === 'schema.org' || host.endsWith('.example.test'), url).toBe(true);
    }
    for (const email of values.filter((v) => v.includes('@') && !v.startsWith('http'))) {
      expect(email.endsWith('@example.test'), email).toBe(true);
    }
  });
});
