# KERSIVO Insights — Global Article Design & Production System v1.0

Status: **implemented for preview / not approved for production publication**. Scope: all future /insights articles. Editorial source of truth: the KERSIVO Insights Editorial Pipeline in Notion.

## 1. Non-negotiable source integrity

- Import the most recent clearly designated ARTICLE DRAFT version from the exact existing Notion editorial record. Do not import the research dossier, internal QA, old versions or prompts as public article body.
- Keep the published-facing words, headings, numbers, examples, tables, citations and references unchanged. Do not auto-rewrite, summarise, "improve", embellish or insert product claims.
- Reformat only structurally: separate paragraphs, headings, list markers and tables without losing words. Preserve the raw Markdown export immutably in `editorial-staging/insights/{slug}.md`.
- Create the display version separately at `editorial-staging/insights/{slug}-display.md` using `scripts/insights/compose-article.mjs`. Manifest: `{slug}.visuals.json`.
- Images, credit captions, decorative UI and accessible labels are distinct **presentation metadata**, not new article paragraphs. New factual claims or source edits require a separate editorial review in Notion.
- Only the owner approves the final article and publication. A writing-approved record or a Vercel Preview is not permission to publish. Preview must remain `noindex`; production sitemap/navigation linking remains out of scope until a separate release approval.

## 2. Universal responsive layout

Single source of truth: `src/styles/components/insights-preview.css` and `src/layouts/InsightsArticleLayout.astro` plus `InsightsMasthead.astro`.

- Desktop shell: maximum 1520 px, with a consistent responsive outer gutter of 20–76 px. All masthead, text, photos, diagrams, tables and footer editorial material have a **shared LEFT EDGE**. Do not centre the article inside a narrow 750 px column.
- Reading copy: maximum 800 px; long enough to use the canvas but still legible.
- H1: maximum 1080 px, fluid 50–90 px on desktop. Use one H1 supplied by Notion.
- Hero photo: maximum 1210 px; 16:9 crop on desktop, 1.45 crop on mobile. Keep the subject visible and verify the source image suits cropping.
- Breakout diagrams, structured illustrations, tables and section photographs: maximum 1100 px. Inline small media: maximum 890 px. Respect true image proportions for SVG diagrams; do not crop data.
- Mobile: gutters 19 px; do not overflow the viewport, hide text, or shrink body type until unreadable. Use responsive image dimensions and accessible labels.
- Body: approximately 18–20 px, line height ~1.79; intro ~21–26 px. Section headers use a consistent top rule and restrained red accent, not separate arbitrary visual styles.

## 3. Universal comparison-table system

Shared enhancer: `src/components/insights/InsightsDataTables.astro`.

- Table data must stay exactly as written in Notion (including caveats and legal distinctions). Do not compress lengthy legal conditions into green/red verdicts.
- Render true `thead`, `tbody`, `th` and `td`, never a flattened image of a data table.
- Dark table header; generous 1.1–1.4 rem cell padding; highlighted first column; restrained alternating light rows; thin dividers.
- Only visually classify cells when their **existing wording** clearly signals Allowed / Banned / Not allowed / Risky; style via subtle inset stripe without changing text.
- On mobile, provide a keyboard-focusable, labelled horizontal-scroll region; do not widen or horizontally scroll the whole document.
- Table retains source entries at full length; scrolling is preferable to truncation.

## 4. Media types and quality gates

Allowed placements: `hero`, `photo`, `diagram`, `breakout`, `inline`. Use actual place-appropriate UK editorial photography when possible, or original source-backed diagrams when more useful. Assets are not decorative filler.

Every asset in the manifest must have:
- Exact source URL or local verified file, natural dimensions, useful descriptive alt text and editorial caption.
- Rights/creator/attribution information; a reviewed licence/permission flag. Preview use does not imply publishing clearance, especially for externally hosted images. Reverify the final licence and file availability before release.
- A unique anchor matching a specific paragraph or heading from the verbatim Notion article. Missing anchors fail generation: never silently substitute an unrelated image.

Minimum visual QA relative to source body length:
- Up to 1,200 words: one hero + one supporting visual.
- 1,201–2,200 words: one hero + two supporting visuals.
- Above 2,200 words: one hero + three supporting visuals.
- Every article must also contain a real structured comparison table or source-supported diagram. If justified assets cannot be obtained, **block the article for asset review** rather than inventing or padding.

Use hero after H1, and insert later diagrams beside the relevant numerical example, comparison or process. Vary pacing; do not repeat the same image or add multiple near-duplicate photos.

## 5. Automated preparation, NOT automated publication

`node scripts/insights/compose-article.mjs editorial-staging/insights/{slug}.visuals.json`

1. Retrieve the exact authorised Notion record, review date and draft version; store immutable raw export and metadata.
2. Confirm status, QA, legal holds and owner approvals; stop on Hold or missing authority.
3. Normalise paragraph blocks, lists and Notion HTML table to semantic Markdown without changing source wording.
4. Attach only reviewed visual-manifest assets at verified anchors, with credit and licence metadata.
5. Check completeness, H1, visuals, structured blocks and text fidelity.
6. Render preview with shared layout, build, inspect at desktop and mobile, test images and tables.
7. Require owner approval for publication. Only a separate release operation may update URL, canonical, schema, sitemap or Notion Published status.

Run `npm run insights:check` before every build. The package build hook runs this automatically. It fails on stale generated output, missing manifests, lost source text or inadequate visual inventory; **passing the build does not constitute browser or licensing QA**.

## 6. Release checklist (manual, required)

- Content: full Notion text + citations present, same latest draft version, no added claims.
- Verification: business/legal/pricing claims rechecked against original sources where relevant (without silent rewriting).
- Images: load on the actual preview, crop and legibility approved; asset licence/permission and attribution verified; no fake customers.
- Design: mobile 375 px, tablet ~768 px and desktop ~1440–1920 px; no overflow, all paragraphs readable, no empty media, comparative tables horizontally accessible.
- Tech: build/QA succeeds, exact metadata, index/noindex correct, canonical and schema only when approved, links work.
- Governance: owner final approval, explicit publication instruction, then deploy main and update Notion only after verified live publication.

This document replaces ad-hoc per-article layout tweaks. Improvements must be made in shared components / stylesheet and tested against at least one table-heavy and one text-heavy article.
