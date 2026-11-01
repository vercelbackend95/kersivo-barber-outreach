import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OVERVIEW_BENTO_AREAS } from './overview';

const css = readFileSync(resolve(process.cwd(), 'src/styles/components/admin-hub.css'), 'utf8');

function quotedRows(rows: readonly string[]): string[] {
  return rows.map((row) => `"${row}"`);
}

describe('overview bento CSS areas', () => {
  it('uses the same grid-template-areas as the view-model at each breakpoint', () => {
    for (const key of Object.keys(OVERVIEW_BENTO_AREAS) as Array<keyof typeof OVERVIEW_BENTO_AREAS>) {
      for (const row of quotedRows(OVERVIEW_BENTO_AREAS[key])) expect(css).toContain(row);
    }
    expect(css).not.toContain('admin-hub-bento__add');
    expect(css).not.toContain('.admin-hub-tile--add');
  });
});
