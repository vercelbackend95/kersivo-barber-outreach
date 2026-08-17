export type DemoNavItem = {
  href: string;
  label: string;
};

export const DEMO_GALLERY_HREF = '/demo/gallery';
export const DEMO_SHOP_HREF = '/demo/shop';
export const DEMO_BOOK_HREF = '/demo/book';
export const DEMO_CONTACT_HREF = '/demo/contact';
export const DEMO_HOME_HREF = '/demo';
export const DEMO_SERVICES_SECTION_HREF = '/demo#popular-services-heading';
export const DEMO_BARBERS_SECTION_HREF = '/demo#blackline-team-heading';
export const DEMO_GALLERY_SECTION_HREF = '/demo#blackline-gallery-preview-heading';
export const DEMO_KERSIVO_HREF = 'https://kersivo.co.uk';

export const DEMO_NAV: DemoNavItem[] = [
  { href: DEMO_HOME_HREF, label: 'Home' },
  { href: '/demo/services', label: 'Services' },
  { href: '/demo/barbers', label: 'Our Barbers' },
  { href: DEMO_GALLERY_HREF, label: 'Gallery' },
  { href: DEMO_SHOP_HREF, label: 'Shop' },
  { href: DEMO_CONTACT_HREF, label: 'Contact' },
];

export const DEMO_FOOTER_NAV: DemoNavItem[] = [
  { href: DEMO_HOME_HREF, label: 'Home' },
  { href: DEMO_SERVICES_SECTION_HREF, label: 'Services' },
  { href: DEMO_BARBERS_SECTION_HREF, label: 'Barbers' },
  { href: DEMO_GALLERY_SECTION_HREF, label: 'Gallery' },
  { href: DEMO_SHOP_HREF, label: 'Shop' },
  { href: DEMO_BOOK_HREF, label: 'Book an appointment' },
];

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname || '/';
}

export function formatNavIndex(index: number): string {
  return String(index + 1).padStart(2, '0');
}

export function isDemoNavActive(pathname: string, href: string): boolean {
  const current = normalizePath(pathname);
  if (href === '/demo') {
    return current === '/demo';
  }
  return current === href || current.startsWith(`${href}/`);
}
