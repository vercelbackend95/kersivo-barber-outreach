# /barbershop-websites v2 (Nov 2026)

## Why
Search Console before the change: 52 impressions, 1 click, average position 28.1. The page targeted
"barbershop websites with online booking" and its sections (branding, design, booking flow) overlapped
both `/barbershop-website-design` and `/barbershop-online-booking`, so none of the three had a clear job.

## Keyword split for the websites cluster
| Page | Owns | Does not target |
|---|---|---|
| `/barbershop-websites` | barbershop website, barber website, website for a barbershop, do I need a website, what a barbershop website should include, how clients book from a website, barbershop online presence | design, branding, layout, photography ideas |
| `/barbershop-website-design` | barbershop website design, barber website design ideas, branding, layout, photography, mobile design | "do I need a website", pricing / offer |
| `/barbershop-online-booking` | online booking for barbershops, booking system, deposits | website content |

Commercial anchors from the two guides keep pointing at `/barbershop-websites`; this page links back to the
design guide ("barbershop website design guide") and the booking guide ("online booking guide") once each.

## What changed
- Title: `Barbershop Website UK: What to Include & How Clients Book | KERSIVO`.
- H1: "A barbershop website clients can find, trust and book from".
- Sections, in order: why your own website (sources → one domain, profile vs own site switch), what a
  barbershop website should include (8 essentials pointing at a live example site), how clients book
  (5-step walkthrough on a phone), what a professional online presence looks like (8-point self-check),
  Full KERSIVO offer, FAQ (website-focused), final CTA.
- Same visual world as the homepage (warm near-black, Bebas headings, one red). GSAP loads after first
  paint; nothing animates with reduced motion.
- JSON-LD unchanged in shape (WebPage + breadcrumb, no FAQPage).

## Previous version
Kept at `/design-preview/barbershop-websites-v1` (noindex, canonical to `/barbershop-websites`, not in the
sitemap). Its components are unchanged in `src/components/barbershop-websites/`.

## After deploy
Request indexing for `/barbershop-websites` in Search Console and compare queries / position after
4 weeks against the baseline above.
