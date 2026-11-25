/**
 * /barbershop-retail-pickup: the explainer for KERSIVO Retail pickup (click and collect for a
 * barbershop's own products), including the pay-when-collecting option shipped in November 2026.
 *
 * Every fact here comes from the product code, not from marketing intent:
 * - payment modes: src/lib/shop/retailPaymentMode.ts (FULL_UPFRONT default, PAY_AT_COLLECTION)
 * - reservations, pickup reference and email: src/lib/shop/createRetailReservation.ts, orderReference.ts
 * - counter hand-over and when sales count an order: src/pages/api/admin/shop/orders/[id]/collect.ts
 * - out of stock stays listed but cannot be ordered: prisma/schema.prisma (Product.inStock)
 * - Retail pickup is a Full KERSIVO feature, not Starter: src/lib/pricing/pricingPlans.ts
 * Copy, FAQ and JSON-LD live here so tests can assert them.
 */
import { offer } from '@/content/offer';
import { HERITAGE_DEMO_SHOP_HREF } from '@/lib/demo/heritage/links';
import { FAIR_USE_INTRO, KERSIVO_COMMISSION_CLAIM, STRIPE_FEES_NOTE } from '@/lib/pricing/claimsPolicy';
import { RESERVED_UNPAID_STATUS_LABEL, RETAIL_PAYMENT_MODE_OPTIONS } from '@/lib/shop/retailPaymentMode';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const RETAIL_PICKUP_PAGE_PATH = '/barbershop-retail-pickup';
export const RETAIL_PICKUP_LAST_UPDATED_ISO = '2026-11-25';
export const RETAIL_PICKUP_LAST_UPDATED_LABEL = '25 November 2026';
export const RETAIL_PICKUP_BREADCRUMB_NAME = 'Retail pickup';

/** Price in the title: searchers comparing click-and-collect tools filter on cost first. */
export const RETAIL_PICKUP_TITLE = `Barbershop Click and Collect: £${offer.price.amount}/mo, 0% Commission`;
export const RETAIL_PICKUP_DESCRIPTION =
  `Sell pomade and beard oil on your own barbershop website. Clients pay online or in the shop when they collect. ${offer.price.full}, 0% KERSIVO commission. Stripe fees apply.`;

export const RETAIL_PICKUP_OG_IMAGE_PATH = '/images/og/barbershop-retail-pickup-1200x630.jpg';
export const RETAIL_PICKUP_OG_IMAGE_ALT = `Click and collect for your barbershop: pomade and beard oil ready to collect. KERSIVO, ${offer.price.full} ${offer.price.fullQualifier}.`;

export type RetailPickupProduct = { id: string; brand: string; name: string; pence: number; image: string; alt: string };

/**
 * The shelf every mock on the page shows (hero, checkout, phone, counter): four products from the
 * fictional Heritage Grooming demo shop, with its own prices (public/demo/heritage-grooming/js/shop-data.js)
 * and its product photographs, cropped for thumbnails into /images/retail-pickup/.
 */
export const RETAIL_PICKUP_PRODUCTS = {
  pomade: { id: 'oakmoss-firm-pomade', brand: 'Oakmoss & Iron', name: 'Firm Pomade', pence: 1800, image: '/images/retail-pickup/oakmoss-firm-pomade-320.webp', alt: 'Oakmoss & Iron Firm Pomade tin with a brass lid' },
  oil: { id: 'barrow-beard-oil', brand: 'Barrow & Pike', name: 'Beard Oil', pence: 2000, image: '/images/retail-pickup/barrow-beard-oil-320.webp', alt: 'Barrow & Pike Beard Oil in a blue glass dropper bottle' },
  shampoo: { id: 'old-quarry-shampoo', brand: 'Old Quarry', name: 'Daily Shampoo', pence: 1500, image: '/images/retail-pickup/old-quarry-shampoo-320.webp', alt: 'Old Quarry Daily Shampoo in a green pump bottle' },
  balm: { id: 'ashgrove-beard-balm', brand: 'Ashgrove', name: 'Beard Balm', pence: 1800, image: '/images/retail-pickup/ashgrove-beard-balm-320.webp', alt: 'Ashgrove Beard Balm tin with a wooden lid' },
} as const satisfies Record<string, RetailPickupProduct>;

