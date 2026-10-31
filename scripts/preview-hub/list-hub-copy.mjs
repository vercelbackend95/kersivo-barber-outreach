/**
 * Dump every exported string from hubCopy.ts for founder review.
 *
 *   node scripts/preview-hub/list-hub-copy.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = readFileSync(join(root, 'src/lib/freePreview/hubCopy.ts'), 'utf8');
const rows = [];

function add(name, value) {
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  if (!cleaned) return;
  rows.push({ name, value: cleaned });
}

for (const match of source.matchAll(/export const ([A-Z0-9_]+) = `([\s\S]*?)`;/g)) {
  add(match[1], match[2]);
}
for (const match of source.matchAll(/export const ([A-Z0-9_]+) = '([^']*)';/g)) {
  add(match[1], match[2]);
}
for (const match of source.matchAll(/export const ([A-Z0-9_]+) = "([^"]*)";/g)) {
  add(match[1], match[2]);
}
for (const match of source.matchAll(/export const ([A-Z0-9_]+) = \([^)]*\) =>\s*`([\s\S]*?)`;/g)) {
  add(match[1], match[2]);
}
for (const match of source.matchAll(/export const ([A-Z0-9_]+) = \([^)]*\) =>\s*\n\s*`([\s\S]*?)`;/g)) {
  add(match[1], match[2]);
}

for (const match of source.matchAll(/export const ([A-Z0-9_]+) = \{([\s\S]*?)\n\} as const;/g)) {
  const name = match[1];
  const body = match[2];
  for (const inner of body.matchAll(/([A-Za-z0-9_]+):\s*'([^']*)'/g)) add(`${name}.${inner[1]}`, inner[2]);
  for (const inner of body.matchAll(/([A-Za-z0-9_]+):\s*"([^"]*)"/g)) add(`${name}.${inner[1]}`, inner[2]);
  for (const inner of body.matchAll(/([A-Za-z0-9_]+):\s*`([^`]*)`/g)) add(`${name}.${inner[1]}`, inner[2]);
  for (const inner of body.matchAll(
    /([A-Za-z0-9_]+):\s*\{\s*h1:\s*(?:'([^']*)'|"([^"]*)"),\s*sub:\s*(?:'([^']*)'|"([^"]*)")/g,
  )) {
    add(`${name}.${inner[1]}.h1`, inner[2] || inner[3]);
    add(`${name}.${inner[1]}.sub`, inner[4] || inner[5]);
  }
  for (const inner of body.matchAll(
    /([A-Za-z0-9_]+):\s*\{\s*doing:\s*(?:'([^']*)'|"([^"]*)"),\s*need:\s*([A-Z0-9_]+|'[^']*'|"[^"]*")/g,
  )) {
    add(`${name}.${inner[1]}.doing`, inner[2] || inner[3]);
    add(`${name}.${inner[1]}.need`, inner[4].replace(/^['"]|['"]$/g, ''));
  }
}

for (const match of source.matchAll(/([A-Z0-9_]+):\s*'([^']*)'/g)) {
  if (['CREATED', 'DETAILS_UPDATED', 'MARKED_READY'].includes(match[1]) || match[1].startsWith('hub_') || match[1].startsWith('ops_')) {
    add(`HUB_ACTIVITY_LABELS.${match[1]}`, match[2]);
  }
}

const unique = [];
const seen = new Set();
for (const row of rows) {
  const key = `${row.name}|${row.value}`;
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push(row);
}

const md = [
  '# Shop Hub copy inventory (`src/lib/freePreview/hubCopy.ts`)',
  '',
  'British English. Founder review list for Batch 6. `${…}` marks a substituted value.',
  '',
  '| Key | String |',
  '|---|---|',
  ...unique.map((row) => `| \`${row.name}\` | ${row.value.replaceAll('|', '\\|')} |`),
  '',
  `${unique.length} strings.`,
  '',
].join('\n');

const outDir = join(root, 'docs/preview-hub/reports');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'HUB_COPY_INVENTORY.md'), md);
console.log(`wrote ${unique.length} strings`);
