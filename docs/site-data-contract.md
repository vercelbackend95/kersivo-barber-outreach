# KERSIVO site data contract (v1)

A shop website is a **design bound to one object**: `SiteData`. Everything the owner enters in the admin (Starter hub or paid dashboard) ends up in it. A new design never reads the database, never formats money or times, and never contains shop content.

- Type (source of truth): `src/lib/siteData/types.ts`
- Builder (pure, tested): `src/lib/siteData/build.ts`
- Loader: `src/lib/siteData/getSiteData.ts`
- Formatting (the only place): `src/lib/siteData/format.ts`
- JSON-LD: `src/lib/siteData/jsonLd.ts`
- Shared validation for every write path: `src/lib/shopData/schema.ts`

Shop websites are built outside this repo (one Vercel project per shop, attached via `sitePreviewUrl`; decision in `docs/free-preview-discovery.md` §14). They get `SiteData` over HTTP.

---

## 1. Getting the data

| Use | Request | Caching |
|---|---|---|
| Live site | `GET https://kersivo.co.uk/api/public/site/{bookingSlug}` or `/api/public/site/{own-domain}` (e.g. `sharpcuts.co.uk`, only once KERSIVO has verified it live) | CDN `s-maxage=30, stale-while-revalidate=60`, keyed by URL |
| Private preview build | `GET https://kersivo.co.uk/api/public/site-preview` with header `X-Kersivo-Preview-Token: <preview token>` | `private, no-store` |

- `404` = not published. The live endpoint answers only when the plan includes the branded website (Full KERSIVO). Starter, lapsed and departed shops return 404. Their data is untouched.
- `503` = temporary database problem (never cached). Keep serving your last good copy.
- `?location=<id>` is accepted. Today the only valid id is `business.id`.
- Inside this repo, call `getSiteData(shopSlugOrDomain, locationId?)` server-side instead.

**Changes go live without a redeploy.** A save in the admin is visible on the API at once and at the CDN within 30 seconds. A shop site must therefore fetch at request time (SSR) or with its own revalidation of 30 seconds or less. Do not bake `SiteData` into a static build.

**No cross-shop leaks.** The CDN key is the full URL, and the URL always contains the shop identifier. The preview endpoint is never cached. Do not add a cache in the site that is keyed on anything less than the identifier.

---

## 2. The type

```ts
type SiteData = {
  contractVersion: 1;
  generatedAt: string;                 // ISO timestamp
  business: {
    id: string;
    name: string;
    tagline: string | null;
    description: string | null;        // plain text, may contain line breaks
    logoUrl: string | null;
    brand: { primaryColour: string | null; secondaryColour: string | null }; // "#RRGGBB"
    websiteUrl: string | null;         // verified own-domain origin
    socialLinks: { platform: 'instagram' | 'facebook' | 'tiktok' | 'other'; label: string; url: string }[];
  };
  location: SiteLocation;              // the location this site is for
  locations: SiteLocation[];           // all locations (length 1 today; loop anyway)
  openingHours: {
    days: SiteOpeningDay[];            // always 7, Monday first
    exceptions: SiteOpeningException[]; // today onwards, soonest first
  };
  team: { id; name; title: string | null; bio: string | null; photoUrl: string | null; serviceIds: string[] }[];
  services: {
    categories: { name: string; services: SiteService[] }[];
    all: SiteService[];
  };
  products: {
    id; name; description: string | null; imageUrl: string | null;
    pricePence: number; currency: 'GBP'; priceDisplay: string;   // "£12", "£12.50"
    inStock: boolean; availabilityDisplay: 'In stock' | 'Out of stock';
    url: string;                       // pickup page on kersivo.co.uk
  }[];
  booking: { available: boolean; url: string | null; label: string };
  seo: {
    title: string; description: string; canonicalUrl: string;
    jsonLd: object;                    // home page @graph
    pages: { key: 'services' | 'team' | 'contact' | 'shop'; path: string; url: string;
             name: string; title: string; description: string; jsonLd: object }[];
  };
  planFeatures: { plan: 'starter' | 'full' | 'preview'; brandedSite: boolean; onlineBooking: boolean; retail: boolean };
  has: { description; address; contact; socials; openingHours; team; services; products; booking: boolean };
};

type SiteLocation = {
  id: string; name: string;
  address: { line1; line2; town; postcode: string | null; country: 'GB'; lines: string[]; formatted: string | null };
  phone: string | null; phoneHref: string | null;   // "tel:01610000000"
  email: string | null; timezone: string;           // "Europe/London"
};

type SiteOpeningDay = {
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;   // 1 = Monday
  dayName: string; shortName: string;     // "Monday", "Mon"
  isOpen: boolean;
  periods: { opens: string; closes: string }[];   // "HH:mm"; empty when closed
  display: string;                        // "09:00–18:00" | "Closed"
};

type SiteOpeningException = {
  date: string; dateDisplay: string;      // "2026-12-25", "Friday 25 December"
  closed: boolean; periods: { opens: string; closes: string }[];
  label: string | null; display: string;  // "Closed" | "10:00–14:00"
};

type SiteService = {
  id: string; name: string; category: string; description: string | null;
  durationMinutes: number; durationDisplay: string;   // "45 min", "1 hr 15 min"
  pricePence: number; currency: 'GBP'; priceFrom: boolean;
  priceDisplay: string;                               // "£25" | "£25.50" | "From £25"
  teamMemberIds: string[]; featured: boolean;
};
```

