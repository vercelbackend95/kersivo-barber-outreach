import { offer } from '@/content/offer';
import { FOOTER_LEGAL_LINKS, type FooterNavItem } from '@/lib/seo/footerSocialLinks';
import {
  FREE_PREVIEW_CTA_HREF,
  FREE_PREVIEW_CTA_TRACK,
  FREE_PREVIEW_CTA_LABEL,
  SUBSCRIBE_NOW_CTA_HREF,
  SUBSCRIBE_NOW_CTA_TRACK,
} from '@/lib/freePreview/fullPlanCta';

export type FooterColumnLink = FooterNavItem & {
  track?: string;
  accent?: boolean;
};

export type FooterColumn = {
  title: string;
  links: readonly FooterColumnLink[];
};

export const FOOTER_PRODUCT_CTA: FooterColumnLink = {
  name: offer.cta.subscribeDirect,
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
      { name: 'Online booking & deposits', href: '/barbershop-online-booking' },
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
      { name: 'Cancellation policy template', href: '/barbershop-cancellation-policy-template' },
      { name: 'Chair rent vs commission calculator', href: '/chair-rent-vs-commission-calculator' },
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

/** Product-column links that replace FOOTER_PRODUCT_CTA while FREE_PREVIEW_FLOW_ENABLED is on (spec §10.2).
 *  The subscribe label is the direct Full CTA, not "Or subscribe now", so the restricted phrase
 *  stays on hero / main pricing card / final CTA only.
 */
export const FOOTER_FREE_PREVIEW_LINKS: readonly FooterColumnLink[] = [
  { name: FREE_PREVIEW_CTA_LABEL, href: FREE_PREVIEW_CTA_HREF, accent: true, track: FREE_PREVIEW_CTA_TRACK },
  { name: FOOTER_PRODUCT_CTA.name, href: SUBSCRIBE_NOW_CTA_HREF, track: SUBSCRIBE_NOW_CTA_TRACK },
];

/** Footer columns for the current flag state; with the flag off this is FOOTER_COLUMNS unchanged. */
export function getFooterColumns(freePreviewEnabled: boolean): readonly FooterColumn[] {
  if (!freePreviewEnabled) return FOOTER_COLUMNS;
  return FOOTER_COLUMNS.map((column) => ({
    ...column,
    links: column.links.flatMap((link) => (link === FOOTER_PRODUCT_CTA ? FOOTER_FREE_PREVIEW_LINKS : [link])),
  }));
}
