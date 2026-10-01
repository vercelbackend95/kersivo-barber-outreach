/** Topic icons for competitor insight cards (see InsightIcon.astro). */
export const INSIGHT_ICON_NAMES = [
  'seats',
  'storefront',
  'discovery',
  'stack',
  'network',
  'direct',
] as const;

export type InsightIconName = (typeof INSIGHT_ICON_NAMES)[number];

export type ModelComparisonItem = {
  label: string;
  descriptor: string;
  heading: string;
  points: readonly string[];
  icon: InsightIconName;
  /** Rows shown in the same order on every model so they align side by side. */
  summary?: readonly { label: string; value: string }[];
};

export type ProcessStep = { title: string; body: string };

export type InsightCardItem = {
  title: string;
  body: string;
  icon: InsightIconName;
};
