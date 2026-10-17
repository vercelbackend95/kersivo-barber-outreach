/**
 * Section 05 presentation data for /barbershop-online-booking — Where Bookings Start.
 *
 * Copy is claim-gated: Google is merchant-guided GBP booking-link setup (not a native Google
 * booking provider); social is a pasteable public URL only; QR uses dynamic redirect codes and
 * must not be shown as the Google booking URL. Visuals are illustrative Cutstate demo only.
 */
import { DEMO_GALLERY } from '@/lib/demo/gallery';
import { DEMO_SHOP_NAME } from '@/lib/demo/site';

export type EntryChannelId = 'website' | 'google' | 'social' | 'qr';

export type EntryChannelVisual =
  | {
      kind: 'website';
      heroSrc: string;
      heroAlt: string;
      logoSrc: string;
      shopName: string;
      bookLabel: string;
    }
  | {
      kind: 'google';
      /** Original Google mark from /starter distribution scene. */
      markSrc: string;
      markAlt: string;
    }
  | {
      kind: 'instagram';
      avatarSrc: string;
      shopName: string;
      handle: string;
      bookLabel: string;
      /** Three illustrative grid thumbs — Instagram profile cue, not a live feed. */
      gridSrcs: [string, string, string];
    }
  | {
      kind: 'qr';
      src: string;
      alt: string;
      width: number;
      height: number;
      objectPosition: string;
    };

export type EntryChannel = {
  id: EntryChannelId;
  label: string;
  shortLabel: string;
  visual: EntryChannelVisual;
};

export type EntryPointsExample = {
  channels: EntryChannel[];
  qrCardSrc: string;
  qrCardAlt: string;
};

export const ENTRY_CHANNEL_IDS: EntryChannelId[] = ['website', 'google', 'social', 'qr'];

export const ENTRY_QR_CARD_SRC = '/images/starter/kersivo-book-now-qr-glass-sign-640.webp';
export const ENTRY_QR_CARD_ALT =
  'Illustrative KERSIVO book-online glass sign — not a live scannable shop QR code';

/** @deprecated Prefer ENTRY_QR_CARD_SRC */
export const ENTRY_QR_ILLUSTRATIVE_SRC = ENTRY_QR_CARD_SRC;
/** @deprecated Prefer ENTRY_QR_CARD_ALT */
export const ENTRY_QR_ILLUSTRATIVE_ALT = ENTRY_QR_CARD_ALT;

const FADE = DEMO_GALLERY.find((image) => image.id === 'fade');
const HAIRLINE = DEMO_GALLERY.find((image) => image.id === 'hairline');
const SCISSOR = DEMO_GALLERY.find((image) => image.id === 'scissor-cut');
if (!FADE || !HAIRLINE || !SCISSOR) {
  throw new Error('CUTSTATE demo gallery thumbs missing for entry-points Instagram visual.');
}

export const ENTRY_CHANNELS: EntryChannel[] = [
  {
    id: 'website',
    label: 'Website',
    shortLabel: 'Website',
    visual: {
      kind: 'website',
      heroSrc: '/demo/heroimg.webp',
      heroAlt: 'CUTSTATE demo website hero — fictional KERSIVO demonstration shop',
      logoSrc: '/demo/cutstate-logo.png',
      shopName: DEMO_SHOP_NAME,
      bookLabel: 'Book now',
    },
  },
  {
    id: 'google',
    label: 'Google',
    shortLabel: 'Google',
    visual: {
      kind: 'google',
      markSrc: '/images/starter/google-g-192.webp',
      markAlt: 'Google',
    },
  },
  {
    id: 'social',
    label: 'Social',
    shortLabel: 'Social',
    visual: {
      kind: 'instagram',
      avatarSrc: '/demo/cutstate-logo.png',
      shopName: DEMO_SHOP_NAME,
      handle: '@cutstatebarbers',
      bookLabel: 'Book',
      gridSrcs: [FADE.src, HAIRLINE.src, SCISSOR.src],
    },
  },
  {
    id: 'qr',
    label: 'QR',
    shortLabel: 'QR',
    visual: {
      kind: 'qr',
      src: ENTRY_QR_CARD_SRC,
      alt: ENTRY_QR_CARD_ALT,
      width: 640,
      height: 720,
      objectPosition: '50% 42%',
    },
  },
];

export function buildEntryPointsExample(): EntryPointsExample {
  return {
    channels: ENTRY_CHANNELS,
    qrCardSrc: ENTRY_QR_CARD_SRC,
    qrCardAlt: ENTRY_QR_CARD_ALT,
  };
}

/** Strings that must never appear in Section 05 public copy. */
export const ENTRY_BANNED_CLAIMS = [
  'reserve with google',
  'google partner',
  'guaranteed book button',
  'book button guarantee',
  'automatically edits google',
  'instagram booking api',
  'guarantees new customers',
  'improves google ranking',
  'every shop receives a kit',
  'kit has already been shipped',
] as const;
