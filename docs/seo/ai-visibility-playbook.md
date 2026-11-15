# AI visibility playbook

Goal: make KERSIVO easy for ChatGPT, Perplexity, Gemini / Google AI Mode, Copilot and Claude to understand, quote and recommend, and measure whether it is working.

Why now: Search Console (15 Oct–11 Nov 2026) shows long, chat-style queries ranking at positions 3–6 with 0 clicks, for example "how should a barbershop handle walk-ins during peak hours?" (119 impressions) and "alternative to booksy focused specifically on barbershop businesses." (16). AI answers are retrieving our pages but not naming the brand. Brand search is close to zero ("kersivo": 16 impressions). AI tools recommend brands they see described the same way in several independent places, so the work below is mostly off-site and has to be done by you.

What the site already does (batch `seo/ai-visibility`):

- `robots.txt` allows OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot and Perplexity-User.
- `/llms.txt` summarises KERSIVO, lists every comparison page and says who KERSIVO is and is not for.
- `/compare` and all 10 alternative pages open with a neutral "In short" answer under the hero.
- `/about` has a "KERSIVO at a glance" block that repeats the entity facts.
- IndexNow: a daily cron (`/api/cron/indexnow`, 06:40 UTC) sends URLs whose sitemap `lastmod` is today or yesterday to `api.indexnow.org`. It runs on production only and never resubmits unchanged pages. Bump the date in `src/lib/seo/pageDates.ts` (or the page's "Last updated" constant) when a page meaningfully changes, and the cron picks it up.

---

## 1. The copy to paste everywhere

Use these words exactly. Consistency matters more than cleverness: it is how search engines and AI tools recognise that every profile describes the same company. The source of truth is `src/lib/seo/kersivoEntityJsonLd.ts`.

| Field | Text |
|---|---|
| Name | KERSIVO |
| One-sentence description | KERSIVO is booking and management software built specifically for independent UK barbershops. |
| Category | Salon and barbershop booking software |
| Short bio (≤150 characters, Instagram/TikTok/X) | Booking software and branded websites for independent UK barbershops. 0% KERSIVO commission (Stripe fees apply). |
| Website | https://kersivo.co.uk |
| Contact | hello@kersivo.co.uk |
| Country / area served | United Kingdom |
| Pricing (where a field asks) | Full KERSIVO £39/month per location. KERSIVO Starter £0/month for up to 4 bookable barbers. 0% KERSIVO commission. Standard Stripe payment-processing fees apply to online payments. No setup fee. |
| Who it is not for | Shops that rely on a marketplace or a customer app to find new clients, and salons or spas that want one system for a wide range of beauty and wellness services. |

Rules for every profile: no founder name or photo, no "our team", no invented customer numbers, ratings or awards. Do not quote setup as a fixed number of days ("typically ready in a few days once we receive all required information" is the approved wording). Always put "Stripe fees apply" next to "0% KERSIVO commission".

Update the existing Instagram, TikTok and Facebook bios to the short bio above. The Facebook profile is currently a `profile.php?id=` URL; if you can claim a vanity URL (facebook.com/kersivo), do it and tell Claude so `PUBLIC_FACEBOOK_URL` / the default in `src/lib/seo/footerSocialLinks.ts` can be updated.

---

## 2. Bing Webmaster Tools (do this first)

ChatGPT search and Copilot rely on Bing's index, so Bing is the most direct lever.

1. Go to https://www.bing.com/webmasters and sign in.
2. Add site `https://kersivo.co.uk`. Choose **Import from Google Search Console** if offered (fastest); otherwise verify with **DNS**: add the CNAME record Bing gives you at the domain's DNS provider, wait a few minutes, click Verify.
3. **Sitemaps** → submit `https://kersivo.co.uk/sitemap.xml`.
4. **IndexNow** (left menu) → confirm the key `b9e8bc2d05fa4b4d87a03a8d0dd7f646` shows as verified. After the first daily cron run with a changed page, submitted URLs appear here. If nothing appears after a few days, check the Vercel logs for `seo.indexnow`.
5. **URL Inspection** → inspect `/`, `/compare`, `/booksy-alternative` and `/about`; request indexing for any that are not indexed.
6. Check **Search Performance** monthly next to the AI check in section 5.

---

## 3. Off-site profiles, in priority order

Create each profile with the copy from section 1, the same logo (`public/images/brand/kersivo-mark.png`) and the same category. Never post, buy or swap reviews. You may invite real customers to leave a review once they have used KERSIVO, with no incentive tied to a positive rating.

| # | Profile | Why | Add to `sameAs` when live? |
|---|---|---|---|
| 1 | **Capterra** (vendors.capterra.com), which also lists you on **GetApp** and Software Advice | Gartner's directories are heavily cited by AI tools for "best X software" prompts | Yes: the Capterra product page URL |
| 2 | **G2** (sell.g2.com, free listing) | Frequently cited source for software comparisons | Yes: the G2 product page URL |
| 3 | **Trustpilot** (business.trustpilot.com, free plan) | The review source UK buyers and AI tools recognise | Yes: the Trustpilot company page URL |
| 4 | **Product Hunt** | Creates a dated, crawlable launch page with the description | Yes: the Product Hunt product page URL |
| 5 | **NHBF supplier directory** (National Hair & Beauty Federation, nhbf.co.uk) | UK trade body; a strong relevance signal for UK barbering | Yes, if the listing has its own public URL |
| 6 | **UK barber trade directories and press**: supplier listings of UK barber trade bodies, trade shows and trade magazines (check each one is real, current and has its own profile page before signing up) | Topical UK mentions | Only listings with a dedicated profile page; skip simple link lists |

To add a profile to the Organization schema: put its public URL in `KERSIVO_OFF_SITE_PROFILES` in `src/lib/seo/kersivoEntityJsonLd.ts`. It is merged into `sameAs` on every page automatically. Only add a profile once it is live, public and shows the same description.

---

## 4. Articles to pitch for inclusion

These are the UK "best barber software / Booksy alternatives" pages that showed up in web searches on 15 November 2026 (searched from the US, so UK results may vary). Before pitching, open each one and check the byline and whether it is sponsored: several local-newspaper "lifestyle" lists are paid placements. Vendor-written lists (Zenoti, Setora, Pabau, ReeveOS, Take Bookings Now) are left out because a competitor will not add KERSIVO.

| # | Article | Publisher / who writes it | Notes |
|---|---|---|---|
| 1 | [10 Best Barber Booking Apps for 2026](https://leamingtonobserver.co.uk/lifestyle/10-best-barber-booking-apps-for-2026/) | Leamington Observer, local newspaper lifestyle section | Check whether it is sponsored content; ask the editor about the update policy |
| 2 | [10 best barbershop software options for 2026](https://redditchstandard.co.uk/lifestyle/10-best-barbershop-software-options-for-2026/) | Redditch Standard, local newspaper lifestyle section | Looks like the same network as #1; one contact may cover both |
| 3 | [Top barber booking systems for UK barbers in 2026](https://www.inkl.com/news/top-barber-booking-systems-for-uk-barbers-in-2026) | inkl, news aggregator (syndicated from another publisher) | Find and pitch the original publisher named on the page |
| 4 | [Best Barber Online Booking Systems for 2026](https://soho-london.co.uk/best-barber-online-booking-systems-for-2026) | soho-london.co.uk, London lifestyle site | Check the author and contact page |
| 5 | [The Best Barber Booking Apps in the UK in 2026](https://trustcut.co.uk/blog/the-best-barber-booking-apps-in-the-uk-in-2026) | TrustCut blog | Check whether TrustCut sells its own booking product before pitching |
| 6 | [Best Booking Apps for Barbers 2026](https://trimcheck.com/for-barbers/best-booking-app/) | TrimCheck, barber-focused review site | Already compares Booksy, Fresha, Squire, Treatwell, Square, Vagaro; pitch the flat per-location angle |
| 7 | [11 Best Booking Apps for Barbers in 2026, Compared](https://startbuddi.com/blog/best-booking-app-for-barbers/) | Startbuddi, small-business blog | |
| 8 | [Booksy Alternatives (2026): 10 Apps Compared](https://www.lilachbullock.com/booksy-alternatives/) | Lilach Bullock, marketing blogger | Not UK-only; pitch KERSIVO as the UK barbershop option |
| 9 | [Top 10 Barbershop Software for Businesses in the UK](https://www.softwareworld.co/barbershop-software-uk/) | SoftwareWorld, software directory | Usually a vendor submission form rather than an editor |
| 10 | [20 Best Salon Software in UK](https://www.softwaresuggest.com/salon-software/uk) | SoftwareSuggest, software directory | Free vendor listing; choose barbershop/salon software category |

How to pitch (short, by email or the site's contact form):

- One line on what KERSIVO is (the one-sentence description), one line on what is different (flat £39/month per location, no per-barber fees, the shop's own website and domain on Full KERSIVO, 0% KERSIVO commission with Stripe fees applying), and a link to `/compare` for sourced competitor prices.
- Offer a free demo account or the live demo (`/demo`); never offer payment for a positive ranking. If a site asks for payment, it is advertising: decide on that basis, and expect AI tools to discount it.
- Follow up once after a week, then stop.

---

## 5. Reddit and forums (r/barber, r/UKBusiness, r/smallbusinessuk)

AI tools cite Reddit threads heavily. Taking part only helps if it is genuine.

- Use one personal account and say who you are in every relevant comment: "I run KERSIVO, a booking tool for UK barbershops, so I'm biased."
- No astroturfing: no second accounts, no asking friends to post, no paid posts, no upvote swaps, no fake "has anyone tried KERSIVO?" threads.
- Answer the question first. Most comments should not mention KERSIVO at all: walk-ins at peak times, deposits and no-shows, chair rent vs commission, moving off a marketplace. The free tools (`/barbershop-no-show-calculator`, `/chair-rent-vs-commission-calculator`, `/barbershop-cancellation-policy-template`) are fine to link when they actually answer the question.
- When someone asks for a Booksy or Fresha alternative, mention KERSIVO with the disclosure and say honestly who it does not suit.
- Read each subreddit's rules on self-promotion before posting; some require mod approval.

---

## 6. Monthly AI check

Run once a month, on the first working day, in a logged-out or private window where possible (turn off memory/personalisation). Use exactly these 10 prompts so the months are comparable.

1. What is the best booking software for a UK barbershop?
2. What is a good Booksy alternative in the UK without per-barber fees?
3. What is an alternative to Fresha for a UK barbershop that wants its own website?
4. Which barber booking systems in the UK charge no commission on bookings?
5. What booking software should an independent barbershop in the UK use instead of a marketplace?
6. How do barbers move from walk-ins to confirmed online bookings?
7. What is the cheapest barbershop booking system with deposits in the UK?
8. Switching from Square to a more barber-focused booking platform: what are the options?
9. What is KERSIVO?
10. KERSIVO vs Booksy: which is better for a small UK barbershop?

Assistants: ChatGPT (with search), Perplexity, Gemini (and Google AI Mode in Search), Microsoft Copilot. Optionally Claude.

Log each result in the table below (copy it for each month). "Mentioned" = KERSIVO is named; "Cited" = a kersivo.co.uk page is linked as a source; "Correct?" = price, commission and audience match section 1. In "Sources used", note the 2–3 main domains the answer cited: that shows where to get listed next.

**Month: ____ 2026**

| # | Prompt | Assistant | Mentioned (Y/N) | Cited (Y/N, which page) | Position in list | Correct? (notes) | Sources used |
|---|---|---|---|---|---|---|---|
| 1 | Best booking software UK barbershop | ChatGPT | | | | | |
| 1 | | Perplexity | | | | | |
| 1 | | Gemini / AI Mode | | | | | |
| 1 | | Copilot | | | | | |
| 2 | Booksy alternative UK, no per-barber fees | ChatGPT | | | | | |
| … | | | | | | | |

Monthly summary (one line each): prompts where KERSIVO was mentioned (x/40), cited (x/40), anything wrong it said, the domains cited most often, and one action for next month. If an assistant says something wrong about KERSIVO, check that the site and `/llms.txt` say it clearly, then fix the off-site profile it most likely came from.

Also look at, monthly: Search Console impressions and clicks for the brand query "kersivo" and for the chat-style queries above, Bing Webmaster Tools performance, and GA4 referrals from chatgpt.com, perplexity.ai, gemini.google.com and copilot.microsoft.com.
