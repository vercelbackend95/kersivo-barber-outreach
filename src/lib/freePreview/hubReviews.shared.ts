import type { PreviewContentReviewState, PreviewContentSection } from '@prisma/client';

export const HUB_REVIEW_SECTIONS = ['SERVICES', 'TEAM', 'HOURS'] as const satisfies readonly PreviewContentSection[];

export type HubReviewSection = (typeof HUB_REVIEW_SECTIONS)[number];

/** Owner proposals for these sections are closed; historical rows stay visible to ops. */
export const RETIRED_HUB_REVIEW_SECTIONS = ['SERVICES', 'TEAM'] as const satisfies readonly HubReviewSection[];
export type RetiredHubReviewSection = (typeof RETIRED_HUB_REVIEW_SECTIONS)[number];

export function isRetiredHubReviewSection(section: string): section is RetiredHubReviewSection {
  return (RETIRED_HUB_REVIEW_SECTIONS as readonly string[]).includes(section);
}

export type HubReviewCardState = 'not_checked' | 'confirmed' | 'corrections_sent' | 'updated' | 'dismissed';

export type HubReviewShopService = {
  id: string;
  name: string;
  durationMinutes: number;
  pricePence: number;
};

export type HubReviewShopBarber = {
  id: string;
  name: string;
  photoAssetId: string | null;
};

export type HubReviewShopHours = {
  dayOfWeek: number;
  open: boolean;
  start: string;
  end: string;
};

export type HubReviewShopData = {
  shopId: string;
  services: HubReviewShopService[];
  barbers: HubReviewShopBarber[];
  hours: HubReviewShopHours[];
};

export type HubReviewPublic = {
  id: string;
  section: HubReviewSection;
  state: PreviewContentReviewState;
  cardState: HubReviewCardState;
  proposal: unknown;
  opsNote: string | null;
  createdAt: string;
  appliedAt: string | null;
};

export function servicesFingerprint(services: HubReviewShopService[]): string {
  return JSON.stringify(
    [...services]
      .map((row) => ({ id: row.id, name: row.name, durationMinutes: row.durationMinutes, pricePence: row.pricePence }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
}

export function teamFingerprint(barbers: HubReviewShopBarber[]): string {
  return JSON.stringify(
    [...barbers]
      .map((row) => ({ id: row.id, name: row.name, photoAssetId: row.photoAssetId }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
}

export function hoursFingerprint(hours: HubReviewShopHours[]): string {
  return JSON.stringify([...hours].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
}

export function cardStateFromReview(state: PreviewContentReviewState | null): HubReviewCardState {
  if (!state) return 'not_checked';
  if (state === 'CONFIRMED') return 'confirmed';
  if (state === 'CORRECTIONS_SENT') return 'corrections_sent';
  if (state === 'APPLIED') return 'updated';
  return 'dismissed';
}

export function hoursToWeeklyRules(hours: HubReviewShopHours[]): Array<{
  dayOfWeek: number;
  active: boolean;
  startTime: string;
  endTime: string;
}> {
  return hours.map((day) => ({
    dayOfWeek: day.dayOfWeek,
    active: day.open,
    startTime: day.start,
    endTime: day.end,
  }));
}

export function formatGbpPence(pence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}
