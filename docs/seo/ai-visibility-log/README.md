# AI visibility log

One file per month, `RRRR-MM.md`, for GEO/AEO stage 7 (`docs/seo/GEO-AEO-PLAN.md`). The file for a month records the check made on its first working day, so `2026-12.md` holds the baseline taken on 1 December 2026.

## Each month

1. Copy the previous month's file to the new month, clear the cells and move "This month" figures into "Last month".
2. **Prompt test (founder):** run the 10 prompts from `ai-visibility-playbook.md` section 6 in ChatGPT (with search), Perplexity, Gemini / Google AI Mode and Copilot, logged out or in a private window with memory off. Fill in section 1, then the summary in section 2.
3. **GA4 (founder):** channel "AI assistants", last calendar month, into section 3.
4. **Search Console and Bing (founder):** section 4.
5. **AI bot visits (Claude or founder):** from this repository, with the Vercel CLI logged in, run

   ```
   node scripts/ai-bot-visits.mjs
   ```

   It defaults to the last calendar month (`--from YYYY-MM-DD --to YYYY-MM-DD` for another period) and prints Markdown for section 5. Takes about two minutes for a month.

## The three numbers

- **Mention rate** = answers that name KERSIVO ÷ 40.
- **Citation rate** = answers that link a kersivo.co.uk page ÷ 40.
- **Share of voice** = KERSIVO mentions ÷ (KERSIVO + Booksy + Fresha + Treatwell mentions) across the same 40 answers, and the same for each competitor.

A rising mention rate with a flat citation rate means assistants know the brand but cite other sources: look at "Sources used" and get listed there. A flat mention rate with bots fetching our pages (section 5) points to content that is read but not quoted: check the short answers on those pages.

## Where the bot data comes from

Vercel already identifies known bots on every request it serves, static and prerendered pages included, and keeps the counts in Observability (`vercel.request.count` grouped by `bot_name` and `request_path`). The script only reads that data, so there is no middleware, database table or extra cost on the site. It queries one day at a time because a month in one query times out.

Bot groups (`scripts/ai-bot-visits-lib.mjs`):

- **Answer and AI search bots** fetch pages to answer a user or build an AI search index (OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User, Claude-SearchBot, Claude-User, Exa, DuckAssist). These are the ones that can lead to a citation.
- **Training bots** collect pages for model training (GPTBot, ClaudeBot, Meta, Amazonbot). Allowed on purpose, see stage 4.
- **Search crawlers** (Googlebot, Bingbot and others) are shown for scale only.
