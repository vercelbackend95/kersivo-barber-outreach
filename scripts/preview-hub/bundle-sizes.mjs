/**
 * Report Shop Hub island source sizes and, when a build exists, matching client chunks.
 *
 *   node scripts/preview-hub/bundle-sizes.mjs
 */
import { gzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'docs/preview-hub/screens/batch-6');
mkdirSync(outDir, { recursive: true });

const islands = [
  'src/components/previewHub/HubUploader.tsx',
  'src/components/previewHub/HubYourShop.tsx',
  'src/components/previewHub/HubWebsiteView.tsx',
  'src/components/previewHub/HubReviewCards.tsx',
  'src/components/previewHub/HubChanges.tsx',
  'src/components/previewHub/HubMessages.tsx',
  'src/components/previewHub/HubLaunchChecklist.tsx',
  'src/components/freePreview/PreviewTopBar.tsx',
];

function kb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
}

const source = islands.map((rel) => {
  const buf = readFileSync(join(root, rel));
  return {
    island: rel.replace('src/components/', ''),
    sourceBytes: buf.length,
    sourceKb: kb(buf.length),
    gzipKb: kb(gzipSync(buf).length),
  };
});

const chunkDirs = ['dist/client/_astro', 'dist/_astro', '.vercel/output/static/_astro'];
let chunks = [];
for (const dir of chunkDirs) {
  const abs = join(root, dir);
  if (!existsSync(abs)) continue;
  const files = readdirSync(abs).filter((name) => name.endsWith('.js'));
  chunks = files
    .filter((name) => /Hub|PreviewTopBar|preview-hub|previewHub/i.test(name))
    .map((name) => {
      const buf = readFileSync(join(abs, name));
      return {
        file: `${dir}/${name}`,
        bytes: buf.length,
        kb: kb(buf.length),
        gzipKb: kb(gzipSync(buf).length),
      };
    });
  if (chunks.length) break;
}

const report = {
  islands: source,
  sourceTotalGzipKb: Math.round(source.reduce((sum, row) => sum + row.gzipKb, 0) * 10) / 10,
  buildChunks: chunks,
  buildPresent: chunks.length > 0,
  note: chunks.length
    ? 'Matching client chunks from the last build.'
    : 'No hub-named client chunks found. Run npm run build, then re-run this script for gzipped island chunks.',
};

writeFileSync(join(outDir, 'hub-island-bundle-sizes.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
