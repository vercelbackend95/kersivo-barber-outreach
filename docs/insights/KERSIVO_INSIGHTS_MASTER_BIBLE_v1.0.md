# KERSIVO INSIGHTS
## MASTER BIBLE — Design, UX, Architecture, SEO & Build Governance · v1.0

**Document status:** STRATEGIC MASTER / APPROVED DIRECTION PROPOSED — design requires owner sign-off before implementation; technical claims require active-branch verification.  
**Prepared:** 15 October 2026  
**Market:** United Kingdom only  
**Customer-facing language:** English (UK)  
**Internal planning language:** Polish  
**Product brand:** KERSIVO  
**Editorial brand:** **KERSIVO / INSIGHTS** (working name and proposed information architecture)  
**Proposed index route:** `https://kersivo.co.uk/insights`  
**Current phase:** **BUILD THE EDITORIAL PLATFORM FIRST. Owner supplies articles later.**  
**Owner:** KERSIVO founder  
**Intent:** This document is the source of truth for designing, implementing, reviewing and launching KERSIVO Insights. It is not permission to publish, merge or rewrite other marketing pages.

> **NORTH STAR:** Build the sharpest, most useful independent-barbershop editorial experience we can sustain — a premium KERSIVO publication that increases topical authority and trust without resembling a generic SaaS blog.
>
> **DESIGN MANDATE:** Razor-sharp hierarchy. Unmistakable brand. Editorial restraint. Fast and frictionless reading. No visual theatre for its own sake.
>
> **OPERATING MANDATE:** The owner provides editorial articles. First deliver a production-quality publishing system and verified page designs; do not invent articles to fill it.

---

# 0. READ FIRST — authority, scope and decisions

## 0.1 Authority and source-of-truth order

Use this order whenever future instructions or assumptions conflict:

1. **Actual verified active GitHub branch, current rendered preview and deployed production behaviour** — truth about implementation and existing design. The `main` branch inspected for this specification may lag the active design branch.
2. **KERSIVO Commercial Offer v1.0.pdf** — governing commercial terms for Full KERSIVO.
3. **KERSIVO_Starter_QR_Product_Spec_v1.19.md** — approved Starter product direction and relevant entitlement rules; do not silently override conflicting Full commercial terms.
4. **Existing page-specific KERSIVO master specifications** (barbershop websites, website design, online booking, alternatives etc.) — editorial/SEO intent boundaries and rules for those pages.
5. **This KERSIVO Insights Master Bible** — decisions specific to the editorial hub, article templates, content model, internal links, visual system and release process.
6. Older chats, concept sketches and generic design references.

If an offer, demo, claimed functionality or source-of-truth file conflicts with production code, **do not invent a compromise or publish an unverified claim**. Record the conflict, resolve it explicitly and recheck the actual application.

## 0.2 Decisions that are LOCKED for implementation planning

- KERSIVO Insights is a **subsection of kersivo.co.uk**, not an external subdomain, WordPress microsite or unrelated publication.
- Use the **existing marketing identity and navigation system**; add the editorial destination without duplicating the entire global navigation.
- Editorial homepage = **distinct magazine-like index**; article page = **focused reading experience**. They must not look like copies of KERSIVO's conversion landing pages.
- **One foundational article template** with optional reusable modules, rather than six expensive independent page systems.
- Build around **Astro Content Collections** and **prerendered published editorial routes** within the existing Astro/Vercel application; no second CMS or database for MVP.
- Preserve actual KERSIVO colours/fonts as baseline. No new mandatory display typeface, gradients or red glows as a branding shortcut.
- All published content is natural **British English**; audience is independent UK barbers and barbershop owners, not haircut consumers.
- SEO aims to solve **distinct search intents** and strengthen existing KERSIVO topic clusters; editorial is not a machine for duplicating every landing page.
- At launch: no open comments, newsletter popup, infinite scrolling, floating sales banners, search database, heavy animated cover videos or social vanity counters.
- All articles and archive pages must be discoverable through **real HTML links**; ensure indexability, canonical consistency, truthful structured data, and proper robots/sitemap integration.
- Before articles are supplied and approved, **do not launch or index an empty public Insights hub**. No fictional published posts, authors, featured articles, readers or results.
- Releases, branch merges and production indexability changes require **explicit owner approval** after evidence-based visual/technical QA.

## 0.3 OPEN DECISIONS — not to be prematurely presented as verified facts

| ID | Decision | Working preference | How it becomes locked |
|---|---|---|---|
| D1 | Final brand-facing editorial label | `KERSIVO / INSIGHTS` | Owner approves actual desktop/mobile header mockups |
| D2 | Article reading canvas | Dark editorial shell + warm ivory reading surface | Full representative article A/B visual review versus all-dark at 390px and 1440px; contrast check |
| D3 | Masthead typography scale | Strong, dense editorial display; restrained Antonio/Bebas use | Review at real widths with realistic long titles |
| D4 | Main feature composition | 8/4 or ~62/38 editorial split on large screens | Desktop and 390px visual proof with real aspect ratios |
| D5 | MDX adoption | Start with Markdown collection; add MDX only if editorial component composition genuinely requires it | Confirm compatibility with installed Astro version, builds and asset workflow |
| D6 | Publish thresholds | First public release with a credible small batch of genuine approved articles, not a blank archive | Owner approves available content and launch date |
| D7 | Category index release | Only create indexable category pages that have useful published collections and introductions | Content count, category-specific usefulness and QA at launch |

**Interpretation:** 'Working preference' is a strong design direction, not an excuse to skip the visual review. No developer may mark these as approved solely because tests pass.

## 0.4 Current project facts checked for this document

**Source inspected:** GitHub repository `vercelbackend95/kersivo-barber-outreach`, `main`, on 15 October 2026. **This is a snapshot, not proof that no newer work exists on another branch.**

- Existing stack: Astro 7.x, React integration, Vercel, Tailwind; `astro.config.mjs` uses `output: 'server'`.
- Existing marketing layout: `src/layouts/LandingLayout.astro` with `SeoHead`, `MarketingNavbar`, consent/analytics infrastructure and existing global styles.
- Existing marketing navigation source of truth: `src/lib/nav/marketingNavigation.ts`. Groups include `Platform`, `Compare`, `Resources`; the `Resources` group has a `Guides` section defined, not yet populated in the inspected list.
- Main marketing colour tokens in `src/styles/tokens.css`: `--bg: #0b0d10`, `--fg: #f1eee8`, `--muted: #b7bdc7`, `--accent: #d72638`, `--accent-text: #dc4e5b`.
- Existing type tokens: Inter for body and Bebas Neue as heading family. Existing font assets also include Antonio.
- Existing `LandingLayout` preloads four font files; editorial routes must **audit the impact** before reusing all preloads unconditionally.
- Existing SEO utilities: `src/lib/seo/meta.ts`, `defaults.ts`, `SeoHead.astro`, `kersivoEntityJsonLd.ts`, `marketingSitemap.ts` and `src/pages/sitemap.xml.ts`.
- **Important existing implementation gap:** `OgType` in `meta.ts` is currently `'website' | 'product'`; editorial article pages will need correct `og:type='article'`, implemented safely with tests and no unrelated regression.
- Marketing sitemap endpoint is **prerendered** and manually composes known marketing routes; Insights routes require a tested extension derived from the *published* collection.
- `@astrojs/mdx` is **not present in the inspected package.json**; do not assume MDX support already exists.
- The inspected `src/pages/` tree has **no public `/insights` route** yet.
- Existing main marketing navigation is sticky and has a tested-looking mobile hub architecture. Extend it; do not layer a second permanent sticky bar on top.

