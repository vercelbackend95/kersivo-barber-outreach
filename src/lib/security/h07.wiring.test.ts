import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

function collectProductionSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectProductionSourceFiles(full, out);
      continue;
    }
    if (/\.test\.(ts|tsx)$/.test(entry)) continue;
    if (/\.(ts|tsx|js|mjs|astro)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('H07 security wiring', () => {
  it('does not ship DEMO_ADMIN_SECRET in production source', () => {
    const root = resolve(process.cwd(), 'src');
    const files = collectProductionSourceFiles(root);
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(/DEMO_ADMIN_SECRET/);
      expect(src, file).not.toMatch(/supersecret123/);
    }
  });

  it('middleware applies security headers and expanded origin gate', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/middleware.ts'), 'utf8');
    expect(src).toMatch(/applySecurityHeaders/);
    expect(src).toMatch(/evaluateOriginGate/);
  });
});
