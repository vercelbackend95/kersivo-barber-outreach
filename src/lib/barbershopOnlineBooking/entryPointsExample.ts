/**
 * Section 05 presentation data for /barbershop-online-booking — Where Bookings Start.
 *
 * Copy is claim-gated: Google is merchant-guided GBP booking-link setup (not a native Google
 * booking provider); social is a pasteable public URL only; QR uses dynamic redirect codes and
 * must not be shown as the Google booking URL. Destination blurbs distinguish Starter hosted
 * booking from Full own-domain booking after OPS verification.
 */
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { DEMO_DEFAULT_SERVICE_SLUG, DEMO_SERVICES } from '@/lib/demo/services';
import { DEMO_SHOP_NAME } from '@/lib/demo/site';

export type EntryChannelId = 'website' | 'google' | 'social' | 'qr';

export type EntryChannel = {
  id: EntryChannelId;
  label: string;
  shortLabel: string;
  body: string;
};

export type EntryQrPlacement = {
  id: 'window' | 'rebook';
  title: string;
  line: string;
  purpose: string;
};

export type EntryDestinationPreview = {
  shopName: string;
  serviceName: string;
  barberName: string;
  timeLabel: string;
  hint: string;
};

export type EntryPointsExample = {
  channels: EntryChannel[];
  destination: EntryDestinationPreview;
  starterDestination: string;
  fullDestination: string;
  qrPlacements: EntryQrPlacement[];
  /** Illustrative glass-sign asset — not a live shop redirect code and not presented as scannable. */
  qrIllustrativeSrc: string;
  qrIllustrativeAlt: string;
  bridge: string;
  disclosure: string;
};

export const ENTRY_CHANNEL_IDS: EntryChannelId[] = ['website', 'google', 'social', 'qr'];

export const ENTRY_CHANNELS: EntryChannel[] = [
  {
    id: 'website',
    label: 'Website',
    shortLabel: 'Website',
    body: 'On Full KERSIVO, customers start booking from the shop’s branded website. On Starter, they use the KERSIVO-hosted public booking page for that shop.',
  },
  {
    id: 'google',
    label: 'Google',
    shortLabel: 'Google',
    body: 'Where Google Business Profile supports it, the shop can add its authoritative booking URL. KERSIVO includes guided setup; Google decides eligibility and how the link appears.',
  },
  {
    id: 'social',
    label: 'Social',
    shortLabel: 'Social',
    body: 'A booking link on Instagram, Facebook or another profile can open the same public booking destination. KERSIVO does not offer a native Instagram booking product.',
  },
  {
    id: 'qr',
    label: 'QR',
    shortLabel: 'QR',
    body: 'An in-shop QR code can send a scanner to the shop’s current booking destination through KERSIVO’s redirect. Window and rebook placements serve passers-by and clients already in the chair.',
  },
];

export const ENTRY_QR_PLACEMENTS: EntryQrPlacement[] = [
  {
    id: 'window',
    title: 'WINDOW',
    line: 'BOOK ONLINE',
    purpose: 'Scan to book — for someone outside the shop.',
  },
  {
    id: 'rebook',
    title: 'REBOOK',
    line: 'REBOOK BEFORE YOU LEAVE',
    purpose: 'Scan to book — for a client already in the chair.',
  },
];

export const ENTRY_STARTER_DESTINATION =
  'Starter uses a KERSIVO-hosted public booking page for the shop.';

export const ENTRY_FULL_DESTINATION =
  'Full can use the shop’s branded website and verified own-domain booking destination; until that destination is verified live, the hosted booking page remains available.';

export const ENTRY_BRIDGE =
  'And when clients are already in the chair, the next booking can be just as easy to reach.';

export const ENTRY_DISCLOSURE =
  'Illustrative Cutstate demo identity. Nothing on this page activates Google, social or QR integrations, and the QR artwork shown is not a live shop code.';

export const ENTRY_QR_ILLUSTRATIVE_SRC = '/images/starter/kersivo-book-now-qr-glass-sign-640.webp';
export const ENTRY_QR_ILLUSTRATIVE_ALT =
  'Illustrative KERSIVO book-online glass sign — not a live scannable shop QR code';

function destinationPreview(): EntryDestinationPreview {
  const service = DEMO_SERVICES.find((entry) => entry.slug === DEMO_DEFAULT_SERVICE_SLUG) ?? DEMO_SERVICES[0];
  const barber = DEMO_BARBERS.find((entry) => entry.slug === 'marcus-bell') ?? DEMO_BARBERS[0];
  if (!service || !barber) {
    throw new Error('Cutstate demo service or barber missing for entry-points example.');
  }
  return {
    shopName: DEMO_SHOP_NAME,
    serviceName: service.name,
    barberName: barber.name,
    timeLabel: 'Thu 14 Jan · 11:00',
    hint: 'Service, barber and time — one booking journey',
  };
}

export function buildEntryPointsExample(): EntryPointsExample {
  return {
    channels: ENTRY_CHANNELS,
    destination: destinationPreview(),
    starterDestination: ENTRY_STARTER_DESTINATION,
    fullDestination: ENTRY_FULL_DESTINATION,
    qrPlacements: ENTRY_QR_PLACEMENTS,
    qrIllustrativeSrc: ENTRY_QR_ILLUSTRATIVE_SRC,
    qrIllustrativeAlt: ENTRY_QR_ILLUSTRATIVE_ALT,
    bridge: ENTRY_BRIDGE,
    disclosure: ENTRY_DISCLOSURE,
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