**Reverification required at implementation start:** repo name and permissions, active branch SHA, existing SEO type contracts, actual build scripts, typography/asset availability, live navigation, live `/insights` existence, demo destination and product claim accuracy.

---

# 1. Self-audit of the original design concept — problems corrected

| Original idea / risk | Audit | Final correction |
|---|---|---|
| 'Premium magazine' without execution rules | Too subjective: developers can interpret it as oversized headings, blur and animations | Specify grid, typography, spacing, imagery, states, breakpoints and review criteria in §§3–7 |
| Six article templates | Overengineering for a publication without content yet; slows production and multiplies bugs | One robust article layout + optional blocks and cover variants (§5, §8) |
| Dark shell + ivory body declared best immediately | May create visual discontinuity or accessibility issues | Strong recommended candidate, but formal full-article comparison before sign-off (§4.4) |
| Huge headline above the fold | Risk of hiding articles on mobile, poor scans and awkward long line breaks | Editorial masthead with strict size/height and real article visibility (§4.2) |
| Category filters and search from day one | Empty categories, UI noise, possibly thin URLs and needless JS | Small taxonomy, progressive category navigation, no search MVP (§6) |
| 'Fast' without performance budgets or baseline | Not testable | Baseline and explicit Core Web Vitals, Lighthouse, JS/image/font gates (§10) |
| Blog SEO separate from existing site | Cannibalisation risk with alternative, compare, booking, website and calculator pages | Mandatory search-intent ownership + contextual-link rules (§9) |
| Overenthusiastic design imagery | Easy to invent fictional clients or imply a real barbershop | Authentic/rights-checked photos, data diagrams or transparent editorial illustrations (§3.5) |
| 4 articles weekly assumed equal to 4 good articles | Publishing cadence does not guarantee quality | Owner owns editorial supply; publishing fails if evidence, intent, fact/author or link gate fails (§8) |
| Generic CTA repeated in every article | Erodes publication credibility | One restrained, contextually appropriate commercial next step after useful content (§7) |
| 'SEO schema' as a checklist of tags | Risk of invalid/duplicate schemas and false rich-result expectations | Page-specific factual JSON-LD, strict schemas and testing (§9.5) |
| No definition of 'done' | Future implementation could ship only a pretty hero | Multi-stage acceptance gates, responsive matrix and explicit owner approval (§12) |

**Audit conclusion:** The visual direction **Precision Editorial** is retained. We remove decorative complexity, overbuilding and assumptions about content/traffic. Success = editorial identity + exceptional reading UX + credible SEO architecture + easy publication + no regressions elsewhere.

---

# 2. Purpose, audience, tone and editorial positioning

## 2.1 What KERSIVO Insights is

A premium, specialist, UK-focused **knowledge and analysis publication for independent barbershop operators**. It earns attention through genuinely useful insight and transfers trust to KERSIVO through consistent competence.

The reader should think: **"This publication understands the realities of running a barbershop."** Not: "Here is another software company posting SEO filler."

## 2.2 The target reader

**Primary:** UK barbershop owner/operator, independent barber planning to grow, manager responsible for bookings, costs, clients, brand and business decisions.  
**Secondary:** owner assessing systems, costs, own-domain websites or switching booking platforms.  
**Not targeted:** someone searching for a haircut appointment or general haircut inspiration; generic salon/beauty audiences with no independent-barber fit; web developers searching for templates.

## 2.3 Editorial voice

- Natural British English. Calm, professional, pointed, commercially literate and practical.
- Expert without theatrical authority. Specific without inventing figures, regulations, adoption numbers or research.
- Explain real decisions facing a shop owner; prioritise clarity before product selling.
- No generic AI phrases: “unlock your potential”, “game-changing”, “seamless”, “revolutionise”, “supercharge your growth”, “the ultimate guide” by default.
- Core worldview: independent shops should have control over the customer journey and business identity, **without falsely claiming competitors cannot provide a feature or own data**.
- Do not frame every article as a Booksy/Fresha attack or a KERSIVO product feature list.

## 2.4 Content promise / working consumer-facing copy

These are **design fixtures**, not content to publish as completed articles:

- Nav: **Insights**
- Masthead brand line: **KERSIVO / INSIGHTS**
- Magazine headline (working): **The Business Behind the Chair.**
- Contextual lead: **Practical guides and independent thinking on bookings, branding, costs and running a barbershop in the UK.**
- Index section labels: **Featured**, **Latest Thinking**, **Explore Topics**, **More to Read**.

The masthead headline is an editorial brand line; SEO title/description must communicate real UK barbershop business relevance (§9).

## 2.5 Success measurement

**Primary product/growth outcomes:** relevant organic entrances, engaged reading, meaningful links into commercial research pages, Starter onboarding intent, Full consideration, and qualified conversations.  
**Secondary editorial outcomes:** topic visibility, search impressions and queries, internal-link discovery, returning readers, editorial updates, legitimate citations/backlinks.  
**Never mistake:** raw pageviews for customers, a demo click for an activated Starter account, or a pricing click for a paid Full subscription.

No traffic, ranking, CTR or conversion forecast is implied by launching Insights. Four posts weekly is an operational capacity target, not a ranking formula.

---

# 3. Visual identity: PRECISION EDITORIAL

## 3.1 Principle

**Precision before decoration.** Premium comes from typographic hierarchy, controlled spacing, meaningful editorial photography, consistent structure and extremely legible information.

The site is not a conventional three-column 'blog card' grid and not a series of duplicate SaaS sales sections.

## 3.2 Colour tokens and use

| Role | Existing / proposed token | Rule |
|---|---|---|
| Shell / background | Existing `#0B0D10` | Dark KERSIVO surface for site frame, masthead and index |
| Dark text | Existing `#F1EEE8` | Primary text on dark surfaces |
| Muted text | Existing `#B7BDC7` | Secondary reading levels; still contrast-test real combinations |
| Brand accent | Existing `#D72638` | Reserved for interactive indicators, rules and selected emphasis |
| Accessible dark-bg accent text | Existing `#DC4E5B` | Candidate for small red-accent copy; contrast-test before use |
| Warm reading background | **Candidate** `#F2F0EA` | Proposed article-paper colour; **not locked until visual review** |
| Reading ink | **Candidate** `#1B1D20` | Long-form body on warm background; verify contrast |
| Warm muted ink | **Candidate** `#575B60` | Byline, figure captions, metadata; verify contrast |
| Hairline borders | Token-based, low contrast | Precise separation, not chunky cards or heavy shadows |

Use no fixed '90% black' pseudo-metric. Design restraint is assessed visually. **Never use brand red for long passages or smaller text unless contrast requirements are met.** On ivory surfaces, a darker red interaction colour may be necessary; establish as a semantic token only after contrast testing, not as a new independent brand red.

## 3.3 Type system

Reuse existing local fonts: **Inter** as body, **Antonio/Bebas Neue** for selective editorial display accents. Do not introduce a fourth decorative font.

