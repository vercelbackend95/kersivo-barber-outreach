export const DEMO_PAGE_HERO_ROUTES = [
  { path: '/demo/services', headingId: 'blackline-services-heading' },
  { path: '/demo/barbers', headingId: 'blackline-barbers-heading' },
  { path: '/demo/gallery', headingId: 'blackline-gallery-heading' },
  { path: '/demo/contact', headingId: 'blackline-contact-heading' },
] as const;

export type DemoPageHeroRoute = (typeof DEMO_PAGE_HERO_ROUTES)[number];
