#!/usr/bin/env node
/**
 * KERSIVO Insights — deterministic editorial compositor v1.
 *
 * Input: a verbatim, manually exported ARTICLE DRAFT from the authorised Notion record
 * plus a reviewed visual manifest. Output: readable Markdown + labelled illustrations.
 * Never edits the raw Notion export or factual article copy. No network, AI, or publishing.
 *
 * Usage:
 *   node scripts/insights/compose-article.mjs editorial-staging/insights/NAME.visuals.json
 *   node scripts/insights/compose-article.mjs editorial-staging/insights/NAME.visuals.json --check
 *
 * The production release gate is always separate from composition/review.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { applyInsightsLinkOverlays } from './link-overlays.mjs';

const root = process.cwd();
const fail = (message) => { throw new Error(`Insights compositor: ${message}`); };
const [manifestPath, ...flags] = process.argv.slice(2);
if (!manifestPath || flags.some((flag) => flag !== '--check')) {
  fail('usage: node scripts/insights/compose-article.mjs path/to/visuals.json [--check]');
}
const manifest = JSON.parse(readFileSync(path.resolve(root, manifestPath), 'utf8'));
const requiredString = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) fail(`missing ${label}`);
  return value;
};
function safeLocal(relativePath, kind) {
  requiredString(relativePath, kind);
  const absolute = path.resolve(root, relativePath);
  if (!absolute.startsWith(root + path.sep)) fail(`${kind} must be inside repository`);
  return absolute;
}
const sourcePath = safeLocal(manifest.source, 'source');
const outputPath = safeLocal(manifest.output, 'output');
if (sourcePath === outputPath) fail('cannot overwrite the Notion source');
if (manifest.version !== 1) fail('expected manifest version 1');
if (manifest.publishApproved === true) {
  const approval = manifest.publicationApproval;
  if (approval?.approvedBy !== 'owner' || !/^\d{4}-\d{2}-\d{2}$/.test(approval.approvedOn ?? '') ||
      approval.recordUrl !== manifest.notionUrl) {
    fail('publication needs explicit owner approval date and matching Notion record');
  }
}
requiredString(manifest.notionUrl, 'Notion URL');
if (!manifest.notionUrl.startsWith('https://app.notion.com/')) fail('invalid Notion reference');
const source = readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n').trim();
if (!source.startsWith('# ')) fail('expected public article to start with the Notion H1');
if (!Array.isArray(manifest.media) || !manifest.media.length) fail('at least one licensed/attributed visual is required');

function convertNotionTable(fragment) {
  const rawRows = [...fragment.matchAll(/<tr>\s*([\s\S]*?)\s*<\/tr>/g)];
  if (rawRows.length < 2) fail('Notion table has no data rows');
  const rows = rawRows.map((row) => [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((cell) => cell[1].trim()));
  const columns = rows[0].length;
  if (!columns || rows.some((row) => row.length !== columns)) fail('Notion table column mismatch');
  const escapeCell = (v) => v.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [rows[0], rows[0].map(() => '---'), ...rows.slice(1)]
    .map((row) => `| ${row.map(escapeCell).join(' | ')} |`).join('\n');
}
// Structural heading normalize for HTML outline only — wording unchanged.
// Notion ARTICLE DRAFT exports often use H4 for primary sections; public HTML needs H1 → H2.
const normalizedSource = source
  .replace(/<table header-row="true">([\s\S]*?)<\/table>/g, (_match, inner) => convertNotionTable(inner))
  .replace(/^#### /gm, '## ');

function getType(line) {
  if (/^\|/.test(line)) return 'table';
  if (/^(?:[-*] |\d+\. )/.test(line)) return 'list';
  if (/^#{1,6} /.test(line)) return 'heading';
  return 'paragraph';
}
function toBlocks(markdown) {
  const blocks = [];
  let current = [], lastType = '';
  const flush = () => {
    if (current.length) blocks.push({ type: lastType, markdown: current.join('\n') });
    current = []; lastType = '';
  };
  for (const line of markdown.split('\n')) {
    if (!line.trim()) { flush(); continue; }
    const type = getType(line);
    if (lastType && (type !== lastType || (type !== 'table' && type !== 'list'))) flush();
    current.push(line);
    lastType = type;
  }
  flush();
  return blocks;
}
const blocks = toBlocks(normalizedSource);
const wordCount = source.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length;
const supportNeeded = wordCount <= 1200 ? 1 : wordCount <= 2200 ? 2 : 3;
const media = manifest.media;
if (media.filter((item) => item.kind === 'hero').length !== 1) fail('exactly one hero visual is required');
if (media.filter((item) => item.kind !== 'hero').length < supportNeeded) fail(`missing supporting visuals (need at least ${supportNeeded})`);
if (!blocks.some((block) => block.type === 'table') && !media.some((item) => item.kind === 'diagram')) {
  fail('a table or informative, source-backed diagram is required');
}
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function figure(item) {
  requiredString(item.anchor, 'visual anchor');
  requiredString(item.alt, 'visual alt');
  requiredString(item.caption, 'visual caption');
  requiredString(item.src, 'visual source');
  requiredString(item.rights, 'copyright/usage evidence');
  if (!['hero', 'breakout', 'inline', 'diagram', 'photo'].includes(item.kind)) fail('unknown visual kind');
  if (item.licenceReviewed !== true) fail(`visual rights were not reviewed: ${item.src}`);
  if (!item.src.startsWith('https://') && !item.src.startsWith('/images/insights/')) fail('unsupported image location');
  const cls = `insights-figure insights-figure--${item.kind}`;
  const width = Number(item.width), height = Number(item.height);
  if (!(width >= 600 && width <= 6000 && height >= 300 && height <= 6000)) fail('invalid visual dimensions');
  return `<figure class="${cls}"><img src="${escapeHtml(item.src)}" width="${width}" height="${height}" loading="${item.kind === 'hero' ? 'eager' : 'lazy'}" decoding="async" alt="${escapeHtml(item.alt)}" />\n<figcaption>${escapeHtml(item.caption)}${item.creditUrl ? ` — <a href="${escapeHtml(item.creditUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.credit || 'Source')}</a>` : ''}.</figcaption></figure>`;
}
// Optional links to KERSIVO tools, placed after an anchored block (after any figure on that block).
// Like figures, they are stripped before the text-fidelity check, so article copy stays verbatim.
const toolLinks = Array.isArray(manifest.toolLinks) ? manifest.toolLinks : [];
function toolLink(item) {
  requiredString(item.anchor, 'tool link anchor');
  requiredString(item.text, 'tool link text');
  requiredString(item.label, 'tool link label');
  if (!/^\/[a-z0-9-]+$/.test(requiredString(item.href, 'tool link href'))) fail('tool links must point to a KERSIVO page path');
  return `<aside class="insights-tool-link"><p>${escapeHtml(item.text)} <a href="${escapeHtml(item.href)}">${escapeHtml(item.label)} →</a></p></aside>`;
}
const seenTools = new Set();
const seen = new Set();
const result = [];
for (const block of blocks) {
  result.push(block.markdown);
  for (const [i, asset] of media.entries()) {
    if (seen.has(i)) continue;
    if (asset.anchor === block.markdown || block.markdown.startsWith(asset.anchor)) {
      if (asset.anchor.length < 24) fail('visual anchor too short to identify an article section reliably');
      seen.add(i);
      result.push(figure(asset));
    }
  }
  for (const [i, item] of toolLinks.entries()) {
    if (seenTools.has(i) || !block.markdown.startsWith(item.anchor)) continue;
    if (item.anchor.length < 24) fail('tool link anchor too short to identify an article section reliably');
    seenTools.add(i);
    result.push(toolLink(item));
  }
}
if (seenTools.size !== toolLinks.length) {
  fail(`tool link anchors missing: ${toolLinks.filter((_, index) => !seenTools.has(index)).map((a) => a.anchor).join(' | ')}`);
}
if (seen.size !== media.length) {
  fail(`visual anchors missing or ambiguous: ${media.filter((_, index) => !seen.has(index)).map((a) => a.anchor).join(' | ')}`);
}
const renderedWithFigures = result.join('\n\n') + '\n';
const canonical = blocks.map((block) => block.markdown).join('\n\n');
const stripFigures = (html) =>
  html.replace(/<figure class="insights-figure[^]*?<\/figure>/g, '').replace(/<aside class="insights-tool-link">[^]*?<\/aside>/g, '');
if (stripFigures(renderedWithFigures).trim().replace(/\n{3,}/g, '\n\n') !== canonical.trim()) {
  fail('article text changed during visual insertion');
}
const slug = path.basename(manifest.output).replace(/-display\.md$/, '');
const rendered = applyInsightsLinkOverlays(renderedWithFigures, slug);
if (flags.includes('--check')) {
  if (readFileSync(outputPath, 'utf8') !== rendered) fail('generated article differs from checked-in output');
  console.log('PASS: article render is deterministic and source text is preserved.');
} else {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, rendered, 'utf8');
  console.log(`WROTE ${manifest.output}`);
}
const digest = createHash('sha256').update(source).digest('hex');
console.log(JSON.stringify({ originalSourceSha256: digest, blocks: blocks.length, media: seen.size, wordCount, publishApproved: manifest.publishApproved === true }));
