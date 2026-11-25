# Retail pickup page — changelog

New page **`/barbershop-retail-pickup`**: an interactive explainer for KERSIVO Retail pickup (click and collect for a barbershop's own products), centred on what is new: each shop now chooses **Full payment upfront** or **Pay when collecting** (shipped in `b91ed07b`).

## Search and AI visibility
- Title `Barbershop Click and Collect: Retail Pickup | KERSIVO`; "click and collect" is the UK search phrase, "Retail pickup" the product name. Description carries the commission claim; Stripe fees sit next to it on the page.
- H1 "Click and collect for your barbershop." with a 40–60 word direct answer under it.
- JSON-LD: WebPage (dateModified, speakable), Service (offer £39, GBP, UK), HowTo (the four visible journey steps), BreadcrumbList, FAQPage (identical to the visible FAQ, 10 questions).
- Listed in the sitemap (`pageDates.ts`), `/llms.txt` (Product section), route families, and the Product menu ("Retail pickup" now opens this page instead of the demo shop; the page links to the demo).

## Sections
1. Hero with a three.js scene (pomade tin and beard-oil bottle over a red pickup ring; pointer turns it, scrolling closes the lid and the pickup ticket flips to Collected).
2. What's new: a radio switch between the two payment modes; the checkout mock uses the real storefront labels.
3. How it works: four chapters, pinned and scroll-driven on wide screens, tap-driven on phones and under reduced motion.
4. Try the counter: a working Orders view. Collect / Take payment; Sales only counts paid orders, as in `collect.ts`.
5. Side-by-side comparison of the two modes (stacks on phones).
6. Why pickup, 7. Get started + plan card, FAQ, close and related links.

## Facts and their source
Payment modes and labels `src/lib/shop/retailPaymentMode.ts`; reservation, reference and emails `createRetailReservation.ts`, `orderReference.ts`, `email/sender.ts`; counter hand-over and sales `api/admin/shop/orders/[id]/collect.ts`; out of stock `prisma/schema.prisma`; Starter excludes the retail shop `pricingPlans.ts`. Demo orders are on the fictional Heritage Grooming shop.

## Open questions
- Card-reader / till costs for pay-at-collection are described generically ("your usual till or card reader costs apply"); no figure is given.
- The pickup ticket and checkout mock are illustrative, not screenshots of a live shop.
