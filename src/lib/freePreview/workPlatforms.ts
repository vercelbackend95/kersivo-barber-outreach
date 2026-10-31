/** Platforms on the free-preview “Where can we see your work?” picker. Client-safe. */

export const WORK_PLATFORM_IDS = [
  'instagram',
  'booksy',
  'fresha',
  'treatwell',
  'google',
  'tiktok',
  'facebook',
  'website',
  'other',
] as const;

export type WorkPlatformId = (typeof WORK_PLATFORM_IDS)[number];

export type WorkLink = {
  platform: WorkPlatformId;
  value: string;
  url: string | null;
};

export type WorkPlatformMark = 'globe' | 'ellipsis' | null;

export type WorkPlatform = {
  id: WorkPlatformId;
  name: string;
  inputLabel: string;
  placeholder: string;
  hint: string;
  inputMode: 'text' | 'url';
  /** Official brand mark when we have one; Lucide generic marks; otherwise text-only. */
  mark: WorkPlatformMark;
};

export const WORK_PLATFORMS: readonly WorkPlatform[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    inputLabel: 'Your Instagram',
    placeholder: '@yourshop',
    hint: "That doesn't look like an Instagram profile – we'll still take it.",
    inputMode: 'text',
    mark: null,
  },
  {
    id: 'booksy',
    name: 'Booksy',
    inputLabel: 'Your Booksy page',
    placeholder: 'Paste your Booksy link',
    hint: "That doesn't look like a Booksy link – we'll still take it.",
    inputMode: 'url',
    mark: null,
  },
  {
    id: 'fresha',
    name: 'Fresha',
    inputLabel: 'Your Fresha page',
    placeholder: 'Paste your Fresha link',
    hint: "That doesn't look like a Fresha link – we'll still take it.",
    inputMode: 'url',
    mark: null,
  },
  {
    id: 'treatwell',
    name: 'Treatwell',
    inputLabel: 'Your Treatwell page',
    placeholder: 'Paste your Treatwell link',
    hint: "That doesn't look like a Treatwell link – we'll still take it.",
    inputMode: 'url',
    mark: null,
  },
  {
    id: 'google',
    name: 'Google',
    inputLabel: 'Your Google listing',
    placeholder: 'Google Maps link or shop name and town',
    hint: "That doesn't look like a Google listing – we'll still take it.",
    inputMode: 'text',
    mark: null,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    inputLabel: 'Your TikTok',
    placeholder: '@yourshop',
    hint: "That doesn't look like a TikTok profile – we'll still take it.",
    inputMode: 'text',
    mark: null,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    inputLabel: 'Your Facebook page',
    placeholder: 'Page link or name',
    hint: "That doesn't look like a Facebook page – we'll still take it.",
    inputMode: 'text',
    mark: null,
  },
  {
    id: 'website',
    name: 'Website',
    inputLabel: 'Your website',
    placeholder: 'yourshop.co.uk',
    hint: "That doesn't look like a website address – we'll still take it.",
    inputMode: 'url',
    mark: 'globe',
  },
  {
    id: 'other',
    name: 'Other',
    inputLabel: 'Anything else',
    placeholder: 'Tell us where',
    hint: "We'll still take it.",
    inputMode: 'text',
    mark: 'ellipsis',
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
