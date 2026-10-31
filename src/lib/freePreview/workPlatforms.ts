/** Platforms on the free-preview “Where can we see your work?” picker. Client-safe. */

export const WORK_PLATFORM_IDS = [
  'instagram',
  'google',
  'booksy',
  'fresha',
  'treatwell',
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

export type WorkPlatformMark = 'globe' | 'ellipsis' | 'mappin' | null;

export type WorkPlatformKind = 'handle' | 'domain' | 'google' | 'website' | 'other';

export type WorkPlatform = {
  id: WorkPlatformId;
  name: string;
  inputLabel: string;
  placeholder: string;
  hint: string;
  inputMode: 'text' | 'url';
  /** Official brand mark when we have one; Lucide generic marks; otherwise text-only. */
  mark: WorkPlatformMark;
  hosts: readonly string[];
  kind: WorkPlatformKind;
};

function hintFor(name: string): string {
  return `That doesn't look like a ${name} link – we'll still take it.`;
}

export const WORK_PICKER_COPY = {
  smartLabel: 'Paste any link',
  smartPlaceholder: 'e.g. your Booksy or Instagram link',
  smartUnknown: "We couldn't spot a link there – pick a platform below instead.",
  check: 'Check',
  addedTo: (name: string) => `Added to ${name}`,
  addedCount: (n: number) => `${n} added`,
  removedUndo: (name: string) => `${name} removed. Undo`,
} as const;

export const WORK_LINK_VALUE_MAX = 300;
export const WORK_LINKS_MAX = 10;
export const WORK_UNDO_MS = 5000;

export const WORK_PLATFORMS: readonly WorkPlatform[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    inputLabel: 'Your Instagram',
    placeholder: '@yourshop',
    hint: hintFor('Instagram'),
    inputMode: 'text',
    mark: null,
    hosts: ['instagram.com', 'instagr.am'],
    kind: 'handle',
  },
  {
    id: 'google',
    name: 'Google',
    inputLabel: 'Your Google listing',
    placeholder: 'Google Maps link, or shop name and town',
    hint: hintFor('Google'),
    inputMode: 'text',
    mark: 'mappin',
    hosts: ['maps.google.com', 'maps.app.goo.gl', 'g.page', 'g.co', 'business.google.com', 'google.com'],
    kind: 'google',
  },
  {
    id: 'booksy',
    name: 'Booksy',
    inputLabel: 'Your Booksy page',
    placeholder: 'Paste your Booksy link',
    hint: hintFor('Booksy'),
    inputMode: 'url',
    mark: null,
    hosts: ['booksy.com'],
    kind: 'domain',
  },
  {
    id: 'fresha',
    name: 'Fresha',
    inputLabel: 'Your Fresha page',
    placeholder: 'Paste your Fresha link',
    hint: hintFor('Fresha'),
    inputMode: 'url',
    mark: null,
    hosts: ['fresha.com'],
    kind: 'domain',
  },
  {
    id: 'treatwell',
    name: 'Treatwell',
    inputLabel: 'Your Treatwell page',
    placeholder: 'Paste your Treatwell link',
    hint: hintFor('Treatwell'),
    inputMode: 'url',
    mark: null,
    hosts: ['treatwell.co.uk', 'treatwell.com'],
    kind: 'domain',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    inputLabel: 'Your TikTok',
    placeholder: '@yourshop',
    hint: hintFor('TikTok'),
    inputMode: 'text',
    mark: null,
    hosts: ['tiktok.com'],
    kind: 'handle',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    inputLabel: 'Your Facebook page',
    placeholder: 'Page link or name',
    hint: hintFor('Facebook'),
    inputMode: 'text',
    mark: null,
    hosts: ['facebook.com', 'fb.com', 'fb.me'],
    kind: 'domain',
  },
  {
    id: 'website',
    name: 'Website',
    inputLabel: 'Your website',
    placeholder: 'yourshop.co.uk',
    hint: hintFor('Website'),
    inputMode: 'url',
    mark: 'globe',
    hosts: [],
    kind: 'website',
  },
  {
    id: 'other',
    name: 'Other',
    inputLabel: 'Anything else',
    placeholder: 'Tell us where',
    hint: hintFor('Other'),
    inputMode: 'text',
    mark: 'ellipsis',
    hosts: [],
    kind: 'other',
  },
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
