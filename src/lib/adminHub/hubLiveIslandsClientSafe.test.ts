import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Hub P7: the live Overview islands, the app host and the hub store run in the browser. If their import graph
 * reaches Prisma or `@/lib/db/*`, hydration throws and the Overview never updates (`process is not defined`).
 */
const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = normalize(join(here, '../..'));
const ENTRIES = [
  'components/adminHub/AdminHubContentTile.tsx',
  'components/adminHub/AdminHubColoursTile.tsx',
  'components/adminHub/AdminHubPreviewPhone.tsx',
  'components/adminHub/AdminHubOverviewAnnouncer.tsx',
  'components/adminHub/AppHost.tsx',
  'components/adminHub/PreviewAdminChrome.tsx',
  'lib/adminHub/hubStore.ts',
].map((file) => join(srcRoot, file));
const rel = (file: string) => relative(srcRoot, file).split(sep).join('/');

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

function collectViolations(entry: string): string[] {
  const seen = new Set<string>();
  const violations: string[] = [];
  const stack: Array<{ file: string; chain: string[] }> = [{ file: entry, chain: [] }];

  while (stack.length) {
    const { file, chain } = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const relPath = rel(file);
    const nextChain = [...chain, relPath];
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
      if (FORBIDDEN_SRC.some((re) => re.test(rel(resolved)))) {
        violations.push(`${nextChain.join(' -> ')} -> ${rel(resolved)}`);
        continue;
      }
      stack.push({ file: resolved, chain: nextChain });
    }
  }
  return violations;
}

describe('Hub live islands client bundle', () => {
  it.each(ENTRIES.map((file) => [rel(file), file]))('%s never imports Prisma, the database layer or Node built-ins', (_name, file) => {
    expect(collectViolations(file)).toEqual([]);
  });
});
