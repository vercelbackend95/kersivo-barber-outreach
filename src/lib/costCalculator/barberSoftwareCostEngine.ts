/**
 * Pure monthly cost engine for Booksy, Fresha and KERSIVO.
 *
 * No DOM, browser or Astro dependencies. Every price comes from the central facts modules;
 * payment processing and multi-period projections are deliberately out of scope here.
 */

import {
  BOOKSY_ADDITIONAL_USER_GBP,
  BOOKSY_BASE_PRICE_GBP,
  BOOKSY_BOOST_COMMISSION_PERCENT,
  BOOKSY_BOOST_MINIMUM_GBP,
  BOOKSY_PRICES_VAT,
} from '@/lib/seo/booksyFacts';
import { SAAS_ADDS_VAT, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS,
  requireVerifiedFreshaFact,
  type FreshaCommercialFactKey,
  type VerifiedCommercialFact,
} from '@/lib/seo/freshaFacts';
import { gbpToPence, penceToGbp, percentOfPence } from './money';
import { UK_STANDARD_VAT_PERCENT } from './vat';

/* ---------------------------------- Input ---------------------------------- */

export type CostScenarioInput = {
  bookableBarbers: number;
  monthlyAppointments: number;
  averageAppointmentValueGbp: number;
  marketplaceClients: number;
  booksyBoostEnabled: boolean;
  splitMarketplaceAssumptions: boolean;
  booksyBoostClients: number;
  freshaMarketplaceClients: number;
  freshaSmartWebsite: boolean;
  freshaClientLoyalty: boolean;
  vatRegistered: boolean;
  includePayments: boolean;
};

export type ValidationIssueCode =
  | 'not-a-number'
  | 'not-finite'
  | 'not-integer'
  | 'below-minimum'
  | 'not-boolean'
  | 'exceeds-monthly-appointments';

export type ValidationIssue = {
  field: keyof CostScenarioInput;
  code: ValidationIssueCode;
};

type NumberRule = { integer: boolean; min: number };

const NUMBER_RULES: Record<
  | 'bookableBarbers'
  | 'monthlyAppointments'
  | 'averageAppointmentValueGbp'
  | 'marketplaceClients'
  | 'booksyBoostClients'
  | 'freshaMarketplaceClients',
  NumberRule
> = {
  bookableBarbers: { integer: true, min: 1 },
  monthlyAppointments: { integer: true, min: 0 },
  averageAppointmentValueGbp: { integer: false, min: 0 },
  marketplaceClients: { integer: true, min: 0 },
  booksyBoostClients: { integer: true, min: 0 },
  freshaMarketplaceClients: { integer: true, min: 0 },
};

const BOOLEAN_FIELDS = [
  'booksyBoostEnabled',
  'splitMarketplaceAssumptions',
  'freshaSmartWebsite',
  'freshaClientLoyalty',
  'vatRegistered',
  'includePayments',
] as const satisfies readonly (keyof CostScenarioInput)[];

export function validateCostScenario(input: CostScenarioInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [field, rule] of Object.entries(NUMBER_RULES) as [keyof typeof NUMBER_RULES, NumberRule][]) {
    const value: unknown = input[field];
    if (typeof value !== 'number' || Number.isNaN(value)) {
      issues.push({ field, code: 'not-a-number' });
    } else if (!Number.isFinite(value)) {
      issues.push({ field, code: 'not-finite' });
    } else if (rule.integer && !Number.isInteger(value)) {
      issues.push({ field, code: 'not-integer' });
    } else if (value < rule.min) {
      issues.push({ field, code: 'below-minimum' });
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    if (typeof input[field] !== 'boolean') issues.push({ field, code: 'not-boolean' });
  }

  issues.push(...validateMarketplaceAgainstAppointments(input, issues));
  return issues;
}

/**
 * Qualifying new marketplace clients are appointments within the same month, so the active
 * counts cannot exceed monthly appointments. Inactive fields are never checked.
 */
