# KERSIVO: "Free preview before you pay" (Full KERSIVO)

## 1. Goal
Reverse the Full KERSIVO purchase order. Today: pay £39 → send details → see the site.
New: request a free preview (no card) → KERSIVO designs a private, individually designed preview of the shop's website and booking page → the owner reviews it and can request changes → the owner subscribes (£39/month) from the preview → the preview becomes their live site (no rebuild) → domain + Stripe Connect → owner approves → launch.

Success metric: preview requests → previews sent → previews viewed → checkouts started → subscriptions.

## 2. Principles
- All public copy is in British English, with £ and UK terms. Never invent statistics, reviews, testimonials, customer counts or scarcity.
- KERSIVO is presented as a company ("we"). Do not use founder-led language ("I built").
- Previews are designed individually by KERSIVO for each shop, not chosen from a template gallery. Copy may say this. It must not promise unlimited bespoke work.
- Starter (£0) flow and copy are unchanged, except shared components touched by this work.
- The direct paid route (/admin/launch) keeps working. It becomes a secondary link.
- All public CTA and copy changes sit behind a feature flag (FREE_PREVIEW_FLOW_ENABLED). When the flag is off, the public site behaves exactly as today.
- Never commit or deploy without explicit confirmation.

## 3. Configuration (one config module, no hardcoding)
- FREE_PREVIEW_FLOW_ENABLED: false by default
- PREVIEW_TURNAROUND_TEXT: "usually within 3 working days"
- PREVIEW_EXPIRY_DAYS: 30
- PREVIEW_DATA_RETENTION_DAYS_AFTER_EXPIRY: 90
- PREVIEW_FOLLOWUP_DAYS_AFTER_READY: 3
- PREVIEW_EXPIRY_REMINDER_DAYS_BEFORE: 7
- PREVIEW_NOTIFY_EMAIL: hello@kersivo.co.uk
Copy that mentions turnaround or expiry reads from this config.

## 4. Data model: PreviewRequest
Fields:
- id
- public token: unguessable, at least 128-bit
- created_at
- status
- contact first name (optional)
- email (required)
- shop name (required)
- town/city (required)
- work links (optional): structured `workLinks` array from the platform picker (Instagram, Booksy, Fresha, Treatwell, Google, TikTok, Facebook, Website, Other). Format is not required. The four legacy URL columns (`bookingPageUrl`, `instagramUrl`, `googleListingUrl`, `websiteUrl`) stay populated when a matching link is present.
- number of barbers (select: 1, 2–3, 4–6, 7+)
- current booking system (select: Booksy, Fresha, Treatwell, Nearcut, Setora, Square, Other, None)
- has own domain (yes / no / not sure)
- notes (optional, max 1000 chars)
- authorisation consent (required, with timestamp)
- marketing opt-in (optional, unticked by default, with timestamp)
- UTM / source / landing page
- linked draft shop id
- preview_ready_at
- first_viewed_at
- last_viewed_at
- view_count
- changes_requested_text + timestamp
- expires_at
- converted_at
- stripe customer/subscription ids
- declined_at
- followups_sent (log)
- email_opt_out
- internal notes

Statuses:
- requested
- in_progress
- ready
- changes_requested (→ back to ready when updated)
- converted
- declined (owner said no thanks)
- expired
- rejected (not eligible)

## 5. Public intake: /free-preview
Indexable, self-canonical, included in the sitemap.
Form with honeypot, server-side validation and rate limiting (plus the existing captcha if the site already uses one). “Where can we see your work?” is an optional multi-select platform grid; format hints are soft and never block submit. On success, show the confirmation state on the same page, send email E1 to the owner and E2 to PREVIEW_NOTIFY_EMAIL, and fire analytics events (`preview_work_platform_selected` on tile select, platform name only).

Required consent checkbox label:
"I'm the owner or manager of this barbershop, and KERSIVO can use the details and photos from the links above to create a private preview for me."

Optional checkbox label:
"Send me occasional KERSIVO product news and tips. You can unsubscribe at any time."

Under the submit button:
"No card needed. We'll only use your details to create and send your preview. Privacy Policy" (link to /privacy)

Submit button: "Request my free preview"

Confirmation state:
H2: "Thanks — we've got your details"
Text: "We'll start on the preview for {shopName} and email you at {email}, {PREVIEW_TURNAROUND_TEXT}. Got photos, a logo or anything you'd like us to include? Just reply to our confirmation email."
Link: "Explore the KERSIVO demo in the meantime" → /demo