| Element | Desktop working target | Mobile working target | Notes |
|---|---:|---:|---|
| Insights masthead H1 | `clamp(44px, 5.8vw, 84px)` | 36–46px | Must wrap elegantly at long widths and reveal content early |
| Article H1 | `clamp(43px, 5vw, 66px)` | `clamp(32px, 8vw, 42px)` | Inter bold / semibold, not uppercase Bebas body text |
| Lead | 20–23px | 18–20px | Clear differentiation from body text |
| Body | 18px target | 17px minimum target | User can zoom 200%; adequate line height |
| H2 | 30–36px | 26–30px | Avoid dramatic letter spacing in reading body |
| H3 | 23–28px | 21–24px | Predictable hierarchy |
| Category/metadata | 12–13px | 12–13px | Use only when legible; never shrink for an 'editorial' look |
| Article text measure | ~62–72 characters | Width from safe gutters | Avoid excessively wide text columns |
| Body line-height | ~1.65–1.75 | ~1.65–1.75 | Tune in real rendered long article |

Metadata can use restrained uppercase; **long titles and body text remain sentence case**, with realistic punctuation and British spelling.

## 3.4 Layout / geometry

- **Global editorial outer max width:** 1280–1360px, aligned visually with KERSIVO's actual marketing header (currently approx. 1280px), not simply arbitrary 1400px content overflow.
- **Desktop page layout:** 12-column conceptual grid; 24–32px gutters; asymmetric hero arrangements only when real content benefits.
- **Tablet:** simplify to 2 columns, no crushed 3-column mosaics.
- **Mobile:** single column; 16–20px content gutters; no edge-clipped titles or sideways scrolling.
- **Article central measure:** approximate 680–740px; reading layout must stay visually balanced with/without TOC.
- **Corners:** subtle ~4–12px on editorial assets; do not clone heavily rounded dashboard card patterns.
- **Borders:** hairline. **Shadows:** minimal. **Glow/blur gradients:** normally absent. **Iconography:** small, functional, not filler.
- **Spacing:** controlled rhythm using a small token scale; more separation before major H2 topics, less between heading and its answer.

## 3.5 Image/art direction

**Permitted:** authentic barbershop photography with rights/permission, real tool/interior details, source-backed diagrams, honest data visuals, typography-led illustrated covers.  
**Not permitted:** fabricated 'real customers', nonexistent shops portrayed as clients, copied copyrighted imagery without permission, image-generated staff presented as factual, unreadable text embedded into image instead of HTML.

Image editorial standard:

- One strong composition is better than three mediocre photographs.
- Cover typography belongs mainly in HTML; if raster imagery contains text, provide equivalent accessible HTML.
- Editorial variants: `photographic`, `data-led`, `typographic`. **These are cover art directions, not separate article engines.**
- Use `width`, `height`, responsive `srcset`/`sizes`, colour profiles, proper crop focal points and descriptive (or empty decorative) `alt`.
- Hero/LCP image should normally be appropriately prioritised and not lazy-loaded. Noncritical below-fold images lazy-load. Verify on the rendered page.
- Images have a traceable `source / rights / credit` note internally; captions shown publicly when attribution/understanding requires it.

## 3.6 Interaction / motion

- Standard interaction timings: ~140–200 ms where motion helps feedback.
- Subtle image hover, underline, border/colour change. No mandatory reveal animations.
- No page-scroll hijacking, horizontal carousel as the only way to view articles, heavy video backgrounds, WebGL or parallax.
- Respect `prefers-reduced-motion`; keyboard interactions and focus states are first-class.
- The existing global page transitions/nav must be tested with editorial routes, but not replaced for editorial alone.

---

# 4. Homepage (`/insights`) — layout contract

## 4.1 Main task

Within the first visit, communicate a **serious publication for UK barbershop operators**, showcase one genuinely useful featured piece and provide immediate navigation to more content. The first real article must not be buried behind a full-height empty masthead.

## 4.2 Section composition

**A. Existing global KERSIVO navigation**  
Reuse `MarketingNavbar`; add an Insights destination in `Resources > Guides` (and consider a visible direct navigation label only if it fits real desktop/mobile space; no unapproved menu overcrowding). On `/insights` the current state must be correct for all Insights descendants.

**B. Editorial masthead**  
- Eyebrow: `KERSIVO / INSIGHTS`.
- Editorial headline: `The Business Behind the Chair.` (working; one real H1 on the hub).
- One precise audience sentence, no sales copy, no inflated authority claims.
- Compact vertical extent; editorial items should begin early on desktop and mobile.

**C. Featured composition**  
- One selected lead article, plus up to two genuine secondary featured articles **only if available**.
- On large desktop: asymmetrical ~8/4 or 62/38 division; one editorial focal point, not three same cards.
- Content requirements per card: category, semantic title link, optional accurate short deck, relevant image or typographic treatment, **no fake engagement counts**.
- If one or two posts exist, use a graceful **one-card/one-column** composition; never use blank placeholder cards.
- If no live approved posts, site remains unpublished/noindex until editorial launch.

**D. Latest Thinking / archive**  
- Real published articles in strict reverse publication-date order, excluding already surfaced feature items **on that same page** unless necessary to avoid an empty archive.
- Prefer crisp horizontal editorial rows with thumbnail (where helpful), title, category and publish date. Avoid monotonous repeated oversized promo cards.
- Proposed initial archive count: 10–12 articles per index page; settle after rendered page-length check.
- Page 1 `/insights`, page 2 `/insights/page/2`, and so on. Real next/previous `<a href>` links; canonical points to **each page's own URL**.

**E. Explore Topics**  
Only display categories that lead to meaningful, existing published destinations. Do not link to 404/empty pages. Topic links should look like simple editorial navigation, not colourful rounded SaaS feature badges.

**F. Publication footer**  
Reuse existing compliant global KERSIVO footer as appropriate; keep legal/privacy links and brand attribution. Add contextual links to relevant KERSIVO guides/compare tools without turning footer into a keyword link farm.

## 4.3 Above-the-fold acceptance

- At 1440px wide, the masthead + at least the start of a real featured piece are visible without a full-screen scroll.
- At 390px wide, branding, masthead and the first article entry appear quickly; no enormous dead space.
- Long headlines wrap without awkward 1-word orphan fragments where avoidable; never clip.
- All featured cards remain understandable with images disabled or failed.

## 4.4 Article 'light paper' test gate

This is a **design decision**, not a search-ranking tactic. Produce two realistic complete-article mockups:

- **A — Hybrid:** dark header/hero, warm `#F2F0EA` reading body, dark footer.
- **B — Unified dark:** same header/hero, dark body with high-contrast typography and sober callouts.

Evaluate both at **390 and 1440px**, with at least 1200 words, two H2 sections, one data table, one quote, one list, and the source panel. Test contrast, visual continuity, long-session comfort, image rendering, link distinction, and source/date readability. Select **one final default** for the launch; do not allow a per-post arbitrary dark/light switch in MVP.

**Provisional preference:** A — hybrid reading canvas, because premium editorial character is compatible with a calm long-form surface. Final authority: explicit owner approval.

---

# 5. Article template — single shared engine

## 5.1 The whole article, in order