function validateMarketplaceAgainstAppointments(
  input: CostScenarioInput,
  basicIssues: readonly ValidationIssue[],
): ValidationIssue[] {
  const invalid = new Set(basicIssues.map((issue) => issue.field));
  if (invalid.has('monthlyAppointments') || invalid.has('splitMarketplaceAssumptions')) return [];

  const active: (keyof typeof NUMBER_RULES)[] = input.splitMarketplaceAssumptions
    ? ['freshaMarketplaceClients']
    : ['marketplaceClients'];
  if (input.splitMarketplaceAssumptions && input.booksyBoostEnabled === true) {
    active.unshift('booksyBoostClients');
  }

  return active
    .filter((field) => !invalid.has(field) && input[field] > input.monthlyAppointments)
    .map((field) => ({ field, code: 'exceeds-monthly-appointments' }));
}

/* --------------------------------- Results --------------------------------- */

export type ProviderId = 'booksy' | 'fresha' | 'kersivo';

export type CostCategory =
  | 'subscription'
  | 'team-or-users'
  | 'acquisition'
  | 'add-ons'
  | 'commission'
  | 'payment-processing';

export type LineItemId =
  | 'booksy-base-subscription'
  | 'booksy-additional-users'
  | 'booksy-boost'
  | 'fresha-subscription'
  | 'fresha-marketplace-fees'
  | 'fresha-smart-website'
  | 'fresha-client-loyalty'
  | 'kersivo-subscription'
  | 'kersivo-additional-barbers'
  | 'kersivo-commission'
  | 'payment-processing';

export type LineItemStatus = 'calculated' | 'custom-pricing' | 'not-included';

export type CostLineItem = {
  id: LineItemId;
  category: CostCategory;
  status: LineItemStatus;
  /** Null only when the provider does not publish a price (custom pricing). */
  exVatGbp: number | null;
  vatApplies: boolean;
  quantity: number;
  unitExVatGbp: number | null;
  plan?: 'independent' | 'team' | 'enterprise';
};

export type MonthlyAmounts = {
  subscriptionExVatGbp: number;
  teamOrUserFeesExVatGbp: number;
  acquisitionFeesExVatGbp: number;
  addOnsExVatGbp: number;
  commissionExVatGbp: number;
  /** Always 0 in this stage because processing is not included, not because it is free. */
  paymentProcessingExVatGbp: number;
  subtotalExVatGbp: number;
  vatChargedGbp: number;
  cashTotalGbp: number;
  /** Ex-VAT cost for VAT-registered scenarios; null otherwise. Not tax advice. */
  estimatedNetCostIfVatRecoverableGbp: number | null;
};

export type AssumptionCode =
  | 'single-location'
  | 'shared-marketplace-clients'
  | 'split-marketplace-clients'
  | 'booksy-users-equal-bookable-barbers'
  | 'booksy-boost-first-visit-equals-average-appointment-value'
  | 'fresha-plan-from-bookable-team-members'
  | 'fresha-first-appointment-equals-average-appointment-value'
  | 'kersivo-additional-barbers-included'
  | 'kersivo-no-vat-added'
  | 'vat-recovery-depends-on-circumstances';

export type WarningCode =
  | 'fresha-marketplace-cap-unresolved'
  | 'fresha-custom-pricing-above-team-limit'
  | 'payments-not-included';

export type EngineNotice<Code extends string> = { code: Code; message: string };

