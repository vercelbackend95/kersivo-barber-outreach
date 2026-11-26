/**
 * GEO/AEO stage 4: every page we ask search and AI engines to index may be quoted in full,
 * and nothing in robots.txt, vercel.json or the markup quietly takes that back.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_SEARCH_CRAWLERS, GET as getRobots } from '../../pages/robots.txt';
import { MARKETING_SITEMAP_ENTRIES } from './marketingSitemap';
import { INDEXABLE_ROBOTS_CONTENT, resolvePageSeo, resolveRobotsContent } from './meta';

const ROOT = process.cwd();

/**
 * `data-nosnippet` is allowed only on wrappers around demo widgets: their placeholder names,
 * prices and times must never be quoted as facts about KERSIVO or a real shop.
 */
const DATA_NOSNIPPET_ALLOWED = new Set([
  'src/components/landing/DeferredWidget.tsx',
  'src/components/barbershop-online-booking/BobLiveTimelineIsland.tsx',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function publicSourceFiles(): string[] {
  return [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'editorial-staging', 'insights'))]
    .filter((file) => /\.(astro|tsx?|mdx?|html)$/.test(file))
    .filter((file) => !/\.test\.tsx?$/.test(file))
    .map((file) => relative(ROOT, file).split(sep).join('/'));
}

type RobotsGroup = { agents: string[]; disallow: string[] };

function parseRobots(body: string): RobotsGroup[] {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.some((line) => line.startsWith('User-agent:')))
    .map((lines) => ({
      agents: lines.filter((l) => l.startsWith('User-agent:')).map((l) => l.slice('User-agent:'.length).trim()),
      disallow: lines.filter((l) => l.startsWith('Disallow:')).map((l) => l.slice('Disallow:'.length).trim()),
    }));
}

/** robots.txt path match: prefix match, `*` = any run of characters, trailing `$` = end. */
function robotsRuleMatches(rule: string, path: string): boolean {
  if (!rule) return false;
  const anchored = rule.endsWith('$');
  const body = (anchored ? rule.slice(0, -1) : rule)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path);
}

/** vercel.json `source` (path-to-regexp subset used in this repo) as a full-path regex. */
function vercelSourceMatches(source: string, path: string): boolean {
  const pattern = source
    .replace(/:[a-zA-Z]+\*/g, '.*')
    .replace(/:[a-zA-Z]+/g, '[^/]+');
  return new RegExp(`^${pattern}$`).test(path);
}

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };
const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as { headers?: HeaderRule[] };
const robotsHeaderRules = (vercel.headers ?? []).flatMap((rule) =>
  rule.headers.filter((h) => h.key.toLowerCase() === 'x-robots-tag').map((h) => ({ source: rule.source, value: h.value })),
);

const sitemapPaths = MARKETING_SITEMAP_ENTRIES.map((entry) => entry.path);

describe('snippet eligibility (GEO/AEO stage 4)', () => {
  it('indexable pages state open snippet limits and nothing restrictive', () => {
    expect(INDEXABLE_ROBOTS_CONTENT).toBe('max-snippet:-1, max-image-preview:large, max-video-preview:-1');
    expect(resolveRobotsContent({})).toBe(INDEXABLE_ROBOTS_CONTENT);
    expect(resolvePageSeo({ canonicalPath: '/pricing' }).robotsContent).toBe(INDEXABLE_ROBOTS_CONTENT);
    expect(INDEXABLE_ROBOTS_CONTENT).not.toMatch(/noindex|nofollow|nosnippet|noimageindex|notranslate|unavailable_after/);
  });

  it('noindex pages keep their own directive', () => {
    expect(resolveRobotsContent({ noindex: true })).toBe('noindex, nofollow');
    expect(resolveRobotsContent({ noindex: true, robotsFollow: true })).toBe('noindex, follow');
  });

  it('SeoHead always renders the robots meta from resolvePageSeo', () => {
    const head = readFileSync(join(ROOT, 'src/components/seo/SeoHead.astro'), 'utf8');
    expect(head).toContain('<meta name="robots" content={seo.robotsContent} />');
  });

  it('no public source blocks snippets, except data-nosnippet on demo-widget wrappers', () => {
    const offenders: string[] = [];
    for (const file of publicSourceFiles()) {
      const source = readFileSync(join(ROOT, file), 'utf8');
      if (!/nosnippet/i.test(source)) continue;
      const withoutAllowed = DATA_NOSNIPPET_ALLOWED.has(file) ? source.replace(/\bdata-nosnippet\b/g, '') : source;
      if (/nosnippet/i.test(withoutAllowed)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
    for (const file of DATA_NOSNIPPET_ALLOWED) {
      expect(readFileSync(join(ROOT, file), 'utf8'), file).toContain('data-nosnippet');
    }
  });

  it('no X-Robots-Tag header limits snippets', () => {
    for (const rule of robotsHeaderRules) {
      expect(rule.value, rule.source).not.toMatch(/nosnippet|max-snippet:0|max-image-preview:none/i);
    }
  });

  it('no sitemap URL is caught by a noindex X-Robots-Tag header', () => {
    const noindexSources = robotsHeaderRules.filter((rule) => /noindex/i.test(rule.value)).map((rule) => rule.source);
    expect(noindexSources.length).toBeGreaterThan(0);
    const caught = sitemapPaths.flatMap((path) =>
      noindexSources.filter((source) => vercelSourceMatches(source, path)).map((source) => `${path} ← ${source}`),
    );
    expect(caught).toEqual([]);
  });

  it('sitemap paths are clean, unique canonical paths', () => {
    expect(new Set(sitemapPaths).size).toBe(sitemapPaths.length);
    for (const path of sitemapPaths) {
      expect(path, path).toMatch(/^\/[^?#]*$/);
      if (path !== '/') expect(path, path).not.toMatch(/\/$/);
      expect(resolvePageSeo({ canonicalPath: path }).canonical).toBe(`https://kersivo.co.uk${path}`);
    }
  });

  it('robots.txt lets every AI search crawler and * fetch every sitemap URL', async () => {
    const body = await (await getRobots({} as Parameters<typeof getRobots>[0])).text();
    const groups = parseRobots(body);
    const agents = [...AI_SEARCH_CRAWLERS, '*'];

    for (const agent of agents) {
      const group = groups.find((g) => g.agents.includes(agent));
      expect(group, agent).toBeDefined();
      expect(group!.disallow, agent).not.toContain('/');
      const blocked = sitemapPaths.filter((path) => group!.disallow.some((rule) => robotsRuleMatches(rule, path)));
      expect(blocked, agent).toEqual([]);
    }
  });

  it('the robots matcher itself catches a blocked path (guards against a vacuous pass)', () => {
    expect(robotsRuleMatches('/api/', '/api/x')).toBe(true);
    expect(robotsRuleMatches('/shop/*/success', '/shop/abc/success')).toBe(true);
    expect(robotsRuleMatches('/q/', '/pricing')).toBe(false);
    expect(vercelSourceMatches('/demo/(.*)', '/demo/heritage')).toBe(true);
    expect(vercelSourceMatches('/shop', '/starter')).toBe(false);
  });
});
