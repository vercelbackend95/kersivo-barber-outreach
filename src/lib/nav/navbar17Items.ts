export type Navbar17Variant = 'default' | 'landing' | 'adsLp' | 'shop' | 'testShop';

export type Navbar17Item = {
  name: string;
  link: string;
  sectionId: string | null;
  isPage: boolean;
  icon: string;
};

const DEFAULT_NAV_ITEMS: Navbar17Item[] = [
  { name: 'Home', link: '/#home', sectionId: 'home', isPage: false, icon: 'M3 10.5 12 3l9 7.5M5 9v11h14V9' },
  {
    name: 'Paths',
    link: '/#paths',
    sectionId: 'paths',
    isPage: false,
    icon: 'M12 3v4M12 17v4M3 12h4M17 12h4M5.64 5.64l2.83 2.83M15.53 15.53l2.83 2.83M18.36 5.64l-2.83 2.83M8.47 15.53l-2.83 2.83M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  },
  {
    name: 'Pricing',
    link: '/#pricing',
    sectionId: 'pricing',
    isPage: false,
    icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  },
  {
    name: 'FAQ',
    link: '/#faq',
    sectionId: 'faq',
    isPage: false,
    icon: 'M12 17h.01M9.1 9a3 3 0 1 1 4.9 2.3c-.92.62-1.5 1.21-1.5 2.2v.5M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  },
  {
    name: 'Retail Demo',
    link: '/shop',
    sectionId: null,
    isPage: true,
    icon: 'M6 7h12l-1 13H7L6 7Zm3-3h6l1 3H8l1-3Z',
  },
  {
    name: 'Contact',
    link: '/#contact',
    sectionId: 'contact',
    isPage: false,
    icon: 'M4 6h16v12H4V6Zm1.5 1.5L12 12l6.5-4.5',
  },
];

const LANDING_NAV_ITEMS: Navbar17Item[] = [
  {
    name: 'Pricing',
    link: '#pricing',
    sectionId: 'pricing',
    isPage: false,
    icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  },
  {
    name: 'FAQ',
    link: '#faq',
    sectionId: 'faq',
    isPage: false,
    icon: 'M12 17h.01M9.1 9a3 3 0 1 1 4.9 2.3c-.92.62-1.5 1.21-1.5 2.2v.5M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  },
  {
    name: 'Contact',
    link: '#contact',
    sectionId: 'contact',
    isPage: false,
    icon: 'M4 6h16v12H4V6Zm1.5 1.5L12 12l6.5-4.5',
  },
];

/** Google Ads Core LP — in-page anchors only; contact stays in footer. */
const ADS_LP_NAV_ITEMS: Navbar17Item[] = [
  {
    name: 'Demo',
    link: '#demo',
    sectionId: 'demo',
    isPage: false,
    icon: 'M6 7h12l-1 13H7L6 7Zm3-3h6l1 3H8l1-3Z',
  },
  {
    name: 'Pricing',
    link: '#pricing',
    sectionId: 'pricing',
    isPage: false,
    icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  },
  {
    name: 'FAQ',
    link: '#faq',
    sectionId: 'faq',
    isPage: false,
    icon: 'M12 17h.01M9.1 9a3 3 0 1 1 4.9 2.3c-.92.62-1.5 1.21-1.5 2.2v.5M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  },
];

const SHOP_NAV_ITEMS: Navbar17Item[] = [
  {
    name: 'Pricing',
    link: '/#pricing',
    sectionId: 'pricing',
    isPage: false,
    icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  },
  {
    name: 'FAQ',
    link: '/#faq',
    sectionId: 'faq',
    isPage: false,
    icon: 'M12 17h.01M9.1 9a3 3 0 1 1 4.9 2.3c-.92.62-1.5 1.21-1.5 2.2v.5M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  },
  {
    name: 'Contact',
    link: '/#contact',
    sectionId: 'contact',
    isPage: false,
    icon: 'M4 6h16v12H4V6Zm1.5 1.5L12 12l6.5-4.5',
  },
];

const TEST_SHOP_NAV_ITEMS: Navbar17Item[] = [
  {
    name: 'Shop',
    link: '/admin/test-shop',
    sectionId: null,
    isPage: true,
    icon: 'M6 7h12l-1 13H7L6 7Zm3-3h6l1 3H8l1-3Z',
  },
  {
    name: 'About',
    link: '/admin/test-shop#about',
    sectionId: 'about',
    isPage: false,
    icon: 'M12 17h.01M9.1 9a3 3 0 1 1 4.9 2.3c-.92.62-1.5 1.21-1.5 2.2v.5M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  },
];

export function getNavbar17Items(variant: Navbar17Variant = 'default'): Navbar17Item[] {
  if (variant === 'landing') return LANDING_NAV_ITEMS;
  if (variant === 'adsLp') return ADS_LP_NAV_ITEMS;
  if (variant === 'shop') return SHOP_NAV_ITEMS;
  if (variant === 'testShop') return TEST_SHOP_NAV_ITEMS;
  return DEFAULT_NAV_ITEMS;
}

export function getNavbar17CtaLabel(variant: Navbar17Variant = 'default'): string {
  if (variant === 'adsLp') return 'Get started';
  if (variant === 'landing' || variant === 'shop' || variant === 'testShop') return 'Build My Preview';
  return 'Get started';
}

export function getNavbar17CtaHref(variant: Navbar17Variant = 'default'): string {
  if (variant === 'adsLp') return '#pricing';
  if (variant === 'landing' || variant === 'shop' || variant === 'testShop') return '/admin/onboarding';
  return '/#pricing';
}

export function navbar17ShowsCart(variant: Navbar17Variant = 'default'): boolean {
  return variant === 'shop' || variant === 'testShop';
}