export const ASSUMPTION_MESSAGES: Record<AssumptionCode, string> = {
  'single-location': 'Costs are for a single barbershop location.',
  'shared-marketplace-clients':
    'The same qualifying new marketplace client count is used for Booksy Boost and Fresha Marketplace.',
  'split-marketplace-clients':
    'Separate qualifying new client counts are used for Booksy Boost and Fresha Marketplace.',
  'booksy-users-equal-bookable-barbers':
    'Each bookable barber is treated as one Booksy user: the first is covered by the base subscription and the rest are additional users. Real Booksy accounts may be configured differently.',
  'booksy-boost-first-visit-equals-average-appointment-value':
    'The average appointment value is used as the estimated first-visit value for Booksy Boost fees.',
  'fresha-plan-from-bookable-team-members': `One bookable team member uses the Fresha Independent plan. From two up to ${FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS} bookable team members use the Team plan per bookable team member. Above ${FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS}, Fresha lists custom Enterprise pricing, so no Fresha subscription estimate is given.`,
  'fresha-first-appointment-equals-average-appointment-value':
    'The average appointment value is used as the estimated first completed appointment value for Fresha Marketplace fees.',
  'kersivo-additional-barbers-included':
    'Additional barbers are included in the KERSIVO subscription within one location.',
  'kersivo-no-vat-added': 'KERSIVO does not currently add VAT to its subscription.',
  'vat-recovery-depends-on-circumstances':
    'VAT recovery depends on your business circumstances. The net figure is an estimate, not tax advice.',
};

export const WARNING_MESSAGES: Record<WarningCode, string> = {
  'fresha-marketplace-cap-unresolved':
    'Fresha states that a maximum Marketplace new-client fee cap applies to higher-value services, but the cap amount is not published in the verified UK source. The estimate therefore applies the published percentage and minimum before any maximum cap and may overstate Marketplace fees for higher-value first visits.',
  'fresha-custom-pricing-above-team-limit':
    'Fresha lists custom Enterprise pricing above its published team size, so no subscription estimate is shown.',
  'payments-not-included':
    'Payment processing is not included in this calculation stage. A zero value does not mean processing is free.',
};

type ProviderResultBase = {
  provider: ProviderId;
  currency: 'GBP';
  paymentsIncluded: false;
  lineItems: readonly CostLineItem[];
  assumptions: readonly EngineNotice<AssumptionCode>[];
  warnings: readonly EngineNotice<WarningCode>[];
};

export type CalculatedProviderResult = ProviderResultBase & {
  status: 'calculated';
  amounts: MonthlyAmounts;
};

export type CustomPricingProviderResult = ProviderResultBase & {
  status: 'custom-pricing';
  amounts: null;
};

export type ProviderMonthlyResult = CalculatedProviderResult | CustomPricingProviderResult;

export type MonthlyCostCalculation =
  | {
      ok: true;
      scenario: CostScenarioInput;
      effectiveMarketplaceClients: { booksyBoost: number; freshaMarketplace: number };
      assumptions: readonly EngineNotice<AssumptionCode>[];
      providers: readonly [ProviderMonthlyResult, ProviderMonthlyResult, ProviderMonthlyResult];
    }
  | { ok: false; errors: readonly ValidationIssue[] };

/* --------------------------------- Helpers --------------------------------- */

const assumption = (code: AssumptionCode): EngineNotice<AssumptionCode> => ({
  code,
  message: ASSUMPTION_MESSAGES[code],
});

const warning = (code: WarningCode): EngineNotice<WarningCode> => ({
  code,
  message: WARNING_MESSAGES[code],
});

/** Internal line representation in integer pence. */
type PenceLine = Omit<CostLineItem, 'exVatGbp' | 'unitExVatGbp'> & {
  pence: number | null;
  unitPence: number | null;
};

function toLineItem(line: PenceLine): CostLineItem {
  const { pence, unitPence, ...rest } = line;
  return {
    ...rest,
    exVatGbp: pence === null ? null : penceToGbp(pence),
    unitExVatGbp: unitPence === null ? null : penceToGbp(unitPence),
  };
}

function paymentProcessingLine(): PenceLine {
  return {
    id: 'payment-processing',
    category: 'payment-processing',
    status: 'not-included',
    pence: 0,
    vatApplies: false,
    quantity: 0,
    unitPence: null,
  };
}

