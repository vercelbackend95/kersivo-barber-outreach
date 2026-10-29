import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { UK_RATE_SOURCES, UK_RATES_CHECKED_ISO } from './uk-rates-2026-27';

const here = dirname(fileURLToPath(import.meta.url));

describe('UK 2026/27 rates config', () => {
  it('gives every figure an official source and a checked date', () => {
    for (const [name, entry] of Object.entries(UK_RATE_SOURCES)) {
      expect(entry.source, name).toMatch(/^https:\/\/www\.(gov\.uk|thepensionsregulator\.gov\.uk)\//);
      expect(entry.checked, name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.checked <= UK_RATES_CHECKED_ISO, name).toBe(true);
    }
  });

  it('is the only place the calculator reads statutory figures from', () => {
    const toolDir = join(here, '../lib/chairRentVsCommission');
    const statutory = /12\.71|10\.85|50[_,]?270|6[_,]?240|10[_,]?500|90[_,]?000|\b5\.6\b|0\.15\b|0\.03\b|\b0\.2\b/;
    for (const file of readdirSync(toolDir).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))) {
      expect(readFileSync(join(toolDir, file), 'utf8'), file).not.toMatch(statutory);
    }
  });
});