1. Existing global marketing navigation.
2. Visible compact **breadcrumb**: `Home / Insights / [optional live category] / Article` reflecting actual links; exact levels must match real hierarchy.
3. Category + optional editorial format label (not noisy topic chips).
4. **One H1** (the actual article title) + optional accurate editorial deck/intro.
5. Factual author/byline, real publication date, real modified date **only if meaningful update**, optional reading time shown as estimate (not required for SEO).
6. Editorial hero image **if it adds value**; no mandatory filler image. Caption/credit as appropriate.
7. Direct answer / introduction relevant to search intent (not a boilerplate product pitch).
8. Main body: natural H2/H3 hierarchy, concise paragraphs, citations, images, optional useful components.
9. Optional Table of Contents (generated from real H2 headings, not a manually typed duplicate).
10. Evidence/sources and editorial update note where appropriate, especially for prices, platform comparisons, regulations and calculations.
11. One restrained contextual next step to a genuinely relevant live KERSIVO page or demo, if helpful to the reader and factually correct.
12. **Related Reading**: ~2–3 relevant published articles, excluding itself, actual category/intent fit, no empty slots.
13. Existing global footer.

## 5.2 Desktop reading layout

- Reading column max ~700–740px; article width doesn't explode on ultrawide screens.
- Optional left TOC rail (~200–230px) for long articles, using `position: sticky` only after ensuring it doesn't collide with global sticky nav.
- No second heavy permanent right rail, floating ads or duplicated sales panel.
- Images or tables may expand beyond text measure **only if** they remain readable and aligned.
- Figure captions, footnotes, sources and method notes are visually subordinate but readable.

## 5.3 Mobile reading layout

- Single uninterrupted column; 16–20px safe gutters.
- TOC becomes a simple native disclosure/compact section below intro **only for articles that benefit** (e.g. >=3 meaningful H2 headings, substantial length); no sticky sidebar on phones.
- Data tables: semantic `<table>` with purposeful horizontal overflow container and visible affordance, or a deliberate card transformation preserving headers/relationships.
- Never force phone readers to zoom because financial comparisons are rendered at 11px.
- Bottom CTAs and related reading must not cause intrusive sticky overlays.

## 5.4 Editorial components — build once

**Core (required for initial article engine):**

- `EditorialLayout` (or equivalent narrow composition inside existing `LandingLayout`)
- `InsightsMasthead`
- `FeaturedArticle`
- `ArticleRow` / `ArticleCard` (limited variants)
- `CategoryLink`
- `EditorialBreadcrumbs`
- `ArticleHeader`
- `ArticleProse`
- `ArticleToc` (progressive; long pieces only)
- `ArticleSources`
- `RelatedArticles`
- `EditorialPagination`
- `ArticleCta` (quiet, opt-in based on relevance)

**Supported prose/MDX blocks** (implement only those actually needed for real content; use semantic HTML):

- `KeyTakeaway` — clearly labelled, evidence-based summary, not decorative giant quote.
- `DataStat` — number + label + source/date, never an invented business metric.
- `CostBreakdown` / responsive semantic `DataTable` — for verified examples.
- `EditorialQuote` — attributed quote; do not generate fake people.
- `ComparisonNotes` — fair source-backed contrasts with fact checked dates.
- `InlineFigure` — image with credit and caption.
- `ProcessSteps` — when content is genuinely procedural.

Avoid building ten elaborate components before an article requires them. Default Markdown headings, lists, links, tables and blockquotes must already look good without custom shortcodes.

## 5.5 True responsiveness and accessibility

- HTML content exists on first document response without waiting for hydration.
- Semantically correct headings: one H1; H2/H3 do not skip levels for decoration.
- Author/byline, update dates, and image credits remain selectable HTML, not raster text.
- All relevant links identifiable without colour alone; focus ring visible.
- Keyboard nav, pointer/hover, screenreader landmark/navigation labels all tested.
- Contrast target **WCAG 2.2 AA**: >=4.5:1 normal text, >=3:1 large text; focus/controls and reflow evaluated separately.
- Text zoom 200%, browser zoom 400%, 320px width and `prefers-reduced-motion` must work without content loss.

---

# 6. Information architecture, navigation and URL strategy

## 6.1 URL decisions

**Proposed canonical public URLs:**

```text
/insights
/insights/{article-slug}
/insights/page/2
/insights/page/3
/insights/category/{category-slug}   # only once a category has a worthwhile published archive
```

- Article slugs are immutable once published unless a genuine redirect migration is approved.
- **Do not embed category name in article URL.** Categories can change; article canonical shouldn't.
- No date in article URL unless an unusual clear editorial requirement emerges.
- No `/blog` alias serving duplicate HTML. If a legacy path is later created, use a permanent redirect to one canonical path.
- Choose **one trailing slash policy matching current Astro production**; audit real `/insights` vs `/insights/` behavior before shipping. All HTML links, canonicals, sitemap and redirects must agree.
- Paginated archives always self-canonicalise; **do not canonical page 2 to page 1**.

## 6.2 Initial taxonomy — editorial organisation, not SEO page spam

| Category | What it covers | Proposed slug |
|---|---|---|
| Business & Revenue | Pricing services, running costs, profitability, staffing/operating decisions | `business-revenue` |
| Bookings & Clients | Bookings, deposits, cancellations, no-shows, customer relationships | `bookings-clients` |
| Brand & Marketing | Own-brand experience, websites, social proof, discoverability | `brand-marketing` |
| Software & Costs | Software cost models, workflow tools, honest technology comparisons | `software-costs` |
| Industry & People | Genuine shop-owner stories and credible industry context | `industry-people` |

Five is a **maximum planned classification set**, not a promise of five indexable landing pages at launch. Articles can have **one primary category** and optional internal tags. Tags are not automatically public URLs.

**Publication gate:** A category page must have a real, distinctive intro and a useful set of published articles; no empty thin 'category' templates just to create more index URLs. The owner decides when each category archive deserves publication. If category page is not yet live, the category label can route to `/insights` or remain non-clickable; do not link to placeholders.

## 6.3 Navigation integration

- Change navigation data in `src/lib/nav/marketingNavigation.ts`, not duplicated manual markup.
- Start with a `Resources > Guides` item: `Insights — Business guides and analysis for UK barbershops` → `/insights`.
- Active state must recognise the whole `/insights/` subtree, not only the root; current match helper requires review/extension.
- Do not add a permanent second sticky editorial menu; at most a **non-sticky compact category row** inside Insights when categories have content.
- On the homepage and footer, use a small number of purposeful contextual links to Insights once published and helpful.

## 6.4 Archive behaviour

- Strict published-only collection filter (draft, scheduled, unapproved entries **must not generate public routes, sitemap entries or visible cards**).
- Featured selection is explicit and editorial (one lead; optional supporting posts), with deterministic fallback to newest genuine article.
- No duplicate entries within featured and latest on same archive page.
- Deterministic sort by `publishedAt` descending, with stable secondary ID/slug sort.
- Pagination defaults to ~12 archive entries (actual final number chosen during page-length QA).
- Use links, not buttons, for SEO pagination. If JS is disabled, all archive navigation still works.
- Avoid building on-site search until sufficient published content justifies UX/maintenance overhead; revisit when inventory and real behaviour indicate the need.

---

# 7. Conversion, trust and KERSIVO product truth

## 7.1 How much sales presence belongs inside Insights?

Insights is **education first, commerce second**. Good articles should feel worth reading even if the reader never buys KERSIVO.

- Do not inject KERSIVO feature banners into every H2.
- No interrupting modal, timed signup overlay, generic newsletter popup or auto-playing sales widget.
- Optional single contextual next step towards a relevant existing page (pricing, compare, booksy alternative, branded websites, Starter) **after the answer is delivered**.
- Related articles should be recommended for topical relevance, not based only on revenue potential.
- Editorial content can disclose relevant KERSIVO interests when discussing its own product, especially comparisons.