## 6. Preview experience
- The preview is the shop's draft site, reached via a private tokenised URL. Decide the path during discovery and reuse the existing mechanism if one exists.
- Send the header X-Robots-Tag: noindex, nofollow and add a robots meta tag. Keep previews out of the sitemap. Do not block them in robots.txt, because a robots.txt block would stop crawlers from seeing the noindex.
- The preview booking flow runs in test mode: no real bookings, no payments, no emails to anyone.
- A sticky top bar appears on every preview page (desktop and mobile, accessible, it must not cover content):
  - Left: "Private preview for {shopName} · Not live"
  - Buttons: "Request changes" (secondary) and "Launch this website — £39/month" (primary)
  - Small text: "Test bookings only — no payments are taken."
- "Request changes" opens a simple form (textarea, max 2000 chars, label "What would you like us to change?", button "Send my changes"). Saving it sets the status to changes_requested and emails PREVIEW_NOTIFY_EMAIL. Success text: "Thanks — we'll update your preview and email you when it's ready."
- Track views: first_viewed_at, last_viewed_at, view_count. Exclude operator views.
- After expires_at, the preview URL shows a friendly expired page: H1 "This preview has expired", text "Previews stay available for {PREVIEW_EXPIRY_DAYS} days. Want another look? Email hello@kersivo.co.uk and we'll help.", with a link to /free-preview.

## 7. Conversion
- "Launch this website — £39/month" → Stripe Checkout for the existing Full KERSIVO price. Email prefilled; preview request id and draft shop id in metadata.
- Directly above the redirect, show a short confirmation panel: "£39/month per location · No setup fee · No VAT added · 0% KERSIVO commission (Stripe fees apply) · Cancel anytime. Nothing goes live until you approve it." with button "Continue to secure checkout".
- Domain **choice** (existing hostname, or one standard name to register) is collected on that panel and written to ClientOnboarding on the draft shop plus Stripe metadata **before** checkout. KERSIVO does not register, buy or attach the domain at this step.
- On successful payment (webhook, idempotent): mark the request converted, create or link the customer account, and attach the draft shop to that account without rebuilding it.
- Onboarding then asks only for what is still missing: Stripe Connect, confirmation of details, and a chance to change the already-chosen domain. Prefill everything known from the preview request and draft shop. DNS / SSL / go-live stay after approval.
- The direct /admin/launch route keeps working unchanged.

## 8. Ops (/ops, existing auth)
- List of preview requests: filter by status, sort by date, with columns for shop, town, links, barbers, system, status, viewed, age.
- Detail view: all fields, internal notes, status changes, link/create draft shop, and a "Copy preview link" button.
- Action "Mark ready and send": sets preview_ready_at and expires_at, then sends E3. If the request is in changes_requested, it sends E4 instead.
- Action "Reject" sets status rejected and sends no email.
- Optional, nice to have: simple counts per status for the last 30 days.

## 9. Emails
Plain, transactional, mobile-friendly. Reply-to: hello@kersivo.co.uk. Sign-off: "The KERSIVO team".

E1, to owner on request:
Subject: "We've received your preview request — {shopName}"
Body:
"Hi {firstName|there},

Thanks for requesting a free website preview for {shopName}. We'll design it individually for your shop and email you a private link, {PREVIEW_TURNAROUND_TEXT}.

If you have photos, a logo or anything you'd like us to include, just reply to this email.

There's nothing to pay and no card needed. You only pay if you decide to launch.

The KERSIVO team"

E2, internal notification:
Subject: "New preview request: {shopName}, {town}"
Body: all submitted fields plus a link to the ops detail view.

E3, preview ready:
Subject: "Your website preview for {shopName} is ready"
Body:
"Hi {firstName|there},

Your private website preview for {shopName} is ready:
{previewUrl}

Open it on your phone, try the booking flow and see it the way your clients would. Bookings on the preview are for testing only — no payments are taken.

Want something changed? Use 'Request changes' on the preview or reply to this email. One round of changes is included before you decide.

Happy with it? Launch it for £39/month per location — no setup fee, 0% KERSIVO commission (Stripe fees apply). We'll connect your domain, and nothing goes live until you approve it.

Your preview link works until {expiryDate}.

The KERSIVO team"

E4, preview updated after changes:
Subject: "We've updated your {shopName} preview"
Body:
"Hi {firstName|there},

We've made your changes. Take another look:
{previewUrl}

If it's right, you can launch it from the preview for £39/month. Your link works until {expiryDate}.

