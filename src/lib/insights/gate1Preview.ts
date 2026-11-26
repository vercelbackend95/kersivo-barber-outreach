/**
 * Editorial copy for the /insights hub masthead, vertical feature and Owner's Desk
 * (re-exported through insightsHome.ts). Not published articles.
 */

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

export const GATE1_FEATURE_VERTICAL = {
  category: 'Brand & Marketing',
  coverLines: ['PRICE', 'WITH', 'INTENT'] as const,
  footer: 'A stronger shop builds a brighter tomorrow.',
  imageSrc: '/demo/gallery/fade.webp',
  imageAlt: '',
} as const;

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
