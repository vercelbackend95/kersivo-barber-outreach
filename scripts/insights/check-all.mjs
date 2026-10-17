#!/usr/bin/env node
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const dir = path.join('editorial-staging', 'insights');
const manifests = readdirSync(dir).filter((name) => name.endsWith('.visuals.json')).sort();
if (!manifests.length) {
  console.error('FAIL: No Insights visual manifests were found.');
  process.exit(1);
}
let failed = 0;
for (const name of manifests) {
  console.log(`Checking Insights source and assets: ${name}`);
  const { status, error } = spawnSync(process.execPath, [
    'scripts/insights/compose-article.mjs', path.join(dir, name), '--check'
  ], { stdio: 'inherit', cwd: process.cwd() });
  if (status !== 0 || error) failed++;
}
if (failed) {
  console.error(`FAIL: ${failed} of ${manifests.length} articles did not pass reproducibility QA.`);
  process.exit(1);
}
console.log(`PASS: ${manifests.length} article(s) matched the canonical Notion source and media manifest.`);
