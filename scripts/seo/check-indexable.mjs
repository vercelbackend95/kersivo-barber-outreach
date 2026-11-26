#!/usr/bin/env node
/**
 * GEO/AEO stage 4 live check: every URL in /sitemap.xml returns 200, is indexable, allows full
 * snippets and points its canonical at itself on https://kersivo.co.uk.
 *
 *   node scripts/seo/check-indexable.mjs                       # production
 *   node scripts/seo/check-indexable.mjs https://<preview-url>  # a Vercel preview or local server
 *
 * Vercel adds `X-Robots-Tag: noindex` to every preview deployment, so the header check only fails
 * on the production host; elsewhere it is reported once as a note.
 */
const PRODUCTION = 'https://kersivo.co.uk';
const base = (process.argv[2] ?? PRODUCTION).replace(/\/$/, '');
const isProduction = base === PRODUCTION;

async function get(url) {
  const response = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'kersivo-indexable-check' } });
  return { status: response.status, headers: response.headers, body: await response.text() };
}

function metaContent(html, name) {
  const tags = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]*>`, 'gi')) ?? [];
  return tags.map((tag) => tag.match(/content=["']([^"']*)["']/i)?.[1] ?? '');
}

function canonicalHref(html) {
  const tags = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/gi) ?? [];
  return tags.map((tag) => tag.match(/href=["']([^"']*)["']/i)?.[1] ?? '');
}

const sitemap = await get(`${base}/sitemap.xml`);
if (sitemap.status !== 200) {
  console.error(`sitemap.xml returned ${sitemap.status}`);
  process.exit(1);
}
const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const failures = [];
let previewHeaderNoted = false;

for (const loc of locs) {
  const path = new URL(loc).pathname;
  const problems = [];
  if (!loc.startsWith(`${PRODUCTION}/`) && loc !== `${PRODUCTION}/`) problems.push(`sitemap loc is not on ${PRODUCTION}`);

  const page = await get(`${base}${path}`);
  if (page.status !== 200) problems.push(`status ${page.status}`);

  const header = page.headers.get('x-robots-tag') ?? '';
  if (/noindex|nosnippet/i.test(header)) {
    if (isProduction) problems.push(`X-Robots-Tag: ${header}`);
    else if (!previewHeaderNoted) {
      console.log(`note: ${base} sends "X-Robots-Tag: ${header}" (Vercel preview default); header check skipped`);
      previewHeaderNoted = true;
    }
  }

  const robots = metaContent(page.body, 'robots');
  if (robots.length !== 1) problems.push(`${robots.length} robots meta tags`);
  if (robots.some((value) => /noindex|nosnippet/i.test(value))) problems.push(`robots meta: ${robots.join(' | ')}`);
  if (!robots.some((value) => /max-snippet:-1/.test(value) && /max-image-preview:large/.test(value)))
    problems.push('robots meta lacks max-snippet:-1 / max-image-preview:large');

  const canonical = canonicalHref(page.body);
  if (canonical.length !== 1 || canonical[0] !== loc) problems.push(`canonical ${canonical.join(' | ') || '(none)'} ≠ ${loc}`);

  if (/\bnosnippet\b/i.test(page.body.replace(/\bdata-nosnippet\b/g, ''))) problems.push('nosnippet in markup');

  if (problems.length) failures.push({ path, problems });
  console.log(`${problems.length ? '✗' : '✓'} ${path}${problems.length ? ` — ${problems.join('; ')}` : ''}`);
}

console.log(`\n${locs.length - failures.length}/${locs.length} sitemap URLs pass on ${base}`);
if (failures.length) process.exit(1);
