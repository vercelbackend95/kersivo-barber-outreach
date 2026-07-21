export const CAROUSEL_WIDTH = 1080;
export const CAROUSEL_HEIGHT = 1080;
export const CAROUSEL_SAFE = 72;
export const CAROUSEL_FPS = 30;
export const CAROUSEL_DURATION_FRAMES = 1;

export const CAROUSEL_CHAIR_PHOTO = 'carousel/chair-hero.jpg';

export const carouselColors = {
  bg: '#080808',
  fg: '#FFFFFF',
  gold: '#C9A84C',
  goldLight: '#E2C675',
  muted: '#9A9A9A',
  brushWhite: 'rgba(255,255,255,0.92)',
  border: '#C9A84C',
} as const;

export type CarouselIconName =
  | 'monitor'
  | 'percent'
  | 'message'
  | 'shield'
  | 'xCircle'
  | 'lock'
  | 'heart';

export type CarouselLayout =
  | 'hero'
  | 'feature'
  | 'dualFeature'
  | 'pricingBox'
  | 'ctaTrust';

export type CarouselFeatureBlock = {
  icon: CarouselIconName;
  title: string;
  body: string;
};

export type CarouselTrustBadge = {
  icon: CarouselIconName;
  label: string;
};

export type CarouselSlide = {
  id: string;
  outputFile: string;
  layout: CarouselLayout;
  tagline?: string;
  headlineLines?: string[];
  goldLineIndex?: number;
  subline?: string;
  body?: string;
  icon?: CarouselIconName;
  features?: CarouselFeatureBlock[];
  pricingAmount?: string;
  pricingLabel?: string;
  pricingBullets?: string[];
  footnote?: string;
  ctaText?: string;
  trustBadges?: CarouselTrustBadge[];
  footer?: string;
  photoOpacity?: number;
  photoStrength?: 'strong' | 'medium' | 'subtle' | 'none';
};

export const CAROUSEL_SLIDES: CarouselSlide[] = [
  {
    id: 'hook',
    outputFile: 'slide-01-hook.png',
    layout: 'hero',
    tagline: 'SMART TOOLS FOR BARBERS',
    headlineLines: ['YOUR BOOKING.', 'YOUR BRAND.', 'ZERO KERSIVO COMMISSION.'],
    goldLineIndex: 2,
    subline: 'Bookings on your domain. 0% KERSIVO commission.',
    photoStrength: 'strong',
  },
  {
    id: 'booking',
    outputFile: 'slide-02-domain.png',
    layout: 'feature',
    icon: 'monitor',
    headlineLines: ['YOUR OWN', 'BOOKING WEBSITE'],
    subline: 'Professional. Branded. Yours.',
    body: 'Clients book on your URL — three taps, no app store.',
    photoStrength: 'medium',
  },
  {
    id: 'commission-sms',
    outputFile: 'slide-03-stack.png',
    layout: 'dualFeature',
    features: [
      {
        icon: 'percent',
        title: '0% KERSIVO COMMISSION',
        body: 'No Kersivo cut on bookings or retail.',
      },
      {
        icon: 'message',
        title: 'SMS REMINDERS',
        body: 'Fewer no-shows. Happier clients.',
      },
    ],
    photoStrength: 'none',
  },
  {
    id: 'pricing',
    outputFile: 'slide-04-pricing.png',
    layout: 'pricingBox',
    pricingAmount: '£39/MONTH',
    pricingLabel: 'ONGOING CARE',
    pricingBullets: [
      'Hosting',
      'Unlimited SMS reminders',
      'Support',
      'Platform updates',
      '1h tweaks/month',
    ],
    footnote:
      'No setup fee · £39/month · Live in ~2 weeks · 0% KERSIVO commission · Not VAT registered · no VAT added',
    photoStrength: 'subtle',
  },
  {
    id: 'cta',
    outputFile: 'slide-05-cta.png',
    layout: 'ctaTrust',
    ctaText: 'PLAN MY SETUP',
    trustBadges: [
      { icon: 'shield', label: 'NO LONG CONTRACT' },
      { icon: 'xCircle', label: 'CANCEL CARE ANYTIME' },
      { icon: 'lock', label: 'CLEAR FEES' },
      { icon: 'heart', label: 'BUILT FOR BARBERS' },
    ],
    footer: 'kersivo.co.uk',
    photoStrength: 'subtle',
  },
];