/** The hero photo: a render of the first order on the counter, with a depth map for the 3D view. */
export const RETAIL_PICKUP_HERO_IMAGE = {
  src: '/images/retail-pickup/pickup-counter-1024.jpg',
  webp: { 720: '/images/retail-pickup/pickup-counter-720.webp', 1024: '/images/retail-pickup/pickup-counter-1024.webp' },
  width: 1024,
  height: 1024,
  alt: 'An Oakmoss & Iron Firm Pomade tin, lid off, and a Barrow & Pike Beard Oil bottle on a dark barbershop counter, ready to collect',
} as const;

export const RETAIL_PICKUP_DEMO_HREF = HERITAGE_DEMO_SHOP_HREF;

const PRICE = `${offer.price.full} ${offer.price.fullQualifier}`;
const UPFRONT = RETAIL_PAYMENT_MODE_OPTIONS.find((option) => option.mode === 'FULL_UPFRONT')!;
const AT_COLLECTION = RETAIL_PAYMENT_MODE_OPTIONS.find((option) => option.mode === 'PAY_AT_COLLECTION')!;

export const RETAIL_PICKUP_HERO = {
  eyebrow: 'Retail pickup · New: pay when collecting',
  /** H1, split into lines for the entrance. Reads as one sentence. */
  titleLines: ['Click and collect', 'for your barbershop.'] as const,
  /** Direct answer under the H1 (40–60 words) for "how do barbershops sell products online". */
  lead:
    'Clients order pomade, beard oil and the rest of your shelf on your own website, then collect it in the shop. You choose whether they pay by card when they order or reserve now and pay at the counter. No postage, no packing, no marketplace.',
  facts: [`Included in ${offer.plans.full}, ${PRICE}`, `${offer.fees.commission} · Stripe fees apply`, 'Pickup only, no delivery to run'],
  demoLabel: 'Try the retail demo',
} as const;

export const RETAIL_PICKUP_NEW = {
  id: 'whats-new',
  eyebrow: 'What’s new',
  heading: 'Two ways to pay. You pick one for your shop.',
  lead:
    'Until now every Retail pickup order was paid by card at checkout. Shops can now let clients reserve online and pay when they collect: no card at checkout, just a name and an email. Switch below to see what your client sees.',
  modes: [
    {
      id: 'upfront',
      label: UPFRONT.label,
      short: 'Pay online now',
      summary: UPFRONT.description,
      button: 'Continue to checkout',
      note: 'Ready for collection after confirmation.',
      points: [
        'Clients pay by card through Stripe Checkout, straight to your own Stripe account.',
        'The order arrives already paid, with a pickup reference in the confirmation email.',
        'Best for higher-value items, or clients you don’t know yet.',
      ],
    },
    {
      id: 'collection',
      label: AT_COLLECTION.label,
      short: 'Pay when collecting',
      summary: AT_COLLECTION.description,
      button: 'Reserve · Pay when collecting',
      note: 'Nothing to pay now. You pay in the shop when you collect.',
      points: [
        'Clients give a name and an email (a phone number is optional). No card, no Stripe step.',
        `The order shows as “${RESERVED_UNPAID_STATUS_LABEL}” until you take payment at the counter.`,
        'Best for regulars who pick up products with their next haircut.',
      ],
    },
  ],
  footnote: 'Full payment upfront stays the default. The owner changes it in Barbershop settings, and it applies to new orders.',
} as const;

export type RetailPickupChapter = { id: string; step: string; title: string; body: string };