## 7.2 Verified commercial claims only

A blog post may mention KERSIVO, but current commercial masters govern the copy:

- **Starter:** £0/month KERSIVO subscription, 0% KERSIVO platform commission; Stripe processing fees separate. Under v1.19, public Starter bookings require a payment-ready Stripe account and online payment of at least £5; Starter does not include Full own-domain website.
- **Full:** £39/month per physical location, 0% KERSIVO commission on booking and retail, standard included own-domain arrangement subject to full approved conditions; Stripe fees separate. Never call it '£39 forever'.
- Never imply no card processing costs, guaranteed more bookings, unlimited SMS, no setup obligations, complete data migration guarantees, custom source-code ownership or non-existent customer success cases.
- Current Full payment-mode descriptions have been flagged as potentially conflicting across existing masters; **do not assert unverified modes in editorial copy**.

## 7.3 Credibility layer

- Real author identity or genuinely responsible editorial brand/team.
- For prices/regulations/tools: source links and meaningful checked dates.
- Independent UK focus and realistic operational examples.
- Honest disclosure of illustrative calculations (assumptions), affiliate relationships or KERSIVO comparisons.
- No fake reviews, client logos, barber testimonials, 'as seen in', reader counts, traffic counters or writer credentials.
- For topics involving UK law, tax, insurance, employment or regulations: sources must be current, authoritative, and explanatory content must not masquerade as individual legal/financial advice.

---

# 8. Content engine, input contract and publishing workflow

## 8.1 Division of responsibilities

**Owner:** supplies articles, decides themes, checks/approves editorial message, author/attribution and publish timing.  
**KERSIVO editorial system:** handles visual presentation, structured metadata, schema, categorisation, published-only filtering, images, related links and builds.  
**Assistant/developer:** integrates owner's supplied text without silently rewriting core claims; flags factual risks, SEO cannibalisation, missing source facts and broken destinations; suggests only changes requiring owner approval.

**NOW:** build the system with clear fixture data in tests/local preview. **DO NOT manufacture real articles to make the public hub appear full.**

## 8.2 Architecture recommendation

- `src/content.config.ts` with typed Astro Content Collection `insights`.
- Local Markdown `.md` content initially. Evaluate official `@astrojs/mdx` integration later only if truly required for reusable rich modules; current inspected stack does **not** have MDX installed.
- Use Astro's `glob()` loader and schema validation; keep editorial content out of client bundles.
- Keep content under a predictable directory, e.g. `src/content/insights/` or `src/data/insights/`, matching verified Astro 7 conventions.
- Mark public routes with `export const prerender = true` because the existing site uses `output: 'server'`.
- Dynamic public article routes use `getStaticPaths()` derived from published content.
- During design/build, **fixtures stay in tests/preview or are filtered from release**; source code should not accidentally prerender drafts.
- No standalone CMS/database in v1.0. At 4 posts/week, Git-authored content + validation + deploy is viable as first system. A CMS can be evaluated later if editorial workflow becomes the actual bottleneck.

## 8.3 Minimum content/frontmatter contract (illustrative, not a new published article)

```yaml
---
slug: "example-owner-supplied-slug"          # immutable public ID, illustrative only
status: "draft"                             # draft | review | published
title: "Owner-supplied article title"
seoTitle: "Optional specific search title | KERSIVO"
description: "Unique, factual, human-readable description."
excerpt: "One concise deck used in archive cards."
category: "business-revenue"               # one of validated taxonomy IDs
tags: []
authorId: "kersivo-editorial"             # real accountable brand/team; no fictional human
publishedAt: null                           # actual publication timestamp when approved
updatedAt: null                             # only after substantial factual/editorial update
coverImage: null                            # optional genuine asset
coverAlt: null                              # required for informative images
coverCredit: null                           # if applicable
featured: false
featuredRank: null
primaryIntent: "owner-side question this URL uniquely answers"
reviewedFactsAt: null                       # required where topical claims need verification
relatedSlugs: []                            # optional manually curated real published slugs
commercialNextStep: null                    # optionally verified page ID/URL, not generic banner
---
```

This is the **data contract to implement and validate**, not a ready-to-run exact Zod schema. Resolve dates/nullable fields with the actual installed Astro/Zod APIs. `publishedAt` must be present for `status: published`; validate that `updatedAt >= publishedAt` if set; verify image/alt, slug uniqueness, author identity, category ID and existing related references.

Use a **single deliberate publish action**: approve text/facts → set status to `published` with actual timestamp → build and QA → owner-approved deploy. A future-dated timestamp by itself must **not** cause an accidental public route. For scheduled publishing, implement a separate explicit workflow only when needed.

## 8.4 Pre-publication workflow for each future owner-supplied article

1. Owner supplies the actual article and any images/sources.
2. Check **intent ownership** against existing KERSIVO URL map; warn on duplicate search intent.
3. Verify required facts and links; flag incomplete legal/pricing/competitor statements, never fabricate sources.
4. Assign genuine category, title, excerpt, author, date, OG image and appropriate editorial treatment.
5. Render preview; inspect responsive reading, tables, headings, citations and conversion relevance.
6. Validate SEO metadata/structured data, no false date modification, canonical uniqueness and related links.
7. Ask for explicit owner publication approval; then mark published and release.
8. On a meaningful later update: recheck factual sources, set real `updatedAt`, preserve existing URL when appropriate.

The user is **not** being asked to provide these articles during the platform build. This section defines readiness for when they arrive.

---

# 9. Search architecture and guardrails

## 9.1 What Insights is allowed to rank for

Insights can target **specific educational/investigative questions from UK barbershop owners**: running costs, price-setting mechanics, booking process economics, retention, digital brand decisions, no-show policy examples, and researched market issues.

It should not try to outrank KERSIVO's existing buyer pages for their primary intents using near-duplicate articles.

### Primary-intent ownership map

| Existing page | It already owns this primary search/buyer intent | Insights may do |
|---|---|---|
| `/` | Choosing KERSIVO barber booking/management software | Explain a narrower, distinct operator question and link to homepage where relevant |
| `/starter` | Start/understand the Starter £0 product | Explain general booking choices, link to Starter when truly useful |
| `/pricing` | Current KERSIVO plan prices and offer | Explain general software cost structures; send current KERSIVO pricing queries to pricing |
| `/compare` | Compare booking products broadly | Publish genuinely distinct research or methodology, not a cloned comparison table |
| `/*-alternative` | Commercial vendor-alternative intent | Provide separate fees/migration/use-case evidence only if primary intent and content differ materially |
| `/barber-software-cost-calculator` | Interactive cost modelling | Educate on assumptions/interpretation, link to the actual tool |
| `/barbershop-websites` | Buy/evaluate branded website for a barbershop | Write educational how/why articles without copying the Full offer |
| `/barbershop-website-design` | Website design principles for shop owners | Only distinct specialist examples/research, not same visual guide repackaged |
| `/barbershop-online-booking` (working/possibly unpublished) | Demonstrate client booking journey and diary | Do not spin near-identical 'how online booking works' article |

**Before the first editorial content batch:** reverify which of these pages are live, still in development or on another branch. A master document's existence is not proof of a published URL.

## 9.2 Discoverability and navigation