The KERSIVO team"

E5, follow-up, PREVIEW_FOLLOWUP_DAYS_AFTER_READY after ready, only if not converted/declined/opted out:
Subject: "Had a chance to look at your {shopName} preview?"
Body:
"Hi {firstName|there},

Just checking you saw the website preview we made for {shopName}:
{previewUrl}

If something isn't quite right, tell us and we'll change it.

Not for you? No problem — {noThanksLink} and we won't email you about it again.

The KERSIVO team"

E6, expiry reminder, PREVIEW_EXPIRY_REMINDER_DAYS_BEFORE before expiry, same conditions:
Subject: "Your {shopName} preview expires on {expiryDate}"
Body:
"Hi {firstName|there},

Your private website preview for {shopName} will expire on {expiryDate}:
{previewUrl}

Want to launch it, or need more time? Reply to this email and we'll help.

{noThanksLink} if you'd rather we didn't email you about it again.

The KERSIVO team"

Follow-up rules:
- Send at most E5 and E6, each once.
- {noThanksLink} is a one-click tokenised link labelled "Click here". It sets declined + email_opt_out and shows: "Thanks for letting us know. We won't email you about your preview again."
- Never send follow-ups after converted, declined, rejected, expired or opt-out.

## 10. Public site copy (behind FREE_PREVIEW_FLOW_ENABLED)

### 10.1 /free-preview page

Title: "Free Website Preview for UK Barbershops | KERSIVO"

Meta description: "See your barbershop website before you pay. We design a free private preview for your shop — no card, no call. Launch for £39/month if you like it."

H1: "See your barbershop website before you pay"

Intro: "Send us a few details about your shop. We'll design a private preview of your website and booking page individually for you — your name, services, barbers, photos and style. Like it? Launch it for £39/month. Not for you? You owe nothing."

Trust line: "No card · No sales call · Private link, hidden from search engines"

H2: "What you'll get"
- "A website designed for your shop, not a theme picked from a gallery"
- "Your services, prices and barbers on a booking page you can click through"
- "A private link to review on your phone"
- "One round of changes before you decide"

H2: "How it works"
1. "Request your free preview" — "Send your shop name and a link to your current booking page, Instagram, Google listing or website. No card, no call."
2. "We design your website" — "We build a private preview individually for your shop — your services, barbers, photos and style. {PREVIEW_TURNAROUND_TEXT_CAPITALISED}."
3. "Review it and ask for changes" — "Open your private link, try the booking flow and tell us what to change. One round of changes is included before you decide."
4. "Subscribe and launch" — "Happy with it? Subscribe for £39/month and we'll turn your preview into your live website, connect your domain and go live once you approve. Not for you? You owe nothing."

H2: "Request your free preview" → form (§5)

H2: "Questions about the free preview"
- Q "Is the preview really free?" — A "Yes. There's no card, no call and no obligation. You only pay if you decide to launch, at £39/month per location."
- Q "Is my website a template?" — A "No. We design each website individually around your shop — your name, photos, barbers, services and style. It runs on the KERSIVO platform, so booking, payments and your dashboard work reliably for every shop. It isn't an unlimited bespoke build: after launch, reasonable small updates are included, while redesigns and custom features aren't."
- Q "How long does it take?" — A "{PREVIEW_TURNAROUND_TEXT_CAPITALISED} of receiving your details. If we need anything else, we'll email you."
- Q "Will my preview be public?" — A "No. It's on a private link, hidden from search engines, and it stays available for {PREVIEW_EXPIRY_DAYS} days."
- Q "What happens if I subscribe?" — A "Your preview becomes your live website — nothing is rebuilt. You connect Stripe for online payments, we connect your domain, and your site goes live once you approve it."
- Q "Can I keep using Booksy, Fresha or Treatwell in the meantime?" — A "Yes. Keep taking bookings as normal. You only switch your booking links after you've approved your new site."
- Q "Which photos do you use?" — A "Photos from the links you send us, used only in your private preview and only with your permission. You can also send us your own photos by replying to our confirmation email."
- Q "What if I don't like it?" — A "Tell us what to change, or simply leave it. If you don't subscribe, your preview expires and we delete it."

Bottom line: "Just need online bookings for up to 4 barbers? KERSIVO Starter is £0/month." → /starter

Structured data: WebPage + BreadcrumbList (Home › Free website preview). Include FAQPage only if it matches the visible FAQ exactly.