/** The pinned journey: one order from the client’s phone to the counter. */
export const RETAIL_PICKUP_JOURNEY = {
  id: 'how-it-works',
  eyebrow: 'How it works',
  heading: 'One order, from their phone to your counter.',
  chapters: [
    {
      id: 'browse',
      step: '01',
      title: 'They order on your website',
      body: 'Your products sit on your own site under your brand, grouped by category, with prices and photos. Clients add what they want to the bag in the browser. There is no app to download.',
    },
    {
      id: 'reference',
      step: '02',
      title: 'They get a pickup reference',
      body: 'Checkout ends with a short reference such as KRV-7QM4XA and a confirmation email listing every item and the total: paid, or to pay on collection.',
    },
    {
      id: 'orders',
      step: '03',
      title: 'It lands in your Orders',
      body: 'The order appears in your dashboard under To collect, with the client’s name, items and whether it is paid. Bag it up and keep it behind the counter.',
    },
    {
      id: 'collect',
      step: '04',
      title: 'You hand it over',
      body: 'When the client quotes the reference, tap Collect. If they reserved, tap Take payment instead: the order is marked paid and collected in one step.',
    },
  ] satisfies RetailPickupChapter[],
} as const;

export const RETAIL_PICKUP_COUNTER = {
  id: 'at-the-counter',
  eyebrow: 'Try the counter',
  heading: 'Hand over three orders. Watch what counts as a sale.',
  lead:
    'This is the Orders view your team uses. Collect the paid order, then take payment for the reservations. Sales only count an order once the money is in: online, or at your counter.',
  shopName: 'Heritage Grooming',
  fictionalNote: offer.demo.fictional,
  orders: [
    { id: 'o1', reference: 'KRV-7QM4XA', client: 'Daniel R.', items: 'Firm Pomade × 1, Beard Oil × 1', totalPence: 3800, paid: true, products: ['pomade', 'oil'] },
    { id: 'o2', reference: 'KRV-H3TP9C', client: 'Marcus O.', items: 'Daily Shampoo × 2', totalPence: 3000, paid: false, products: ['shampoo'] },
    { id: 'o3', reference: 'KRV-W8LD2N', client: 'Sam K.', items: 'Beard Balm × 1', totalPence: 1800, paid: false, products: ['balm'] },
  ],
  resetLabel: 'Reset the counter',
} as const;

export const RETAIL_PICKUP_COMPARE = {
  id: 'which-to-choose',
  eyebrow: 'Which to choose',
  heading: 'Pay online or pay when collecting: side by side.',
  columns: [UPFRONT.label, AT_COLLECTION.label] as const,
  rows: [
    { label: 'When the client pays', upfront: 'At checkout, by card', collection: 'In the shop, when they collect' },
    { label: 'What checkout asks for', upfront: 'Card details through Stripe Checkout', collection: 'Name and email; phone optional' },
    { label: 'How it shows in Orders', upfront: 'Paid, to collect', collection: RESERVED_UNPAID_STATUS_LABEL },
    { label: 'At the counter', upfront: 'Collect', collection: 'Take payment, then it is paid and collected' },
    { label: 'Counts in your sales', upfront: 'When the card payment succeeds', collection: 'When you take payment at the counter' },
    { label: 'Fees', upfront: `${KERSIVO_COMMISSION_CLAIM} Stripe fees apply.`, collection: `${KERSIVO_COMMISSION_CLAIM} No Stripe fee at checkout; your usual till or card reader costs apply.` },
    { label: 'Good for', upfront: 'Pricier items and first-time buyers', collection: 'Regulars and add-ons to a haircut' },
  ],
  note: 'One setting covers the whole shop, so every product follows the mode you choose.',
} as const;

export const RETAIL_PICKUP_BENEFITS = {
  id: 'why-pickup',
  eyebrow: 'Why pickup',
  heading: 'Why sell for collection, not delivery.',
  items: [
    { id: 'no-post', title: 'No postage or packing', body: 'Products leave from your shelf to the client’s hand. No courier accounts, no lost parcels, no returns by post.' },
    { id: 'visits', title: 'Another reason to come in', body: 'A pickup brings the client back through your door, and the chair is right there when they want their next cut.' },
    { id: 'brand', title: 'Your shop, your brand', body: 'The shop lives on your own website and domain, next to your booking flow. Clients buy from you, not from a marketplace listing.' },
    { id: 'stock', title: 'Out of stock stays honest', body: 'Mark a product out of stock and it stays on your site but cannot be ordered, so nobody pays for an empty shelf.' },
    { id: 'commission', title: '0% KERSIVO commission', body: `KERSIVO takes nothing from your product sales. ${STRIPE_FEES_NOTE}` },
    { id: 'reports', title: 'Sales you can trust', body: 'Product sales sit in your reports beside bookings, and only paid orders count, so reservations never inflate the numbers.' },
  ],
} as const;

