import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { FOOTER_LEGAL_LINKS, type FooterNavItem } from '@/lib/seo/footerSocialLinks';

export type FooterColumnLink = FooterNavItem & {
  track?: string;
  accent?: boolean;
};

export type FooterColumn = {
  title: string;
  links: readonly FooterColumnLink[];
};

export const FOOTER_PRODUCT_CTA: FooterColumnLink = {
  name: `Start Full KERSIVO — £${SAAS_MONTHLY_GBP}/month`,
  href: '/admin/launch',
  track: 'saas_subscribe_click',
  accent: true,
};

export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { name: 'Full KERSIVO', href: '/pricing#plan' },
      { name: 'Barbershop websites', href: '/barbershop-websites' },
      { name: 'Online booking', href: '/barbershop-online-booking' },
      { name: 'KERSIVO Starter', href: '/starter' },
      { name: 'Pricing', href: '/pricing' },
      { name: 'Live demo', href: '/demo' },
      FOOTER_PRODUCT_CTA,
    ],
  },
  {
    title: 'Compare',
    links: [
      { name: 'Compare booking systems', href: '/compare' },
      { name: 'Cost calculator', href: '/barber-software-cost-calculator' },
      { name: 'No-show cost calculator', href: '/barbershop-no-show-calculator' },
      { name: 'Booksy alternative', href: '/booksy-alternative' },
      { name: 'Fresha alternative', href: '/fresha-alternative' },
      { name: 'Treatwell alternative', href: '/treatwell-alternative' },
      { name: 'Nearcut alternative', href: '/nearcut-alternative' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { name: 'Insights', href: '/insights' },
      { name: 'Website design guide', href: '/barbershop-website-design' },
      { name: 'About KERSIVO', href: '/about' },
      { name: 'Contact', href: '/#contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      FOOTER_LEGAL_LINKS.privacy,
      FOOTER_LEGAL_LINKS.cookies,
      FOOTER_LEGAL_LINKS.cookieSettings,
      FOOTER_LEGAL_LINKS.dpa,
      FOOTER_LEGAL_LINKS.termsAndCancellation,
    ],
  },
];
