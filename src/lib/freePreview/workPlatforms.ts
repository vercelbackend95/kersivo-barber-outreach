/** Platforms detected from links on the free-preview form. Client-safe. */

export const WORK_PLATFORM_IDS = [
  'instagram',
  'google',
  'booksy',
  'fresha',
  'treatwell',
  'nearcut',
  'setora',
  'square',
  'tiktok',
  'facebook',
  'website',
  'other',
] as const;

export type WorkPlatformId = (typeof WORK_PLATFORM_IDS)[number];

export type WorkLink = {
  platform: WorkPlatformId;
  /** Trimmed as typed. */
  value: string;
  url: string | null;
  handle: string | null;
};

export type WorkPlatformKind = 'handle' | 'domain' | 'google' | 'website' | 'other';

export type WorkPlatform = {
  id: WorkPlatformId;
  name: string;
  hosts: readonly string[];
  kind: WorkPlatformKind;
};

export const SMART_LINK_COPY = {
  label: 'Your booking page or Instagram',
  hint: "Paste a link or @handle. We'll use it for your services, prices and photos.",
  placeholder: 'booksy.com/… or @yourshop',
  supported: 'Works with Booksy, Fresha, Treatwell, Instagram, Google Maps, Facebook, TikTok or your own website.',
  addAnother: '+ Add another link (optional)',
  invalid: "That doesn't look like a link. Try pasting the full address or your @handle.",
  max: "That's plenty — 5 links is the maximum.",
  check: 'Check',
  undo: 'Undo',
  removed: 'Link removed',
  added: (name: string) => `${name} link added`,
  remove: (name: string) => `Remove ${name} link`,
  checkLabel: (name: string) => `Check ${name} link (opens in a new tab)`,
} as const;

export const WORK_LINK_VALUE_MAX = 300;
export const WORK_LINKS_MAX = 5;
export const WORK_UNDO_MS = 5000;

/** `other` no longer comes from detection; it stays so rows from the earlier picker still read correctly. */
export const WORK_PLATFORMS: readonly WorkPlatform[] = [
  { id: 'instagram', name: 'Instagram', hosts: ['instagram.com', 'instagr.am'], kind: 'handle' },
  {
    id: 'google',
    name: 'Google',
    hosts: ['maps.google.com', 'maps.app.goo.gl', 'g.page', 'g.co', 'share.google', 'business.google.com', 'google.com'],
    kind: 'google',
  },
  { id: 'booksy', name: 'Booksy', hosts: ['booksy.com'], kind: 'domain' },
  { id: 'fresha', name: 'Fresha', hosts: ['fresha.com'], kind: 'domain' },
  { id: 'treatwell', name: 'Treatwell', hosts: ['treatwell.co.uk', 'treatwell.com'], kind: 'domain' },
  { id: 'nearcut', name: 'Nearcut', hosts: ['nearcut.com', 'nearcut.co.uk'], kind: 'domain' },
  { id: 'setora', name: 'Setora', hosts: ['setora.co.uk', 'setora.com'], kind: 'domain' },
  { id: 'square', name: 'Square', hosts: ['squareup.com', 'square.site'], kind: 'domain' },
  { id: 'tiktok', name: 'TikTok', hosts: ['tiktok.com'], kind: 'handle' },
  { id: 'facebook', name: 'Facebook', hosts: ['facebook.com', 'fb.com', 'fb.me'], kind: 'domain' },
  { id: 'website', name: 'Website', hosts: [], kind: 'website' },
  { id: 'other', name: 'Other', hosts: [], kind: 'other' },
] as const;

const PLATFORM_BY_ID = new Map(WORK_PLATFORMS.map((platform) => [platform.id, platform]));

export function isWorkPlatformId(value: unknown): value is WorkPlatformId {
  return typeof value === 'string' && PLATFORM_BY_ID.has(value as WorkPlatformId);
}

export function workPlatformById(id: WorkPlatformId): WorkPlatform {
  return PLATFORM_BY_ID.get(id)!;
}

export function workPlatformName(id: WorkPlatformId): string {
  return workPlatformById(id).name;
}