### Field notes

| Field | Meaning / source |
|---|---|
| `business.name` | `ShopSettings.name` |
| `business.tagline`, `description` | `ShopPublicProfile`. The hub "About" text and the launch wizard "Shop description" are the same field, and the last save wins. |
| `business.logoUrl` | `ShopSettings.logoUrl` (public URL) |
| `business.brand` | `ShopPublicProfile.brandPrimaryColour/SecondaryColour` (hub Colours app or launch wizard) |
| `business.websiteUrl` | Origin of the ops-verified live booking destination (`FullBookingDestination` `VERIFIED_LIVE`); otherwise null |
| `location.address` | Profile `addressLine1/2`, `postcode` (normalised, e.g. "M1 1AE") and `ShopSettings.townCity`. `lines`/`formatted` are empty unless there is a street line or a postcode. A town alone is not shown as an address. |
| `openingHours.days` | `ShopOpeningHours`. A missing or inactive day is closed. If the shop never set hours, all seven days are closed and `has.openingHours` is false. |
| `openingHours.exceptions` | `ShopOpeningException` from today (shop time zone). Special hours replace that day's weekly hours. |
| `team` | `Barber` where `active` **and** `showOnWebsite`, in dashboard order. `title`/`bio` are optional. `serviceIds` only reference services in `services.all`. |
| `services` | `Service` where `isActive`, in dashboard order. Categories appear in the order of their first service. A service without a category goes under "Services". The price is integer pence; `priceFrom` shows "From £X". |
| `products` | `Product` where `active`, in dashboard order. **Empty unless `planFeatures.retail`.** Out-of-stock items stay listed with `inStock: false`. |
| `booking.available` | True only when the shop accepts new online bookings now. `url` is the own-domain booking URL when verified, else `https://kersivo.co.uk/book/{slug}`. |
| `seo.canonicalUrl` | `business.websiteUrl`, else the hosted booking page |
| `planFeatures` | What the plan lets this site show. Gating happens here, never in storage. |

---

## 3. Empty-state rules (mandatory)

- Render a section only when its flag is true: `has.team`, `has.services`, `has.products`, `has.openingHours`, `has.address`, `has.contact`, `has.socials`, `has.description`, `has.booking`.
- No placeholder text, no lorem ipsum, no "Coming soon" sections, no sample barbers or prices.
- No booking CTA when `has.booking` is false. Show the phone number instead if `has.contact`.
- Never add reviews, ratings, star widgets, testimonials or counts. KERSIVO has no verified review data.
- Use the `*Display` strings as they are. Do not format pence, times, dates or durations in a template.
- Copy you write into a design (headings, button labels) is British English and lives in the design, not in `SiteData`.

---

## 4. Structured data

`seo.jsonLd` (home) and `seo.pages[].jsonLd` (sub-pages) are complete JSON-LD documents built from the same object. Embed one per page, unchanged:

```html
<script type="application/ld+json" set:html={JSON.stringify(site.seo.jsonLd)} />
```

- `@graph` with `WebSite` (`{canonical}#website`) and `BarberShop` (`{canonical}#barbershop`). The `BarberShop` node carries name, url, telephone, email, `PostalAddress`, logo, `openingHoursSpecification` (closed days omitted), `specialOpeningHoursSpecification` (exceptions), `sameAs` (socials), `ReserveAction` (only when booking is available), and `priceRange` (only when derivable from real service prices).
- **Home and services pages:** `hasOfferCatalog` → `OfferCatalog` per category → `Offer` with `itemOffered: Service`, `price` + `priceCurrency: "GBP"`. "From" prices use `priceSpecification.minPrice`.
- **Home and shop pages:** a `Product` + `Offer` (price, GBP, availability) for each listed product with a price.
- **Sub-pages:** `BreadcrumbList` (Home › Page).
- No `Review` or `AggregateRating`, ever (test-enforced).
- **Rule:** a page may only embed a graph whose content it shows. The home graph includes the service catalogue and products, so a home page that embeds `seo.jsonLd` must render the services section (and products when `has.products`). A design that keeps services on `/services` only should embed `seo.pages.find(p => p.key === 'services').jsonLd` there. The home page then needs a graph without the catalogue; ask for a `home-lite` variant rather than editing the JSON.
- Sub-page paths are `/services`, `/team`, `/contact` and `/shop`. Use these paths so the breadcrumb URLs are real.

