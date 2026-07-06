export type Navbar17Variant = 'default' | 'landing';

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
    link: '/#contact',
    sectionId: 'contact',
    isPage: false,
    icon: 'M4 6h16v12H4V6Zm1.5 1.5L12 12l6.5-4.5',
  },
];

export function getNavbar17Items(variant: Navbar17Variant = 'default'): Navbar17Item[] {
  return variant === 'landing' ? LANDING_NAV_ITEMS : DEFAULT_NAV_ITEMS;
}

export function getNavbar17CtaLabel(variant: Navbar17Variant = 'default'): string {
  return variant === 'landing' ? 'Plan My Setup' : 'Plan my setup';
}

export function navbar17ShowsCart(variant: Navbar17Variant = 'default'): boolean {
  return variant !== 'landing';
}
