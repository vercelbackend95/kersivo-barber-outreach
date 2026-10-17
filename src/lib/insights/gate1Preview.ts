/**
 * GATE 1 magazine design-preview fixtures.
 * Design-only content — not published articles. Keep status in source, not UI.
 */

export const GATE1_PREVIEW_PATH = '/design-preview/insights' as const;

export const GATE1_PREVIEW_TITLE =
  'Barbershop Business Insights & Guides UK | KERSIVO';

export const GATE1_PREVIEW_DESCRIPTION =
  'Practical insights for independent UK barbershop owners. Explore bookings, business costs, branding, software and running a stronger shop.';

export const GATE1_MASTHEAD = {
  mark: 'KERSIVO / INSIGHTS',
  headlineLines: ['The Business', 'Behind the Chair.'] as const,
  lead: 'Business intelligence, booking insight and brand thinking for independent barbershops.',
  statementLines: [
    'PRACTICAL GUIDES.',
    'INDEPENDENT THINKING.',
    'BETTER BUSINESS DECISIONS.',
  ] as const,
  audienceLines: ['BUILT FOR UK BARBERSHOP OWNERS.'] as const,
} as const;

export const GATE1_FEATURE_DOMINANT = {
  label: 'FEATURE',
  /** Explicit line breaks for desktop editorial measure */
  titleLines: [
    'How independent shops set',
    'service prices without',
    'chasing marketplaces',
  ] as const,
  deck: 'A calm framework for cost, demand and local positioning — written for UK barbershop owners.',
  cta: 'Read the guide',
  imageSrc: '/reel-assets/carousel/chair-hero.jpg',
  imageAlt: '',
} as const;

export const GATE1_FEATURE_VERTICAL = {
  category: 'Brand & Marketing',
  coverLines: ['PRICE', 'WITH', 'INTENT'] as const,
  footer: 'A stronger shop builds a brighter tomorrow.',
  imageSrc: '/demo/gallery/fade.webp',
  imageAlt: '',
} as const;

export const GATE1_FEATURE_STACK = [
  {
    id: 'brand-remember',
    category: 'Guide',
    title: 'Build a brand people remember',
    imageSrc: '/demo/gallery/interior-detail.webp',
    imageAlt: '',
  },
  {
    id: 'next-era',
    category: 'Opinion',
    title: 'The next era of barbershops',
    imageSrc: '/demo/gallery/hairline.webp',
    imageAlt: '',
  },
] as const;

export const GATE1_TOPICS = [
  {
    id: 'business-revenue',
    name: 'Business & Revenue',
    descriptor: 'Pricing · Growth · Profit',
    icon: 'chart' as const,
  },
  {
    id: 'bookings-clients',
    name: 'Bookings & Clients',
    descriptor: 'Retention · Systems · Experience',
    icon: 'calendar' as const,
  },
  {
    id: 'brand-marketing',
    name: 'Brand & Marketing',
    descriptor: 'Identity · Local · Storytelling',
    icon: 'megaphone' as const,
  },
  {
    id: 'software-costs',
    name: 'Software & Costs',
    descriptor: 'Tools · Workflows · Value',
    icon: 'laptop' as const,
  },
  {
    id: 'industry-people',
    name: 'Industry & People',
    descriptor: 'People · Culture · The Future',
    icon: 'people' as const,
  },
] as const;

export const GATE1_LATEST = [
  {
    id: 'profitable-shop',
    category: 'Business & Revenue',
    format: 'Guide',
    title: 'What a profitable barbershop actually looks like',
    excerpt: 'Margins, chair utilisation and the numbers owners should watch every week.',
    readMinutes: 8,
    imageSrc: '/demo/gallery/interior-detail.webp',
    imageAlt: '',
  },
  {
    id: 'no-show-policy',
    category: 'Bookings & Clients',
    format: 'Guide',
    title: 'Designing a no-show policy clients will respect',
    excerpt: 'Clear rules, fair deposits and communication that protects the diary.',
    readMinutes: 6,
    imageSrc: '/demo/gallery/hairline.webp',
    imageAlt: '',
  },
  {
    id: 'own-domain',
    category: 'Brand & Marketing',
    format: 'Analysis',
    title: 'Why your own domain still wins discovery',
    excerpt: 'Marketplace convenience versus brand control when clients search for you.',
    readMinutes: 7,
    imageSrc: '/demo/gallery/beard.webp',
    imageAlt: '',
  },
  {
    id: 'software-stack',
    category: 'Software & Costs',
    format: 'Guide',
    title: 'Cutting software costs without cutting capability',
    excerpt: 'A practical way to audit tools, fees and workflows before renewing anything.',
    readMinutes: 9,
    imageSrc: '/demo/gallery/fade.webp',
    imageAlt: '',
  },
] as const;

export const GATE1_OWNERS_DESK = {
  eyebrow: 'FROM INSIGHT TO ACTION',
  heading: "The Owner's Desk.",
  lead: 'Practical tools for the decisions that shape your shop.',
  tools: [
    {
      id: 'cost-calculator',
      number: '01',
      category: 'SHOP ECONOMICS',
      title: 'Know what your software really costs.',
      description:
        "Break down subscriptions, booking fees and platform costs using your shop's numbers.",
      cta: 'Explore the Cost Calculator',
      href: '/barber-software-cost-calculator',
    },
    {
      id: 'compare-systems',
      number: '02',
      category: 'SMARTER CHOICES',
      title: 'Compare systems on your terms.',
      description:
        'Explore booking platforms and see which differences matter to an independent barbershop.',
      cta: 'Compare Booking Systems',
      href: '/compare',
    },
  ],
} as const;
