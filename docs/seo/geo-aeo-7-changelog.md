# GEO/AEO stage 7 — AI visibility metrics

Branch `seo/geo-aeo-7-metrics`. Plan: `docs/seo/GEO-AEO-PLAN.md`, stage 7.

## What changed

| File | Change |
|---|---|
| `docs/seo/ai-visibility-log/README.md` | How the monthly log works: steps, who does what, how mention rate, citation rate and share of voice are counted, and how to read them together with bot visits. |
| `docs/seo/ai-visibility-log/2026-12.md` | Template for the first prompt test (1 December 2026): all 40 rows (10 prompts × 4 assistants), a "Competitors named" column for share of voice, summary table, GA4 "AI assistants" sources, GSC/Bing and a slot for the bot report. |
| `docs/seo/ai-visibility-log/2026-11.md` | Baseline: AI bot visits for 1–26 November 2026, generated with the new script. |
| `scripts/ai-bot-visits.mjs`, `scripts/ai-bot-visits-lib.mjs` | Monthly report of which AI bots fetched which pages, as Markdown for the log. Reads Vercel Observability through the logged-in Vercel CLI, one day per query, with retries. Refuses to run unless `.vercel/project.json` is linked to `kersivo-barber-outreach`. |
| `src/lib/seo/aiBotVisits.test.ts` | Bot groups (and that every AI agent named in `robots.txt` is counted), asset filtering, query shape, day chunks and merging, month range, report format. |

## Item 2: why no middleware counter

The plan proposed logging AI user agents in middleware and noted the Vercel cost had to be checked. Checking showed two things:

1. **Middleware would miss pages.** Insights articles, Insights categories and the editorial standards page are prerendered, and on Vercel static files are served without running Astro middleware. Those are exactly the pages answer bots read most (e.g. Exa on the walk-ins article).
2. **Vercel already has the data.** Observability names known bots on every request, static files included (`vercel.request.count` by `bot_name` and `request_path`). Reading it costs nothing extra and needs no database table, so the script does that instead.

## What the baseline shows (1–26 November 2026)

- Answer and AI search bots: about 2,000 requests; OAI-SearchBot (891) and PerplexityBot (471) lead, ChatGPT-User fetched the homepage 87 times, Claude-User 24 requests.
- Training bots: about 1,300 requests (Amazonbot, GPTBot, ClaudeBot, Meta).
- No AI bot fetched `/llms.txt` in November. Assistants read the pages directly, which is why the answer-first blocks on the pages (stages 1–2) matter more than `llms.txt`.

Full tables: `docs/seo/ai-visibility-log/2026-11.md`.

## Item 3 (GA4)

Already set up as the "AI assistants" channel in `docs/analytics/ga4-setup.md`; the log template now has a section for it each month.

## Checks

`npm run claims:check` pass, `npm run typecheck` 0 errors, new tests pass. No site code or pages changed, so no build-affecting changes and no screenshots.

`docs/seo/ROADMAP.md` is left unchanged here on purpose: PR #320 edits the same line, so the stage 7 pointer goes in after #320 is merged.