export const RETAIL_PICKUP_SETUP = {
  id: 'get-started',
  eyebrow: 'Get started',
  heading: 'From empty shelf to first order.',
  steps: [
    { title: 'Add your products', body: 'Name, price, photo, category and whether it is in stock, from the admin dashboard. Feature a few to show them first.' },
    { title: 'Choose how clients pay', body: 'Full payment upfront is the default. The owner can switch to Pay when collecting in Barbershop settings.' },
    { title: 'Place a private test order', body: 'Walk through an order yourself before you go live. Test orders are marked as test data and take no payment.' },
  ],
  planNote: `Retail pickup is part of ${offer.plans.full} at ${PRICE}, with your branded website, domain and online booking. ${offer.plans.starter} (${offer.price.starter}) covers online booking only, without the retail shop.`,
  fairUse: FAIR_USE_INTRO,
} as const;

export type RetailPickupFaqItem = { question: string; answer: string };

export const RETAIL_PICKUP_FAQ_ITEMS: readonly RetailPickupFaqItem[] = [
  {
    question: 'What is click and collect for a barbershop?',
    answer:
      'Clients order the products you sell, such as pomade, beard oil or shampoo, on your website and pick them up in your shop instead of having them posted. With KERSIVO Retail pickup the shop sits on your own branded site, and each order arrives in your dashboard with a pickup reference.',
  },
  {
    question: 'How much does click and collect cost for a barbershop?',
    answer: `With KERSIVO, Retail pickup is part of ${offer.plans.full} at ${PRICE}, together with your branded website, domain and online booking. ${offer.fees.setup}. There is 0% KERSIVO commission on product sales. ${offer.fees.stripe}`,
  },
  {
    question: 'What is new in KERSIVO Retail pickup?',
    answer:
      'Each shop can now choose how clients pay. Full payment upfront takes a card payment at checkout, as before. Pay when collecting lets clients reserve with a name and an email and pay at the counter, and the order shows as “To collect · Pay in shop” until you take payment.',
  },
  {
    question: 'Can clients reserve products and pay in the shop?',
    answer:
      'Yes, if the owner switches the shop to Pay when collecting. Checkout asks for a name and an email, with an optional phone number, and takes no card. The client gets an email with a pickup reference and the total to pay on collection.',
  },
  {
    question: 'How do I take payment for a reserved order?',
    answer:
      'Take payment at the counter however you normally do, then tap Take payment on the order in your dashboard. KERSIVO marks it paid and collected in one step, and that is the moment it starts counting in your sales.',
  },
  {
    question: 'Does KERSIVO deliver or post products?',
    answer:
      'No. Retail pickup is collection only: clients collect their order in your shop. There is no shipping, courier or delivery option to manage.',
  },
  {
    question: 'Does KERSIVO take a commission on product sales?',
    answer: `No. There is 0% KERSIVO commission on retail, as on bookings. When clients pay online, standard Stripe payment-processing fees apply and the money goes to your own Stripe account. Reserved orders paid at the counter go through your usual till or card reader.`,
  },
  {
    question: 'Which KERSIVO plan includes Retail pickup?',
    answer: `${offer.plans.full}, at ${PRICE}. It includes your branded website on your own domain, online booking and the retail pickup shop. ${offer.plans.starter} (${offer.price.starter}) is booking only and does not include the shop.`,
  },
  {
    question: 'What happens when a product is out of stock?',
    answer:
      'Mark it out of stock in the dashboard. It stays on your website so clients can still see it, but it cannot be added to an order until you mark it back in stock.',
  },
  {
    question: 'Do clients need an app or an account?',
    answer:
      'No. Clients order in the browser on your website. Paying online goes through Stripe Checkout; reserving needs only a name and an email.',
  },
  {
    question: 'Can I try it before I subscribe?',
    answer:
      'Yes. The public retail demo lets you browse products and fill a bag without paying or creating a real order. Once your shop is set up, you can place a private test order that is marked as test data.',
  },
];

