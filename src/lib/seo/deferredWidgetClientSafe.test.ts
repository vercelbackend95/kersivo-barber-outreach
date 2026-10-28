import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * DeferredWidget runs in the browser. If anything it imports (statically or via dynamic import)
 * reaches the Prisma client, `@/lib/db/*`, dotenv or Node built-ins, the island throws on load
 * and every homepage / alternative-page demo widget stays an empty box.
 */
const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = normalize(join(here, '../..'));
const entry = join(srcRoot, 'components/landing/DeferredWidget.tsx');

const FORBIDDEN_PACKAGES = [/^@prisma\/client/, /^\.prisma\//, /^dotenv/, /^node:/, /^fs$/, /^path$/];
const FORBIDDEN_SRC = [/^lib\/db\//];

const IMPORT_RE =
  /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveLocal(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(srcRoot, spec.slice(2));
  else if (spec.startsWith('.')) base = normalize(join(dirname(from), spec));
  else return null;
  for (const ext of ['', '.ts', '.tsx', '.js', '/index.ts', '/index.tsx']) {
    const candidate = base + ext;
    if (existsSync(candidate) && !candidate.endsWith('/')) {
      try {
        readFileSync(candidate);
        return candidate;
      } catch {
        /* directory */
      }
    }
  }
  return null;
}

function collectViolations(): string[] {
  const seen = new Set<string>();
  const violations: string[] = [];
  const stack: Array<{ file: string; chain: string[] }> = [{ file: entry, chain: [] }];

  while (stack.length) {
    const { file, chain } = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const rel = relative(srcRoot, file);
    const nextChain = [...chain, rel];
    const source = readFileSync(file, 'utf8');

    for (const match of source.matchAll(IMPORT_RE)) {
      if (match[1]) continue; // `import type` is erased at build time
      const spec = match[2] ?? match[3];
      if (!spec || spec.endsWith('.css')) continue;
      if (FORBIDDEN_PACKAGES.some((re) => re.test(spec))) {
        violations.push(`${nextChain.join(' -> ')} -> ${spec}`);
        continue;
      }
      const resolved = resolveLocal(spec, file);
      if (!resolved) continue;
      if (FORBIDDEN_SRC.some((re) => re.test(relative(srcRoot, resolved)))) {
        violations.push(`${nextChain.join(' -> ')} -> ${relative(srcRoot, resolved)}`);
        continue;
      }
      stack.push({ file: resolved, chain: nextChain });
    }
  }
  return violations;
}

describe('DeferredWidget client bundle', () => {
  it('never imports Prisma, the database layer, dotenv or Node built-ins', () => {
    expect(collectViolations()).toEqual([]);
  });
});