### 10.2 Site-wide CTA pattern
Wherever Full KERSIVO is sold, replace the paid CTA with:
- Primary button: "Get my free preview" → /free-preview
- Secondary text link: "Or subscribe now — £39/month" → /admin/launch

Navbar: replace "Get started — £39/month" with "Free preview" (desktop and mobile).

Starter CTAs are unchanged.

Use one shared component where possible.

### 10.3 Homepage changes
- Hero subheading: "Full KERSIVO gives your shop a branded website on its own domain, online booking, client records and retail pickup — designed individually for your shop, for £39 a month per location, not per barber."
- Hero CTAs: primary "Get my free preview", secondary "See it working" (keep the existing #live-demo).
- Replace "Your first payment is taken when you subscribe. Your site is typically ready in a few days once we receive all required information, and nothing goes live until you approve it." with: "We design a private preview of your website first — no card, no call. You only pay if you decide to launch."
- Keep the line "No setup fee · No VAT added · 0% KERSIVO commission (Stripe fees apply) · Cancel anytime".
- Pricing card:
  - primary "Get my free preview";
  - secondary link "Or subscribe now — £39/month";
  - move "Billed today, then monthly on the same billing-cycle day." and "Secure checkout through Stripe" next to the secondary link;
  - replace "Your first payment is taken when you subscribe; your site is typically ready in a few days once we receive all required information." with "See your free preview first. If you subscribe, your first payment is taken at checkout, then monthly on the same day."
- "Getting started" section:
  - H2 "From free preview to launch in four steps"
  - intro "We design your website first. You decide after you've seen it."
  - the 4 steps from §10.1
  - keep "Nothing goes live until you approve it."
  - CTA "Get my free preview".
- Switching section and final CTA section: primary CTA "Get my free preview".
- FAQ "When do I pay, and how long until my website is live?" new answer: "You don't pay anything for your preview, which we usually send {PREVIEW_TURNAROUND_TEXT_SHORT}. If you decide to launch, your first £39 payment is taken when you subscribe, then monthly on the same day. We then connect your domain and payments — typically within a few days of receiving everything we need, which is an estimate, not a guaranteed date — and nothing goes live until you approve it."
- FAQ "Is the website custom-designed?" new answer = the "Is my website a template?" answer from §10.1.
- Homepage meta description: "Your own branded barbershop website, domain and online booking for £39/month per location. See a free personalised preview first — no card needed."
- Keep JSON-LD FAQ in sync with the visible FAQ.

### 10.4 Other pages
/pricing, /barbershop-websites, all /*-alternative pages, /compare and the calculators get the §10.2 CTA pattern. On /pricing, add a short line under the Full plan: "Not sure yet? Get a free preview of your website first — no card needed."

## 11. Analytics events
Use the existing analytics tool. Do not add a new tracker without asking.
- preview_cta_click (location)
- preview_form_start
- preview_request_submitted
- preview_viewed (first view only)
- preview_changes_requested
- preview_launch_click
- preview_checkout_started
- preview_converted (from webhook)
- preview_declined

## 12. Legal (draft text; the owner will review)
Add a "Free website preview" section to /terms and a matching paragraph to /privacy (lawful basis: steps taken at the request of the person before entering into a contract; retention per config). Update "Last updated" dates.

Terms draft:
"Free website preview. At your request, we may design a free, private preview of a website and booking page for your barbershop. The preview is free of charge and without obligation. It is for your review only, is not published or indexed by search engines, and remains available for {PREVIEW_EXPIRY_DAYS} days. Bookings made on a preview are for testing only: no appointments are created and no payments are taken. By requesting a preview, you confirm that you are authorised to act for the barbershop and that we may use the details, text and images from the links and files you send us solely to create your preview. If you do not subscribe, we delete the preview and the information you provided for it within {PREVIEW_DATA_RETENTION_DAYS_AFTER_EXPIRY} days of the preview expiring."

## 13. Batches
- Batch 1: data model, config, /free-preview intake (built but not linked from anywhere while the flag is off), E1/E2, ops list/detail/actions, spam protection.
- Batch 2: preview experience (token URL, noindex, test-mode booking, top bar, request changes, views, expiry page), E3/E4, Launch → checkout → webhook → attach draft shop → shortened onboarding.
- Batch 3: all public copy and CTA changes behind the flag, /free-preview copy and schema, sitemap.
- Batch 4: E5/E6 scheduled follow-ups + no-thanks link, retention cleanup job, analytics events, legal text, full end-to-end QA, then a recommendation to enable the flag.
