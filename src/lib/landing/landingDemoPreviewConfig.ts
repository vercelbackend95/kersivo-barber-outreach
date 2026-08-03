import { adminDemoHref } from '@/lib/admin/demoConfig';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';

export type LandingDemoPreviewVariant = 'landing' | 'adsLp';

export type LandingDemoPreviewMedia = 'carousel' | 'widget' | 'booking';

export type LandingDemoPreviewRow = {
  kicker: string;
  heading: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  ctaSameTab?: boolean;
  ctaTrack?: string;
  ghostCtaLabel?: string;
  ghostCtaHref?: string;
  media: LandingDemoPreviewMedia;
};

export type LandingDemoPreviewConfig = {
  sectionId: string;
  headingId: string;
  ariaLabelledBy: string;
  sectionClassExtra: string;
  intro: {
    kicker: string;
    heading: string;
    description: string;
  };
  rows: LandingDemoPreviewRow[];
  showMonetization: boolean;
  showMoreIncluded: boolean;
  showAdsFooter: boolean;
};

const LANDING_ROWS: LandingDemoPreviewRow[] = [
  {
    kicker: 'ADMIN PREVIEW',
    heading: "Chairs, statuses and what's next — all in one view.",
    description: "See today's bookings, chairs and statuses in one admin view.",
    ctaLabel: 'Build My Preview',
    ctaHref: '/admin/onboarding',
    ctaSameTab: true,
    ctaTrack: FUNNEL_EVENTS.plan_my_setup_click,
    ghostCtaLabel: 'Open Full Admin Demo',
    ghostCtaHref: adminDemoHref('timeline'),
    media: 'widget',
  },
  {
    kicker: 'CLIENT BOOKING PREVIEW',
    heading: 'Service, barber, time — your URL, your brand, not their app.',
    description: 'Clients choose a service, barber and time on your own domain — no app download.',
    ctaLabel: 'Build My Booking Preview',
    ctaHref: '/admin/onboarding',
    ctaSameTab: true,
    ctaTrack: FUNNEL_EVENTS.plan_my_setup_click,
    ghostCtaLabel: 'Try Example Booking Flow',
    ghostCtaHref: '/book',
    media: 'booking',
  },
  {
    kicker: 'RETAIL PICKUP PREVIEW',
    heading: 'Retail orders, pickup ready — in the same admin.',
    description: 'Clients browse products and reserve items for in-shop pickup.',
    ctaLabel: 'Build My Shop Preview',
    ctaHref: '/admin/retail-onboarding',
    ctaSameTab: true,
    ctaTrack: FUNNEL_EVENTS.plan_my_setup_click,
    ghostCtaLabel: 'Explore Example Shop',
    ghostCtaHref: '/shop',
    media: 'carousel',
  },
];

const ADS_LP_ROWS: LandingDemoPreviewRow[] = [
  {
    kicker: 'ADMIN PREVIEW',
    heading: 'Run your day from one clear admin view',
    description:
      'See bookings, clients, barbers, services and daily activity in the system used to manage your barbershop.',
    ctaLabel: 'Open full admin demo',
    ctaHref: adminDemoHref('timeline'),
    ctaSameTab: false,
    ctaTrack: FUNNEL_EVENTS.ads_lp_admin_demo_click,
    media: 'widget',
  },
  {
    kicker: 'CLIENT BOOKING PREVIEW',
    heading: 'A booking experience built around your brand',
    description:
      'Clients choose a service, barber and available time through your own branded booking experience.',
    ctaLabel: 'Try the booking flow',
    ctaHref: '/book',
    ctaSameTab: false,
    ctaTrack: FUNNEL_EVENTS.ads_lp_client_demo_click,
    media: 'booking',
  },
  {
    kicker: 'RETAIL PICKUP PREVIEW',
    heading: 'Take retail pickup orders through your own website',
    description:
      'Let clients browse products online and place pickup orders connected to your barbershop.',
    ctaLabel: 'Explore the example shop',
    ctaHref: '/shop',
    ctaSameTab: false,
    ctaTrack: FUNNEL_EVENTS.ads_lp_retail_demo_click,
    media: 'carousel',
  },
];

export function getLandingDemoPreviewConfig(
  variant: LandingDemoPreviewVariant = 'landing',
): LandingDemoPreviewConfig {
  if (variant === 'adsLp') {
    return {
      sectionId: 'demo',
      headingId: 'ads-lp-demo-heading',
      ariaLabelledBy: 'ads-lp-demo-heading',
      sectionClassExtra: 'landing-demo-preview--ads-lp',
      intro: {
        kicker: 'INSIDE THE SYSTEM',
        heading: 'See the screens your barbershop will actually use',
        description:
          'Explore the client booking experience, admin dashboard and retail pickup shop before you subscribe.',
      },
      rows: ADS_LP_ROWS,
      showMonetization: false,
      showMoreIncluded: false,
      showAdsFooter: true,
    };
  }

  return {
    sectionId: 'live-demo',
    headingId: 'landing-demo-preview-title',
    ariaLabelledBy: 'landing-demo-preview-title',
    sectionClassExtra: '',
    intro: {
      kicker: 'INSIDE THE SYSTEM',
      heading: "The same screens you'll use to run your shop.",
      description: 'Preview the booking, admin and retail screens before you choose your setup.',
    },
    rows: LANDING_ROWS,
    showMonetization: true,
    showMoreIncluded: true,
    showAdsFooter: false,
  };
}
