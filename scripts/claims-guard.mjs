/**
 * Fails the build when public marketing copy uses banned commercial claims.
 * No dependencies. Run: node scripts/claims-guard.mjs [--root <dir>]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCAN_DIRS = [
  'src/pages',
  'src/components',
  'src/layouts',
  'src/lib/seo',
  'src/lib/pricing',
  'src/lib/compare',
  'src/lib/landing',
  'src/lib/nav',
  'src/content',
];

const EXTENSIONS = new Set(['.astro', '.ts', '.tsx', '.js', '.mjs', '.md', '.mdx']);

/** Regex sources. Keep these identical to scripts/claims-guard.allow.json `pattern` values. */
export const CLAIM_PATTERNS = [
  String.raw`live kersivo assistant`,
  String.raw`zero (kersivo )?commission`,
  String.raw`about two weeks`,
  String.raw`in two weeks`,
  String.raw`free forever`,
  String.raw`£39 forever`,
  String.raw`no fees whatsoever`,
  String.raw`unlimited sms`,
  String.raw`email and sms confirmations`,
  String.raw`sms confirmation`,
  String.raw`99\.9`,
  String.raw`\buptime\b`,
  String.raw`white[- ]label`,
  String.raw`remove (the )?powered by`,
  String.raw`all your data`,
  String.raw`in one click|one-click export`,
  String.raw`you own the code`,
  String.raw`requested through support, not downloaded`,
];

const EXCLUDED_PREFIXES = [
  'src/pages/api/',
  'src/pages/admin/',
  'src/pages/ops/',
  'src/components/admin/',
  'src/components/ops/',
  'src/lib/admin/',
  'src/lib/email/',
];

const EXCLUDED_FILES = new Set([
  'src/pages/terms.astro',
  'src/pages/dpa.astro',
  'src/pages/privacy.astro',
  'src/pages/cookies.astro',
]);

function normalise(value) {
  return value.replaceAll('\\', '/');
}

export function isClaimsExcluded(relPath) {
  const rel = normalise(relPath);
  if (/(^|\/)[^/]*\.test\./.test(rel)) return true;
  if (EXCLUDED_FILES.has(rel)) return true;
  return EXCLUDED_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

function loadAllowlist(root) {
  const file = path.join(root, 'scripts', 'claims-guard.allow.json');
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) {
    throw new Error('scripts/claims-guard.allow.json must be an array');
  }
  for (const entry of data) {
    if (!entry || typeof entry.file !== 'string' || typeof entry.pattern !== 'string' || typeof entry.reason !== 'string' || !entry.reason.trim()) {
      throw new Error('Each allowlist entry needs file, pattern and reason');
    }
    if (!CLAIM_PATTERNS.includes(entry.pattern)) {
      throw new Error(`Allowlist pattern is not a guarded phrase: ${entry.pattern}`);
    }
  }
  return data.map((entry) => ({
    file: normalise(entry.file),
    pattern: entry.pattern,
    reason: entry.reason,
  }));
}

function walk(dir, root, files) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(full, root, files);
      continue;
    }
    if (!entry.isFile() || !EXTENSIONS.has(path.extname(entry.name))) continue;
    const rel = normalise(path.relative(root, full));
    if (!isClaimsExcluded(rel)) files.push({ full, rel });
  }
}

export function scanClaims(root) {
  const allow = loadAllowlist(root);
  const files = [];
  for (const dir of SCAN_DIRS) walk(path.join(root, dir), root, files);

  const hits = [];
  for (const file of files) {
    const lines = readFileSync(file.full, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const source of CLAIM_PATTERNS) {
        const match = line.match(new RegExp(source, 'i'));
        if (!match) continue;
        if (allow.some((entry) => entry.file === file.rel && entry.pattern === source)) continue;
        hits.push(`${file.rel}:${index + 1}: ${match[0]}`);
      }
    });
  }
  return hits;
}

function parseRoot(argv) {
  const flag = argv.indexOf('--root');
  if (flag === -1) return process.cwd();
  const value = argv[flag + 1];
  if (!value) throw new Error('--root requires a directory');
  return path.resolve(value);
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invoked === fileURLToPath(import.meta.url)) {
  const hits = scanClaims(parseRoot(process.argv.slice(2)));
  if (hits.length) {
    for (const hit of hits) console.error(hit);
    console.error(`claims-guard: ${hits.length} banned claim(s)`);
    process.exit(1);
  }
  console.log('claims-guard: pass');
}
