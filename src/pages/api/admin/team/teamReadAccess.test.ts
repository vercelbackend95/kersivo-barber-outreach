import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readApi(relPath: string) {
  return readFileSync(resolve(process.cwd(), relPath), 'utf8');
}

describe('team.read GET access for Barber profile preview', () => {
  it('allows team.read on Team list GET', () => {
    const src = readApi('src/pages/api/admin/team/index.ts');
    expect(src).toMatch(/requireAnyPermission\(access, \[[\s\S]*?'team\.read'[\s\S]*?\]\)/);
  });

  it('allows team.read on barber list GET but keeps POST gated to catalog.manage', () => {
    const src = readApi('src/pages/api/admin/barbers.ts');
    const getStart = src.indexOf('export const GET');
    const postStart = src.indexOf('export const POST');
    expect(getStart).toBeGreaterThan(-1);
    expect(postStart).toBeGreaterThan(getStart);
    const getBody = src.slice(getStart, postStart);
    expect(getBody).toMatch(/team\.read/);
    expect(getBody).toMatch(/catalog\.manage/);
    const postBody = src.slice(postStart, postStart + 400);
    expect(postBody).toMatch(/catalog\.manage/);
    expect(postBody).not.toMatch(/team\.read/);
  });

  it('allows team.read on working-hours GET but keeps PUT gated to catalog.manage', () => {
    const src = readApi('src/pages/api/admin/barbers/[id]/rules.ts');
    const getStart = src.indexOf('export const GET');
    const putStart = src.indexOf('export const PUT');
    expect(getStart).toBeGreaterThan(-1);
    expect(putStart).toBeGreaterThan(getStart);
    expect(src.slice(getStart, putStart)).toMatch(/team\.read/);
    expect(src.slice(putStart, putStart + 300)).toMatch(/catalog\.manage/);
    expect(src.slice(putStart, putStart + 300)).not.toMatch(/team\.read/);
  });

  it('allows team.read on services GET but keeps POST gated to catalog.manage', () => {
    const src = readApi('src/pages/api/admin/services.ts');
    const getStart = src.indexOf('export const GET');
    const postStart = src.indexOf('export const POST');
    expect(getStart).toBeGreaterThan(-1);
    expect(postStart).toBeGreaterThan(getStart);
    expect(src.slice(getStart, postStart)).toMatch(/team\.read/);
    expect(src.slice(postStart, postStart + 300)).toMatch(/catalog\.manage/);
    expect(src.slice(postStart, postStart + 300)).not.toMatch(/team\.read/);
  });

  it('allows team.read on timeblocks GET', () => {
    const src = readApi('src/pages/api/admin/timeblocks/index.ts');
    expect(src).toMatch(/team\.read/);
    expect(src).toMatch(/catalog\.manage/);
  });
});
