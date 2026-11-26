import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function runGuard(args: string[] = []) {
  return spawnSync(process.execPath, ['scripts/claims-guard.mjs', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

describe('commercial claims guard', () => {
  it('passes on the clean tree', () => {
    const result = runGuard();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it('fails on a "0% fees" claim in a page title', () => {
    const root = mkdtempSync(join(tmpdir(), 'claims-guard-'));
    const seoDir = join(root, 'src', 'lib', 'seo');
    mkdirSync(seoDir, { recursive: true });
    writeFileSync(join(seoDir, 'fixture.ts'), "export const TITLE = 'Some Alternative UK: £39/mo, 0% Fees';\n", 'utf8');

    try {
      const result = runGuard(['--root', root]);
      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(/src\/lib\/seo\/fixture\.ts:1: 0% Fees/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails on a seeded banned phrase in a temp fixture', () => {
    const root = mkdtempSync(join(tmpdir(), 'claims-guard-'));
    const pageDir = join(root, 'src', 'pages');
    mkdirSync(pageDir, { recursive: true });
    writeFileSync(join(pageDir, 'fixture.astro'), 'Activate the live KERSIVO Assistant today.\n', 'utf8');

    try {
      const result = runGuard(['--root', root]);
      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(/src\/pages\/fixture\.astro:1: live KERSIVO Assistant/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