- One real indexable hub `/insights` **only after** published genuine content exists and launch is approved.
- Published articles linked contextually from hub/category/archive and sometimes live related topic landing pages.
- Semantic anchor text. No 'read more' repeated without descriptive surrounding context.
- Related links should be meaningful; no auto-generating links merely to increase count.
- Archive pages linked sequentially; category pages only if worthwhile.
- Canonical host always `https://kersivo.co.uk`, not Preview hostname.

## 9.3 Titles, metadata, indexing

**Working hub metadata:**

- `<title>`: `Barbershop Business Insights & Guides UK | KERSIVO`
- H1: `The Business Behind the Chair.`
- Meta description: `Practical insights for independent UK barbershop owners. Explore bookings, business costs, branding, software and running a stronger shop.`
- Canonical: `https://kersivo.co.uk/insights` (normalise with actual trailing-slash policy).
- Language: `en-GB`.

**Articles:**

- Each has its own unique title/description, real H1, stable slug, self-canonical, proper social metadata, and a clear primary reader question.
- No rigid word counts, keyword density or fake 'SEO score' as quality criterion.
- Avoid duplicate H1/SEO titles created by hero display elements.
- OG article image should be representative and genuinely available; default KERSIVO OG image may be a fallback only when truthful.
- Drafts must not appear in public routes or sitemap. Preview may use gated preview environments; do not rely on robots alone to protect sensitive unpublished content.
- Published URL should return real `200`, and missing/removed posts real `404` or approved `301` to the most relevant replacement; no soft-404 fake article template.

## 9.4 Sitemap/robots integration

The existing `src/pages/sitemap.xml.ts` is prerendered, using `src/lib/seo/marketingSitemap.ts`. **Do not build a parallel sitemap unaware of the canonical existing one.**

- Extend the existing builder to include only actually published `/insights` article URLs, live category archives and indexable paginated URLs when justified.
- Test combined static marketing + editorial entries, no duplicates, escaped XML, correct canonical host and stable sort.
- `lastmod` is actual meaningful editorial modification date, not deployment timestamp/current clock or file mtime.
- Avoid publishing draft/future/unreviewed posts in sitemap.
- Preview/noindex routes are excluded. Ensure robots rules do not inadvertently prevent crawler access to `noindex` on accessible public previews.
- Verify correct `Sitemap: .../sitemap.xml` path in live `robots.txt`.

## 9.5 Structured data — factual, page-specific

**Hub:** relevant `CollectionPage`/`WebPage` and link to existing `WebSite`/`Organization` IDs when appropriate; do not add fictitious ranking, reviews or blog ratings.  
**Article:** `Article` or `BlogPosting` (choose appropriate actual type), unique `@id`, `headline`, `description`, `mainEntityOfPage`, real `datePublished`, real `dateModified` when present, accurate `author` (Person if verified real person, otherwise truthful Organization), `publisher` referencing real KERSIVO Organization, and truthful image(s).  
**Breadcrumbs:** `BreadcrumbList` exactly matching actual visible, navigable hierarchy.  
**Never:** review/aggregate-rating schema without real ratings, fake authors, generic all-page FAQ schema, inflated claims that JSON-LD guarantees AI Overview or rich snippets.

**Implementation note:** Extend the existing `PageSeo`/`OgType` contract to permit an actual article Open Graph type **without breaking marketing product pages**. Review `SeoHead.astro` to avoid duplicate meta descriptions or canonicals, and add focused regression tests.

## 9.6 Pagination/indexation rules

- Real static HTML links on `/insights/page/n`.
- Page 2+ **self canonical**, not canonical to `/insights`.
- Stable per-page content sorting and consistent page size.
- Filter/sort query variants (if later introduced) must not create uncontrolled indexable duplicates.
- No pure JavaScript infinite scroll as the only access path; no client-side-only archive content.
- Audit Googlebot-reachable links and actual rendered HTML.

## 9.7 Search/AI visibility principles

- Original, clear answers and cited factual evidence help more than hidden 'AI SEO tags'.
- Where useful, define concepts succinctly and expand with examples, diagrams, counterexamples and limitations.
- Search intent, usefulness, sources and unique analysis matter more than hitting a post quota.
- No large-scale near-duplicate pages for slight keyword variants.
- Never promise a search position, featured snippet or AI citation.

---

# 10. Performance, technical and accessibility targets

## 10.1 Performance policy

**Treat speed as part of the design itself.** No new heavyweight front-end framework layer for mostly static text. Existing Astro/Vercel stack is sufficient.

| Metric | Target / interpretation |
|---|---|
| LCP | <= 2.5 s (Core Web Vitals 'good', p75 field; segment mobile/desktop) |
| INP | <= 200 ms (p75 field) |
| CLS | <= 0.1 (p75 field) |
| Lighthouse mobile performance | Internal release ambition >= 95 on representative routes under a repeatable test setup; **not a ranking guarantee or a substitute for field data** |
| JS | Article body available without client JS; extra editorial hydration should be near zero. Any introduced JS needs an explicit use case + bundle review |
| Hero image | Proper dimensions, responsive sources, efficient encoding, appropriate LCP prioritisation; no untested large originals |
| Below-fold imagery | Lazy loading and correct intrinsic dimensions |
| Fonts | Local existing Inter/Antonio/Bebas family; audit subset/preload policy to prevent unrelated and redundant downloads |
| CLS | Reserve dimensions for hero, figures, charts and dynamic widgets; do not insert late-loading promo panels |

**Budgets are engineering guardrails to refine from measured baseline**, not invented current measurements. Record actual Lighthouse traces, network transferred bytes, JavaScript coverage and Web Vitals for `/insights`, an article and page 2 at target widths.

## 10.2 Baseline-before-change

At first implementation step, run and save baseline measurements of existing marketing homepage, one alternative and one light content page; track fonts, route transitions, navbar and consent banner.

After editorial work, verify that adding Insights did **not** degrade existing homepage/nav/sitemap or marketing routes. The new article template can have a narrower typography/style payload without modifying unrelated pages.

## 10.3 Responsive/visual test matrix

Mandatory visual widths (CSS viewport): `320`, `375`, `390`, `430`, `768`, `1024`, `1280`, `1440` (and a very wide desktop smoke test). Test both mobile menu **closed/open**, browser zoom, long titles, no hero image, missing author photo, large data table, large list, source notes, images loading slowly, light/dark reading canvas candidates, and no JS.

Use **fresh screenshot or actual rendered preview evidence**, not only element measurements or build logs. Screens must represent the current commit/branch. Owner acceptance is separate from passing automated checks.

## 10.4 Accessibility launch gate

- WCAG 2.2 AA contrast intent; verify normal text >=4.5:1 and large text >=3:1, plus focus/controls separately.
- One real H1, landmarks (`header`, `nav`, `main`, `article`, `aside`, `footer`) appropriately applied.
- Keyboard-operable mobile nav, TOC, categories and pagination; skip-to-content; visible focus.
- Touch controls comfortable and usable; hover effects never the only signal.
- Text content reflows without horizontal page drift at 320px / 400% zoom.
- Meaningful alt text, captions/credits, images as decoration properly empty-alt.
- No motion-induced reading block; respects reduced-motion.
- Color is not sole encoding for financial outcomes, table differences or current nav state.

---

# 11. Code architecture proposal — implement with restraint

**This is a target architecture, not an assertion that these files already exist.** Exact names can vary while preserving contracts.