export const RETAIL_PICKUP_RELATED_LINKS: readonly { href: string; label: string; description: string }[] = [
  { href: '/barbershop-online-booking', label: 'Online booking', description: 'How clients book a barber and time, with deposits or payment.' },
  { href: '/barbershop-websites', label: 'Barbershop websites', description: 'The branded website and domain your shop sits on.' },
  { href: '/pricing', label: 'Pricing', description: 'What Full KERSIVO and Starter include, billing and cancelling.' },
];

export const RETAIL_PICKUP_CLOSE = {
  heading: 'Put your shelf on your website.',
  lead: `Retail pickup comes with ${offer.plans.full}: your website, online booking and the shop, set up for you. ${PRICE}. ${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
} as const;

/** One-line summary for /llms.txt. */
export const RETAIL_PICKUP_LLMS_SUMMARY =
  `click and collect for barbershop products in Full KERSIVO (${offer.price.full} ${offer.price.fullQualifier}): clients order on the shop’s own website and collect in the shop, paying by card at checkout (Stripe fees apply) or, if the shop chooses, reserving with a name and email and paying at the counter; pickup references, an Orders view and 0% KERSIVO commission`;

function pageUrl(siteUrl: string): string {
  return `${siteUrl}${RETAIL_PICKUP_PAGE_PATH}`;
}

export function buildRetailPickupJsonLd(): Record<string, unknown>[] {
  const siteUrl = getPublicSiteUrl();
  const url = pageUrl(siteUrl);
  const organization = { '@id': getKersivoOrganizationId(siteUrl) };
  const heroImage = {
    '@type': 'ImageObject',
    url: `${siteUrl}${RETAIL_PICKUP_HERO_IMAGE.src}`,
    width: RETAIL_PICKUP_HERO_IMAGE.width,
    height: RETAIL_PICKUP_HERO_IMAGE.height,
    caption: RETAIL_PICKUP_HERO_IMAGE.alt,
  };
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: RETAIL_PICKUP_TITLE,
      description: RETAIL_PICKUP_DESCRIPTION,
      inLanguage: 'en-GB',
      dateModified: RETAIL_PICKUP_LAST_UPDATED_ISO,
      isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
      publisher: organization,
      breadcrumb: { '@id': `${url}#breadcrumb` },
      about: { '@id': `${url}#feature` },
      primaryImageOfPage: heroImage,
      keywords: 'barbershop click and collect, barber shop retail, sell barber products online, reserve and pay in store',
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['#rp-hero-title', '.rp-hero__lead'] },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': `${url}#feature`,
      name: 'KERSIVO Retail pickup',
      alternateName: 'Click and collect for barbershops',
      serviceType: 'Click and collect for barbershop retail products',
      description:
        'Barbershop clients order grooming products on the shop’s own website and collect them in the shop. The shop chooses full payment by card at checkout or reserve online and pay when collecting.',
      provider: organization,
      areaServed: { '@type': 'Country', name: 'United Kingdom' },
      audience: { '@type': 'BusinessAudience', audienceType: 'Independent barbershops' },
      image: heroImage,
      offers: {
        '@type': 'Offer',
        name: offer.plans.full,
        price: String(offer.price.amount),
        priceCurrency: 'GBP',
        url: `${siteUrl}/pricing`,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: String(offer.price.amount),
          priceCurrency: 'GBP',
          billingDuration: 'P1M',
          unitText: 'per location per month',
        },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      '@id': `${url}#how-it-works`,
      name: 'How click and collect works in a barbershop with KERSIVO',
      step: RETAIL_PICKUP_JOURNEY.chapters.map((chapter, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: chapter.title,
        text: chapter.body,
        url: `${url}#${RETAIL_PICKUP_JOURNEY.id}`,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: RETAIL_PICKUP_BREADCRUMB_NAME, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: RETAIL_PICKUP_FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];
}