function summarise(lines: readonly PenceLine[], vatRegistered: boolean): MonthlyAmounts {
  const byCategory = (category: CostCategory) =>
    lines.filter((line) => line.category === category).reduce((sum, line) => sum + (line.pence ?? 0), 0);

  const subtotal = lines.reduce((sum, line) => sum + (line.pence ?? 0), 0);
  const vatable = lines.filter((line) => line.vatApplies).reduce((sum, line) => sum + (line.pence ?? 0), 0);
  const vat = percentOfPence(vatable, UK_STANDARD_VAT_PERCENT);

  return {
    subscriptionExVatGbp: penceToGbp(byCategory('subscription')),
    teamOrUserFeesExVatGbp: penceToGbp(byCategory('team-or-users')),
    acquisitionFeesExVatGbp: penceToGbp(byCategory('acquisition')),
    addOnsExVatGbp: penceToGbp(byCategory('add-ons')),
    commissionExVatGbp: penceToGbp(byCategory('commission')),
    paymentProcessingExVatGbp: penceToGbp(byCategory('payment-processing')),
    subtotalExVatGbp: penceToGbp(subtotal),
    vatChargedGbp: penceToGbp(vat),
    cashTotalGbp: penceToGbp(subtotal + vat),
    estimatedNetCostIfVatRecoverableGbp: vatRegistered ? penceToGbp(subtotal) : null,
  };
}

/** One-time acquisition fee per qualifying client: max(value × percent, minimum). */
function acquisitionFeePence(firstVisitPence: number, percent: number, minimumPence: number): number {
  return Math.max(percentOfPence(firstVisitPence, percent), minimumPence);
}

function freshaFact(key: FreshaCommercialFactKey): VerifiedCommercialFact & { vatApplies: boolean } {
  const fact = requireVerifiedFreshaFact(key);
  if (fact.vat === 'inclusive') {
    throw new Error(`Fresha fact "${key}" is VAT-inclusive; the engine only supports exclusive pricing.`);
  }
  return { ...fact, vatApplies: fact.vat === 'exclusive' };
}

function requireAmountPence(fact: VerifiedCommercialFact, key: string): number {
  if (fact.amountGbp === undefined) throw new Error(`Fresha fact "${key}" has no amount.`);
  return gbpToPence(fact.amountGbp);
}

function sharedNotices(scenario: CostScenarioInput) {
  const assumptions = [assumption('single-location')];
  if (scenario.vatRegistered) assumptions.push(assumption('vat-recovery-depends-on-circumstances'));
  const warnings = scenario.includePayments ? [warning('payments-not-included')] : [];
  return { assumptions, warnings };
}

/* --------------------------------- Booksy ---------------------------------- */

