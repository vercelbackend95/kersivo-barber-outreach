/**
 * Export the fictional fixture shop's SiteData to docs/site-data/fixture.json (template mode,
 * local work). Fictional data only.
 *
 *   npx tsx scripts/site-data/export-fixture.ts
 *
 * src/lib/siteData/fixtureExport.test.ts fails when the committed file is out of date.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSiteData } from '../../src/lib/siteData/build';
import { PUBLISHED_FIXTURE_PATH, publishedFixtureJson } from '../../src/lib/siteData/fixtures';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const target = join(root, PUBLISHED_FIXTURE_PATH);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, publishedFixtureJson(buildSiteData), 'utf8');
console.log(`wrote ${PUBLISHED_FIXTURE_PATH}`);
