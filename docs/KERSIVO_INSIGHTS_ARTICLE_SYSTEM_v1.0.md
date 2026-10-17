# KERSIVO Insights — Global Article Design & Production System v1.0

Status: **first owner-approved article released to production on 17 October 2026**. Scope: all future /insights articles. Editorial source of truth: the KERSIVO Insights Editorial Pipeline in Notion.

## 1. Non-negotiable source integrity

- Import the most recent clearly designated ARTICLE DRAFT version from the exact existing Notion editorial record. Do not import the research dossier, internal QA, old versions or prompts as public article body.
- Keep the published-facing words, headings, numbers, examples, tables, citations and references unchanged. Do not auto-rewrite, summarise, "improve", embellish or insert product claims.
- Reformat only structurally: separate paragraphs, headings, list markers and tables without losing words. Preserve the raw Markdown export immutably in `editorial-staging/insights/{slug}.md`.
- Create the display version separately at `editorial-staging/insights/{slug}-display.md` using `scripts/insights/compose-article.mjs`. Manifest: `{slug}.visuals.json`.
- Images, credit captions, decorative UI and accessible labels are distinct **presentation metadata**, not new article paragraphs. New factual claims or source edits require a separate editorial review in Notion.
- Only the owner approves the final article and publication. A writing-approved record or a Vercel Preview is not permission to publish. Every future article needs its own explicit release approval. Preview stays `noindex`; only owner-approved live articles belong in sitemap, JSON-LD and navigation.

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

**Photo policy:** do not replace genuinely relevant photography with only SVGs out of generalized licensing caution. Use varied, authentic editorial photography wherever it adds atmosphere or evidence, alongside accurate original diagrams. Before incorporation, verify the original creator's exact licensed asset page, commercial-use permission, creator credit, description, and possible model/property/trademark rights. Prefer generic close-up objects and spaces when third-party releases are uncertain; avoid depicting someone as a KERSIVO user or owner without proof. Never assert that a stock-image copyright licence alone guarantees every third-party right. Keep licence/attribution URLs in each article manifest and captions.

**UK-first visual sourcing (owner direction, 17 October 2026):** KERSIVO serves independent barbers in the UK, so its editorial photographs should feel credibly rooted in British barbering and the UK high street. For photos implying a particular barber shop, city or market, prefer **source-confirmed UK location** (photo listing, photographer's description, venue permission, or trustworthy geotags). Do not infer geography from a subject's nationality, skin colour, ethnicity or facial appearance. Non-geographic macro shots of barber tools, craft, hair, hands or close-up services are acceptable when they serve the story; avoid claiming a foreign shop is a UK shop.

- Search a **broad licensed pool**, not Unsplash only: independent UK photographers and barbershops who give explicit reuse permission, Pexels, Unsplash, Wikimedia Commons (verify each individual file's CC BY / CC BY-SA / CC0 terms), and approved paid stock libraries when a valid commercial licence has actually been purchased. Do not treat a photo embedded on a random UK barber's website, Instagram, Treatwell, Fresha, Google or news site as free to reuse.
- Rank photos by (1) editorial relevance and UK authenticity, (2) copyright and third-party rights, (3) genuine premium composition and sensible mobile crops, (4) diversity of photographic subject matter across articles. Prefer authentic shop floors, high street windows, shopkeepers at work and everyday local craft over repeatedly staged generic stock portraits.
- Manifest must document **provider, creator, original photo page, verified location or "location unverified"**, licence and attribution obligations, subject/property caveats and image file URL. Distinguish the source-confirmed photo origin from aesthetic inference. If external image URLs cannot be independently loaded in tooling, record that limitation and require browser confirmation before the production release.
- Do not claim photographs depict KERSIVO customers, partners or testimonials without actual evidence and permission. For identifiable people, assess endorsement, privacy, publicity and relevant model/property-release issues, especially in conversion-focused promotions. Public editorial placement is not equivalent to permission to imply a business endorsement.
- **The photo-quality bar is not a nationality/ethnicity test.** Modern UK barbering is diverse, and editorial photos should reflect its genuine range of shops, communities and customers.

**Graphic QA:** render and inspect every hero and diagram at desktop and mobile sizes before publication. No text/image overlap, text escaping the SVG viewBox, illegible headings, or visual infographic crowding. Illustrations must remain legible at the size shown in the actual article. Ensure the media caption generator does not produce double full stops.

Use hero after H1, and insert later diagrams beside the relevant numerical example, comparison or process. Vary pacing; do not repeat the same image or add multiple near-duplicate photos.

## 5. Automated preparation, NOT automated publication

`node scripts/insights/compose-article.mjs editorial-staging/insights/{slug}.visuals.json`

1. Retrieve the exact authorised Notion record, review date and draft version; store immutable raw export and metadata.
2. Confirm status, QA, legal holds and owner approvals; stop on Hold or missing authority.
3. Normalise paragraph blocks, lists and Notion HTML table to semantic Markdown without changing source wording.
4. Attach only reviewed visual-manifest assets at verified anchors, with credit and licence metadata.
5. Check completeness, H1, visuals, structured blocks and text fidelity.
6. Render preview with shared layout, build, inspect at desktop and mobile, test images and tables.
7. Require owner approval for publication. Only a separate, explicit owner-approved release operation may update URL, canonical, schema, sitemap or Notion Published status.

Run `npm run insights:check` before every build. The package build hook runs this automatically. It fails on stale generated output, missing manifests, lost source text or inadequate visual inventory; **passing the build does not constitute browser or licensing QA**.

## 6. Release checklist (manual, required)

- Content: full Notion text + citations present, same latest draft version, no added claims.
- Verification: business/legal/pricing claims rechecked against original sources where relevant (without silent rewriting).
- Images: load on the actual preview, crop and legibility approved; asset licence/permission and attribution verified; no fake customers.
- Design: mobile 375 px, tablet ~768 px and desktop ~1440–1920 px; no overflow, all paragraphs readable, no empty media, comparative tables horizontally accessible.
- Tech: build/QA succeeds, exact metadata, index/noindex correct, canonical and schema only when approved, links work.
- Governance: owner final approval, explicit publication instruction, then deploy main and update Notion only after verified live publication.

This document replaces ad-hoc per-article layout tweaks. Improvements must be made in shared components / stylesheet and tested against at least one table-heavy and one text-heavy article.

## 7. Release v1 (17 October 2026)

- Public hub: `/insights`, with CollectionPage / BreadcrumbList JSON-LD.
- First live article: `/insights/google-reviews-barbershop-uk-rules`, with Article / BreadcrumbList JSON-LD.
- Canonical title, description, source slug and copy are imported from the approved Notion editorial record. The article is not rewritten at deployment.
- Top-level navigation uses the latest production Websites-aware navbar: Insights follows Compare on desktop and mobile; FAQ remains available under Resources.
- Publication authorization: explicit owner message on 17 October 2026; the source record must be updated only AFTER the live page is verified. Automatic publishing is NOT active.
- Prebuild editorial source-integrity checks remain mandatory for future article additions.
- Deployment of new posts remains review- and owner-approval-gated; automatic article composition is not automatic live publication.
