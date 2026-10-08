/**
 * Comparison criteria for the /compare Alternatives Hub.
 * Each criterion has a precise, published definition so statuses can be audited.
 */

export const HUB_CRITERION_IDS = [
  'zeroCommission',
  'ownDomain',
  'clientDataExport',
  'builtForBarbers',
  'biggerTeams',
  'deposits',
  'retail',
  'migration',
  'brandedBooking',
  'smsReminders',
  'ukSupport',
  'affordable',
] as const;

export type HubCriterionId = (typeof HUB_CRITERION_IDS)[number];

export type HubCriterion = {
  id: HubCriterionId;
  /** Filter pill label. */
  label: string;
  /** Short label used in card feature lists. */
  shortLabel: string;
  /** What the criterion measures. */
  definition: string;
  /** What qualifies as a full match. */
  yes: string;
  /** What qualifies as a partial / conditional match. */
  limited: string;
};

/** Threshold used by the "Affordable monthly pricing" criterion (GBP, before VAT, one location). */
export const HUB_AFFORDABLE_THRESHOLD_GBP = 40;

export const HUB_CRITERIA: readonly HubCriterion[] = [
  {
    id: 'zeroCommission',
    label: '0% platform commission',
    shortLabel: '0% commission',
    definition:
      'Whether the platform takes a commission or adds a booking fee on bookings. Normal card payment-processing fees are excluded and assessed separately.',
    yes: 'No platform commission and no added booking fee on any booking channel for the compared plan.',
    limited:
      '0% on direct bookings, but a marketplace new-client commission, optional promotion fee or client-paid booking fee can apply.',
  },
  {
    id: 'ownDomain',
    label: 'Own domain / website',
    shortLabel: 'Own website / domain',
    definition: 'Whether bookings can live on your own website and your own domain.',
    yes: 'A shop website on your own domain is included in the compared plan.',
    limited:
      'A website builder, mini site or booking widget for an existing website is available, but domain inclusion is not confirmed or costs extra.',
  },
  {
    id: 'clientDataExport',
    label: 'Client data export',
    shortLabel: 'Client data export',
    definition:
      'Whether the official documentation describes exporting your client list. This compares documented export capability, not legal ownership claims.',
    yes: 'A documented client-list export in a stated format (for example CSV or Excel).',
    limited:
      'Export exists but the format or fields are not stated, it is restricted by plan, or it carries caveats or charges.',
  },
  {
    id: 'builtForBarbers',
    label: 'Built for barbershops',
    shortLabel: 'Built for barbers',
    definition: 'Whether the product is positioned specifically for barbers and barbershops.',
    yes: 'The product is positioned specifically for barbers or barbershops.',
    limited:
      'A broader salon, beauty or general business platform that also serves barbershops.',
  },
  {
    id: 'biggerTeams',
    label: 'Good for bigger teams',
    shortLabel: 'Bigger teams',
    definition: 'Whether published plans support five or more bookable team members at one location.',
    yes: 'Published support for five or more bookable staff (per-seat pricing may apply).',
    limited: 'Team scheduling exists, but published team limits or pricing are unclear.',
  },
  {
    id: 'deposits',
    label: 'Booking deposits',
    shortLabel: 'Deposits',
    definition: 'Whether clients can be asked to pay a deposit when booking online.',
    yes: 'Online booking deposits are documented.',
    limited: 'Online prepayment or no-show protection is documented, but deposits are not named explicitly.',
  },
  {
    id: 'retail',
    label: 'Retail / add-on sales',
    shortLabel: 'Retail / add-ons',
    definition: 'Whether you can sell products, add-ons, packages or gift cards through the platform.',
    yes: 'Product, add-on or retail sales are documented.',
    limited: 'Retail is available only as a paid add-on, a higher plan or with unclear scope.',
  },
  {
    id: 'migration',
    label: 'Migration assistance',
    shortLabel: 'Migration help',
    definition: 'Whether the provider documents help moving from your current booking system.',
    yes: 'Migration assistance from your current system is included.',
    limited: 'Self-serve import tools are documented, without included hands-on assistance.',
  },
  {
    id: 'brandedBooking',
    label: 'Branded booking experience',
    shortLabel: 'Branded experience',
    definition: 'Whether clients book through an experience presented under your shop’s brand.',
    yes: 'A booking website or page presented under your shop’s brand is included.',
    limited:
      'Branding is possible through widgets, profiles or higher plans, or the booking journey sits alongside a marketplace profile.',
  },
  {
    id: 'smsReminders',
    label: 'SMS reminders',
    shortLabel: 'SMS reminders',
    definition: 'Whether automated SMS appointment reminders are available.',
    yes: 'Automated SMS reminders are included in the plan price (a monthly allowance is acceptable).',
    limited: 'SMS reminders are charged per message, or reminders exist but the SMS channel is not confirmed.',
  },
  {
    id: 'ukSupport',
    label: 'UK market support',
    shortLabel: 'UK-focused',
    definition: 'Whether the platform publishes UK-specific pricing, payments or service for UK shops.',
    yes: 'UK-specific pricing pages, payments or a UK service entity are published.',
    limited: 'The platform operates in the UK, but UK pricing is not published.',
  },
  {
    id: 'affordable',
    label: 'Affordable monthly pricing',
    shortLabel: 'Low monthly cost',
    definition: `Whether a published GBP entry plan costs £${HUB_AFFORDABLE_THRESHOLD_GBP}/month or less for one location, before VAT. Quote-only or non-GBP pricing is shown as not verified.`,
    yes: `A published GBP entry price of £${HUB_AFFORDABLE_THRESHOLD_GBP}/month or less for one location, before VAT.`,
    limited: 'A qualifying price is displayed, but it is a promotional price or its VAT basis is unresolved.',
  },
] as const;

/** Suggested priorities preselected on first load (labelled transparently in the UI). */
export const HUB_SUGGESTED_CRITERIA: readonly HubCriterionId[] = [
  'zeroCommission',
  'ownDomain',
  'clientDataExport',
  'builtForBarbers',
  'deposits',
  'migration',
  'brandedBooking',
];

export function getHubCriterion(id: HubCriterionId): HubCriterion {
  const criterion = HUB_CRITERIA.find((c) => c.id === id);
  if (!criterion) throw new Error(`Unknown hub criterion: ${id}`);
  return criterion;
}

export function isHubCriterionId(value: string): value is HubCriterionId {
  return (HUB_CRITERION_IDS as readonly string[]).includes(value);
}