The snapshot test (`src/lib/siteData/build.test.ts`) pins the output for a fixture shop. Check a new design's pages in Google's Rich Results Test and the Schema.org validator before launch.

---

## 5. Binding a new design (minimal example)

An Astro page in a shop's site project:

```astro
---
// src/pages/index.astro in the shop's own site project
import type { SiteData } from './site-data'; // copy of src/lib/siteData/types.ts

const res = await fetch(`https://kersivo.co.uk/api/public/site/${import.meta.env.KERSIVO_SHOP}`);
if (res.status === 404) return Astro.redirect('/offline');
const site: SiteData = await res.json();
---
<html lang="en-GB">
  <head>
    <title>{site.seo.title}</title>
    <meta name="description" content={site.seo.description} />
    <link rel="canonical" href={site.seo.canonicalUrl} />
    <script type="application/ld+json" set:html={JSON.stringify(site.seo.jsonLd)} />
  </head>
  <body>
    <h1>{site.business.name}</h1>
    {site.business.tagline && <p>{site.business.tagline}</p>}
    {site.has.booking && <a href={site.booking.url}>{site.booking.label}</a>}

    {site.has.services && (
      <section>
        <h2>Services</h2>
        {site.services.categories.map((c) => (
          <>
            <h3>{c.name}</h3>
            <ul>{c.services.map((s) => <li>{s.name} · {s.durationDisplay} · {s.priceDisplay}</li>)}</ul>
          </>
        ))}
      </section>
    )}

    {site.has.team && (
      <section><h2>Our team</h2>{site.team.map((m) => <p>{m.name}{m.title && ` · ${m.title}`}</p>)}</section>
    )}

    {site.has.openingHours && (
      <section>
        <h2>Opening hours</h2>
        <dl>{site.openingHours.days.map((d) => <><dt>{d.dayName}</dt><dd>{d.display}</dd></>)}</dl>
      </section>
    )}

    {site.has.address && <address>{site.location.address.lines.map((l) => <>{l}<br /></>)}</address>}
  </body>
</html>
```

For a private preview build, fetch `/api/public/site-preview` server-side with the `X-Kersivo-Preview-Token` header. Never put the token in a URL or in client-side code.

---

## 6. Where the data is written (single source)

| Entity | Canonical record | Written by |
|---|---|---|
| Business details | `ShopPublicProfile` (+ `ShopSettings.name/townCity/logoUrl`) | Launch wizard (`saveClientOnboardingDraft`), hub details (`saveHubDetails`), hub Colours (`saveBrandColours`) |
| Opening hours | `ShopOpeningHours` (+ `ShopOpeningException`) | Dashboard settings, onboarding, hub review apply. All use `replaceShopOpeningHours` and the shared schema. |
| Team | `Barber` (+ `BarberService`) | `/api/admin/barbers` (dashboard and hub, same handler), launch wizard bios |
| Services | `Service` | `/api/admin/services` (dashboard and hub, same handler) |
| Products | `Product` | `/api/admin/shop/products/*` (dashboard and hub) |

`ClientOnboarding.*` (address, socials, description, colours), `PreviewRequest.aboutText/instagramUrl/brand*` and `ClientOnboardingBarberProfile.bio/showOnWebsite` are **legacy mirrors**. Their screens still write them, and `getSiteData` never reads them. They can be dropped in a later batch.

### Migration

1. Migration `20261104120000_site_data_contract` is additive only (new columns with defaults, two new tables). It is deployed by the production build (`prisma migrate deploy`).
2. Backfill existing data into the canonical places (idempotent; fills only empty fields; never deletes):
   ```bash
   npx tsx scripts/site-data/backfill-canonical.ts            # dry run: prints the plan
   npx tsx scripts/site-data/backfill-canonical.ts --apply    # writes tmp/site-data-backfill/backup-*.json, then applies
   ```
   A second run plans nothing.

### Plans

A plan controls what is **published**, never what is **stored** (`src/lib/shop/kersivoAccess.ts` capabilities, unchanged). Upgrading keeps the same `ShopSettings` row, so nothing is copied. Downgrading or lapsing hides features (`planFeatures`, API 404 without `BRANDED_SITE`, `products` empty without `RETAIL`), and every record stays. Data is deleted only by the existing departure-retention and abandoned-preview purges. Covered by `src/lib/shopData/planLifecycle.test.ts`.

### Locations

Today one `ShopSettings` row is one shop and one location. The contract already returns `locations[]` and accepts `locationId`, so designs will not change when multi-location arrives. A real `Location` model touches bookings, availability and Stripe quantities, and is its own batch.