```text
src/
  content.config.ts
  content/insights/                 # only real articles once supplied; fixtures in test data
  lib/insights/
    schema.ts                       # frontmatter + validation
    published.ts                    # single published filter / stable sorting
    categories.ts                   # taxonomy and labels
    routes.ts                       # URL/canonical helpers
    related.ts                      # relevant published-only relationships
    seo.ts                          # metadata/article schema builders
  pages/insights/
    index.astro                     # prerendered public hub only at launch
    [slug].astro                    # prerender + getStaticPaths from published posts
    page/[page].astro              # prerender pagination (or equivalent Astro route)
    category/[category].astro      # only if category pages qualify for publication
  components/insights/
    InsightsMasthead.astro
    FeaturedArticle.astro
    ArticleRow.astro
    ArticleHeader.astro
    ArticleProse.astro
    ArticleToc.astro
    ArticleSources.astro
    RelatedArticles.astro
    EditorialPagination.astro
  styles/components/insights*.css   # preferably scoped / modest, isolated from homepage
```

### Implementation cautions

1. `src/pages/insights/[slug].astro` can conflict in concepts with `page/*` or `category/*` only if routes are not planned carefully; test route resolution, reserved slugs (`page`, `category`) and 404 behaviour.
2. `output: 'server'` is already set: mark intended editorial pages `prerender = true` and use `getStaticPaths` consistently.
3. Existing marketing sitemap is a prerendered endpoint; ensure build-time collection access works with real Astro 7 APIs. Do not force runtime DB queries for editorial listings.
4. Extend existing marketing `LandingLayout` and SEO tools carefully; create a thin `EditorialLayout` wrapper only if it avoids repeating page chrome while allowing a narrower style/font policy.
5. Use current shared `Kersivo Organization` stable `@id` references; do not mint a separate fictional editorial publisher or brand.
6. Avoid a second analytics stack, second cookie banner, alternate navbar, or global CSS resets that could affect booking/product interfaces.
7. Support HTML content render at build time and safe link targets. A responsive static chart/table is usually better than hydrating React for simple data.
8. Add explicit tests for data validation, only-public filtering, pagination, no duplicate cards, schema, sitemap, navigation active state, canonical/OG metadata, draft exclusions and invalid slugs.
9. Any optional MDX integration must match actual installed Astro version and be tested with Vercel build before adopting it as default.

---

# 12. Execution order, approval gates and definition of done

**NO ARTICLES ARE REQUIRED TO START BUILDING.** Local dummy fixtures are for design/test only. **Do not publish them.** Work in small, reviewable stages.

## GATE 0 — Project audit / baseline

**Work:** reverify active repo branch, current production/nav/tokens/SEO/sitemap, current analytics/consent, build/version, relevant public routes, page conflicts and URL policy. Record concrete file paths + branch SHA + findings.

**Deliverables:** 1-page implementation handoff, file-change map, issue list, baseline metrics.  
**Approval:** Owner confirms project baseline and chosen `/insights` identity. **No design code assumed approved from a document alone.**

## GATE 1 — Design tokens and editorial identity

**Work:** actual masthead, typography, dark index rhythm, cover art direction, rules, grid, interaction style. Make one realistic desktop (1440px) and mobile (390px) composition.

**Acceptance:** recognisable KERSIVO, premium without decoration, content visible early, WCAG contrast verified, no global navbar redesign.

**Approval:** explicit owner acceptance **before building the complete hub**.

## GATE 2 — `/insights` homepage design

**Work:** masthead → featured story arrangement → Latest Thinking/archive rows → optional topics → footer. Simulate 1, 3, 12 and 60 approved-article inventory states using **non-production fixtures**. Dynamic layout must never show empty cards.

**Acceptance:** 320/390/768/1440 render review; attractive with few and many items; semantic HTML, no JS requirement; featured/archive ordering and responsive image crops correct.

**Approval:** owner approves actual look. No automatic public publishing.

## GATE 3 — Article reading template (critical)

**Work:** complete representative article fixture, 1200+ test words, real hierarchy, costs table, list, image, evidence panel, related links, and two reading canvas variants. Decide D2 visually.

**Acceptance:** long-form comfortable at 390/1440, table mobile usable, TOC nonintrusive, text legible, image/credits truthful, no global UI clutter. Test no-JS and keyboard.

**Approval:** owner explicitly locks reading style, article header and data component treatments. **Do not declare perfection based on the masthead alone.**

## GATE 4 — Content engine and site integration

**Work:** collection/schema/Markdown support; only-published filtering; static dynamic routes; pagination; nav; SEO and OG type extension; BlogPosting/Article schema; sitemap; breadcrumbs; related articles; 404/draft gates; noindex preview handling.

**Acceptance:** successful Vercel-equivalent build, typechecks, focused unit/integration tests, correct page responses; tested generated HTML. Drafts absent from all public outputs; sitemap contains no phantom pages.

**Approval:** owner reviews working preview and tech summary. No production indexability switch yet.

## GATE 5 — Global regression / performance and accessibility audit

**Work:** 8-width QA matrix; slow network mobile; actual JS, font/image loading; Core Web Vitals lab checks and field baseline when available; accessibility keyboard/zoom/reduced-motion; homepage/compare/pricing/product-nav smoke tests; structured-data validation and crawler link audit.

**Acceptance:** blockers fixed, no unapproved changes to existing pages, real screenshot proof with commit SHA, no contradictory product claims. Record residual nonblocking issues honestly.

**Approval:** explicit owner QA approval.

## GATE 6 — Editorial launch (LATER, when owner supplies articles)

**Work:** import first set of genuine approved articles, fact/source review, confirm category release, internal linking and metadata, produce live-ready archive; final public publishing/indexing approval.

**Acceptance:** index holds real substantial content, no fake sample posts or empty categories, all routes 200/301/404 as appropriate, accurate sitemaps and `noindex` removal only from approved live routes.

**Approval:** explicit owner permission to merge and publish. This gate is **not part of the current 'build first' commitment**.

### Section approval states (mandatory)

`NOT STARTED` → `IN PROGRESS` → `NEEDS REVIEW` → `APPROVED` or `BLOCKED`.

A commit, preview deployment, passing tests, good Lighthouse score or developer assertion is **not** owner approval. Never progress to a dependent visual gate because the previous one compiled.

---

# 13. Hard release blockers / anti-patterns

Reject or block a release if any of the following occur:

- A public archive contains fake published articles, invented barbershops or fabricated authors/testimonials.
- SEO-focused editorial substantially duplicates a live existing commercial landing's main intent.
- `/insights` is indexed empty, 'coming soon', or filled with placeholder category cards.
- Article text requires JavaScript hydration before it exists in page HTML.
- `og:type` article cannot be emitted accurately or there are duplicate canonicals/meta from multiple layouts.
- Page 2+ canonical points to page 1, or pagination only works by clicking JavaScript buttons.
- Sitemap includes drafts, preview URLs, sample posts or wrong host/trailing-slash variants.
- Global navigation breaks on mobile or editorial adds a second sticky bar covering content.
- Contrast is unverified, body text tiny, article table unreadable or horizontal scroll affects entire page.
- The article advertises a Full-only feature as Starter, unsupported Stripe fee claims, unverified regulatory figures or supposed customer results.
- A new CMS/search dependency is introduced without real need and performance/maintenance review.
- A release claim says '100% SEO', 'guaranteed rank', 'guaranteed growth' or 'perfect Lighthouse' as an inherent result.
- An unrelated homepage, checkout, booking or admin flow is modified just to make the blog design work.
- Production merge/deploy/noindex removal occurs without owner authorisation.