function calculateBooksy(scenario: CostScenarioInput, boostClients: number): ProviderMonthlyResult {
  const vatApplies = BOOKSY_PRICES_VAT === 'exclusive';
  const basePence = gbpToPence(BOOKSY_BASE_PRICE_GBP);
  const userPence = gbpToPence(BOOKSY_ADDITIONAL_USER_GBP);
  const additionalUsers = Math.max(scenario.bookableBarbers - 1, 0);

  const boostQuantity = scenario.booksyBoostEnabled ? boostClients : 0;
  const boostUnitPence = scenario.booksyBoostEnabled
    ? acquisitionFeePence(
        gbpToPence(scenario.averageAppointmentValueGbp),
        BOOKSY_BOOST_COMMISSION_PERCENT,
        gbpToPence(BOOKSY_BOOST_MINIMUM_GBP),
      )
    : null;

  const lines: PenceLine[] = [
    {
      id: 'booksy-base-subscription',
      category: 'subscription',
      status: 'calculated',
      pence: basePence,
      vatApplies,
      quantity: 1,
      unitPence: basePence,
    },
    {
      id: 'booksy-additional-users',
      category: 'team-or-users',
      status: 'calculated',
      pence: userPence * additionalUsers,
      vatApplies,
      quantity: additionalUsers,
      unitPence: userPence,
    },
    {
      id: 'booksy-boost',
      category: 'acquisition',
      status: 'calculated',
      pence: (boostUnitPence ?? 0) * boostQuantity,
      vatApplies,
      quantity: boostQuantity,
      unitPence: boostUnitPence,
    },
    paymentProcessingLine(),
  ];

  const shared = sharedNotices(scenario);
  const assumptions = [...shared.assumptions, assumption('booksy-users-equal-bookable-barbers')];
  if (scenario.booksyBoostEnabled) {
    assumptions.push(assumption('booksy-boost-first-visit-equals-average-appointment-value'));
  }

  return {
    provider: 'booksy',
    status: 'calculated',
    currency: 'GBP',
    paymentsIncluded: false,
    lineItems: lines.map(toLineItem),
    amounts: summarise(lines, scenario.vatRegistered),
    assumptions,
    warnings: shared.warnings,
  };
}

/* --------------------------------- Fresha ---------------------------------- */

function freshaSubscriptionLine(teamMembers: number): PenceLine {
  if (teamMembers > FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS) {
    return {
      id: 'fresha-subscription',
      category: 'subscription',
      status: 'custom-pricing',
      pence: null,
      vatApplies: freshaFact('teamPlanPerMember').vatApplies,
      quantity: teamMembers,
      unitPence: null,
      plan: 'enterprise',
    };
  }

  const isIndependent = teamMembers === 1;
  const key: FreshaCommercialFactKey = isIndependent ? 'independentPlan' : 'teamPlanPerMember';
  const fact = freshaFact(key);
  const unitPence = requireAmountPence(fact, key);

  return {
    id: 'fresha-subscription',
    category: 'subscription',
    status: 'calculated',
    pence: isIndependent ? unitPence : unitPence * teamMembers,
    vatApplies: fact.vatApplies,
    quantity: isIndependent ? 1 : teamMembers,
    unitPence,
    plan: isIndependent ? 'independent' : 'team',
  };
}

function freshaAddOnLine(
  id: 'fresha-smart-website' | 'fresha-client-loyalty',
  key: 'smartWebsiteAddOn' | 'clientLoyaltyAddOn',
  enabled: boolean,
): PenceLine {
  const fact = freshaFact(key);
  const unitPence = requireAmountPence(fact, key);
  const quantity = enabled ? 1 : 0;
  return {
    id,
    category: 'add-ons',
    status: 'calculated',
    pence: unitPence * quantity,
    vatApplies: fact.vatApplies,
    quantity,
    unitPence,
  };
}

function calculateFresha(scenario: CostScenarioInput, marketplaceClients: number): ProviderMonthlyResult {
  const marketplace = freshaFact('marketplaceNewClientFee');
  if (marketplace.percent === undefined || marketplace.minimumGbp === undefined) {
    throw new Error('Fresha Marketplace fee requires a percentage and a minimum.');
  }
  const marketplaceUnitPence = acquisitionFeePence(
    gbpToPence(scenario.averageAppointmentValueGbp),
    marketplace.percent,
    gbpToPence(marketplace.minimumGbp),
  );

  const subscription = freshaSubscriptionLine(scenario.bookableBarbers);
  const lines: PenceLine[] = [
    subscription,
    {
      id: 'fresha-marketplace-fees',
      category: 'acquisition',
      status: 'calculated',
      pence: marketplaceUnitPence * marketplaceClients,
      vatApplies: marketplace.vatApplies,
      quantity: marketplaceClients,
      unitPence: marketplaceUnitPence,
    },
    freshaAddOnLine('fresha-smart-website', 'smartWebsiteAddOn', scenario.freshaSmartWebsite),
    freshaAddOnLine('fresha-client-loyalty', 'clientLoyaltyAddOn', scenario.freshaClientLoyalty),
    paymentProcessingLine(),
  ];

  const shared = sharedNotices(scenario);
  const assumptions = [...shared.assumptions, assumption('fresha-plan-from-bookable-team-members')];
  const warnings = [...shared.warnings];

  if (marketplaceClients > 0) {
    assumptions.push(assumption('fresha-first-appointment-equals-average-appointment-value'));
    warnings.push(warning('fresha-marketplace-cap-unresolved'));
  }

  const base = {
    provider: 'fresha' as const,
    currency: 'GBP' as const,
    paymentsIncluded: false as const,
    lineItems: lines.map(toLineItem),
    assumptions,
  };

  if (subscription.status === 'custom-pricing') {
    return {
      ...base,
      status: 'custom-pricing',
      amounts: null,
      warnings: [warning('fresha-custom-pricing-above-team-limit'), ...warnings],
    };
  }

  return { ...base, status: 'calculated', amounts: summarise(lines, scenario.vatRegistered), warnings };
}

/* --------------------------------- KERSIVO --------------------------------- */

function calculateKersivo(scenario: CostScenarioInput): ProviderMonthlyResult {
  const subscriptionPence = gbpToPence(SAAS_MONTHLY_GBP);
  const additionalBarbers = Math.max(scenario.bookableBarbers - 1, 0);

  const lines: PenceLine[] = [
    {
      id: 'kersivo-subscription',
      category: 'subscription',
      status: 'calculated',
      pence: subscriptionPence,
      vatApplies: SAAS_ADDS_VAT,
      quantity: 1,
      unitPence: subscriptionPence,
    },
    {
      id: 'kersivo-additional-barbers',
      category: 'team-or-users',
      status: 'calculated',
      pence: 0,
      vatApplies: SAAS_ADDS_VAT,
      quantity: additionalBarbers,
      unitPence: 0,
    },
    {
      id: 'kersivo-commission',
      category: 'commission',
      status: 'calculated',
      pence: 0,
      vatApplies: SAAS_ADDS_VAT,
      quantity: 0,
      unitPence: 0,
    },
    paymentProcessingLine(),
  ];

  const shared = sharedNotices(scenario);
  const assumptions = [...shared.assumptions, assumption('kersivo-additional-barbers-included')];
  if (!SAAS_ADDS_VAT) assumptions.push(assumption('kersivo-no-vat-added'));

  return {
    provider: 'kersivo',
    status: 'calculated',
    currency: 'GBP',
    paymentsIncluded: false,
    lineItems: lines.map(toLineItem),
    amounts: summarise(lines, scenario.vatRegistered),
    assumptions,
    warnings: shared.warnings,
  };
}

/* ---------------------------------- Entry ---------------------------------- */

export function calculateMonthlyCosts(input: CostScenarioInput): MonthlyCostCalculation {
  const errors = validateCostScenario(input);
  if (errors.length > 0) return { ok: false, errors };

  const scenario: CostScenarioInput = { ...input };
  const effectiveMarketplaceClients = scenario.splitMarketplaceAssumptions
    ? { booksyBoost: scenario.booksyBoostClients, freshaMarketplace: scenario.freshaMarketplaceClients }
    : { booksyBoost: scenario.marketplaceClients, freshaMarketplace: scenario.marketplaceClients };

  return {
    ok: true,
    scenario,
    effectiveMarketplaceClients,
    assumptions: [
      assumption(scenario.splitMarketplaceAssumptions ? 'split-marketplace-clients' : 'shared-marketplace-clients'),
    ],
    providers: [
      calculateBooksy(scenario, effectiveMarketplaceClients.booksyBoost),
      calculateFresha(scenario, effectiveMarketplaceClients.freshaMarketplace),
      calculateKersivo(scenario),
    ],
  };
}