---

# 14. Final quality checklist

## Branding / aesthetics

- [ ] Looks unmistakably like premium KERSIVO, not a pasted-in blog theme.
- [ ] Typography carries hierarchy rather than excess animation.
- [ ] Real photographs/figures have credible provenance; no pretend proof.
- [ ] Deep dark index and article reading surface cohere as one brand.
- [ ] Homepage does not repeat identical cards ad infinitum.
- [ ] Every meaningful UI element is useful; no decorative filters or badges.

## Reader experience

- [ ] First actual article discoverable immediately.
- [ ] One clear H1 on every route; article comfortably readable on phone.
- [ ] Native TOC only when helpful; no sticky clutter.
- [ ] Tables, headings, blockquotes and sources are excellent at 320–390px.
- [ ] Keyboard, no-JS, zoom and reduced motion tested.
- [ ] Dates, author responsibility, claims and image credits are truthful.

## SEO architecture

- [ ] Intent map reviewed against live site.
- [ ] Unique title/description/canonical per public route.
- [ ] Correct `Article`/`BlogPosting` + actual author/publisher/dates.
- [ ] Real visible breadcrumbs and schema match.
- [ ] Stable permanent slugs, correct redirects and 404s.
- [ ] Drafts not generated; sitemap includes only approved public routes.
- [ ] Pagination crawlable, self-canonical; no empty thin category pages.
- [ ] Real contextual links, not keyword farms.

## Engineering

- [ ] Prerendered Astro content within existing Vercel server-mode project.
- [ ] Existing navigation/SEO/cookie/analytics/brand tokens reused without regression.
- [ ] OG type supports `article` correctly; old pages unchanged.
- [ ] Sensible image/font strategy; performance baseline/delta recorded.
- [ ] Build, types, tests and realistic visual QA pass.
- [ ] The owner has seen current desktop/mobile preview, not just code metrics.

## Operational readiness

- [ ] Content metadata validated before publishing.
- [ ] Fixture posts cannot reach production.
- [ ] A new owner-supplied article can be prepared without manually redesigning the page.
- [ ] Featured/related/category/archive views recalculate deterministically.
- [ ] Publisher can roll back a broken article and preserve URLs when needed.
- [ ] Future editing is cheap enough for ~4 owner-supplied articles/week.

---

# 15. What NOT to build in version 1

**Do not build now:** CMS/admin authoring interface; Elasticsearch/Algolia search; newsletter popups; subscriber account system; comments/community profiles; AI-generated article feed; bespoke visual layout for each article; animated 3D covers; video headers; editorial ad placements; social share count widgets; read-progress fireworks; translated article network; auto-generated city-target landing pages; forum; author-ranking system; external editorial domain; independent WordPress site.

These may be reconsidered only after real user need emerges. A simple CSS-only reading progress indicator is also optional, not a launch requirement.

**Build the foundation so that real articles supplied by the owner can be published consistently.**

---

# 16. Evidence, references and verification scope

## 16.1 Internal project sources used

- `KERSIVO Commercial Offer v1.0.pdf` — Full offer scope and claim discipline.
- `KERSIVO_Starter_QR_Product_Spec_v1.19.md` — Starter and Full entitlement/payment policy direction.
- `KERSIVO_Barbershop_Websites_Pillar_Page_MASTER_v1.2.md` — website pillar intent, visual QA and approval process.
- `KERSIVO_Barbershop_Website_Design_MASTER_v1.1.md` — specialist design-supporting page intent, provenance rules.
- `KERSIVO_Barbershop_Online_Booking_MASTER_v1.1.md` — online booking intent and Full-mode verification caveats.
- `Booksy alternative SEO.md`, `Fresha alternative SEO.md` — existing alternatives cluster, canonical/sitemap and truth-source practices (historical snapshots; not proof of current ranking/competitor pricing).
- GitHub `vercelbackend95/kersivo-barber-outreach` default branch `main`, inspected **2026-10-15**: `package.json`, `astro.config.mjs`, `src/styles/tokens.css`, `src/styles/fonts-landing.css`, `src/layouts/LandingLayout.astro`, `src/lib/nav/marketingNavigation.ts`, `src/components/navigation/marketing/MarketingNavbar.astro`, `src/lib/seo/meta.ts`, `src/components/seo/SeoHead.astro`, `src/lib/seo/marketingSitemap.ts`, `src/pages/sitemap.xml.ts`, `src/pages/robots.txt.ts`, `src/lib/seo/kersivoEntityJsonLd.ts`.

## 16.2 Current external technical references (official)

- Astro Content Collections — https://docs.astro.build/en/guides/content-collections/
- Astro routing, `prerender` in server mode — https://docs.astro.build/en/reference/routing-reference/
- Astro official MDX integration — https://docs.astro.build/en/guides/integrations-guide/mdx/
- Google Article structured data — https://developers.google.com/search/docs/appearance/structured-data/article
- Google breadcrumb structured data — https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- Google pagination practices — https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
- Google canonicalization — https://developers.google.com/search/docs/crawling-indexing/canonicalization
- Google people-first content — https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google generative AI search guidance — https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- web.dev Core Web Vitals — https://web.dev/articles/vitals
- WCAG 2.2 — https://www.w3.org/TR/WCAG22/

**External guidance is cited for technical principles, not for any guarantee of rank, snippets, conversions or arbitrary template word counts.** Check current official docs when starting implementation if the framework version changed.

---

# 17. Founder decision record and change control

| Decision | Status at v1.0 | Owner review point |
|---|---|---|
| Build editorial platform before articles | **LOCKED by owner request** | None; do not request articles during build |
| Same-domain `/insights` | **PROPOSED / STRONG** | Gate 0 |
| KERSIVO / INSIGHTS visual identity | **WORKING** | Gate 1 |
| Precision Editorial / minimal visual approach | **STRATEGIC DIRECTION LOCKED** | Gate 1 execution review |
| Homepage asymmetric editorial lead | **WORKING** | Gate 2 |
| One reusable article system | **LOCKED** | Gate 3/4 implementations |
| Dark shell + warm article paper | **VISUAL CANDIDATE** | Gate 3 side-by-side approval |
| Five-category maximum / progressive exposure | **LOCKED PRINCIPLE** | Before content launch |
| Astro Content Collections / static public routes | **TECHNICAL DIRECTION LOCKED** | Gate 0 compatibility/QA |
| Local Markdown first; optional MDX | **WORKING** | Gate 4 |
| No new CMS/search MVP | **LOCKED** | Revisit after publication volume justifies |
| Editorial content/launch | **NOT STARTED / OWNER-SUPPLIED LATER** | Gate 6 |

### Revision protocol

Never silently overwrite an approved decision. Change the document version, record the rationale, which section is superseded, affected components/routes, and whether the owner explicitly approved the change. An updated master must preserve the current implementation stage; do not reset completed approved sections unnecessarily.

### Final governing statement

> **KERSIVO Insights is a serious editorial product, not a blog-shaped SEO afterthought. Build one beautiful, readable, truthful, fast system. Make it easy to publish the owner's articles, let every article earn its URL, and never compromise KERSIVO's brand or product truth for page count.**

**END — KERSIVO INSIGHTS MASTER BIBLE v1.0**
