/**
 * Neutral cost-driver insight from structured monthly engine results.
 * Describes what drives cost; it never ranks providers or compares totals.
 * Always classified from monthly values so the display period cannot change the driver.
 */

import { FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS } from '@/lib/seo/freshaFacts';
import type {
  CalculatedProviderResult,
  MonthlyCostCalculation,
  ProviderId,
} from './barberSoftwareCostEngine';
import { formatMoneyGbp } from './money';

type ProviderAmount = { provider: ProviderId; monthlyExVatGbp: number };

export type CostInsight =
  | { kind: 'custom-pricing'; provider: 'fresha' | 'nearcut' }
  | { kind: 'acquisition'; booksyBoostGbp: number; freshaMarketplaceGbp: number; vagaroMarketplaceGbp: number }
  | { kind: 'team'; booksyUserFeesGbp: number; freshaTeamPlan: boolean; kersivoFlat: boolean }
  | { kind: 'add-ons'; freshaAddOnsGbp: number; vagaroAddOnsGbp: number }
  | { kind: 'deposit-processing'; booksyGbp: number; freshaGbp: number; vagaroGbp: number; setoraGbp: number; kersivoGbp: number }
  | { kind: 'base' };

type DriverKind = 'acquisition' | 'team' | 'add-ons' | 'deposit-processing';

/** Tie-break order when two driver categories have the same monthly amount. */
const DRIVER_PRIORITY: readonly DriverKind[] = ['acquisition', 'team', 'add-ons', 'deposit-processing'];

const amountFor = (results: readonly CalculatedProviderResult[], provider: ProviderId, pick: (r: CalculatedProviderResult) => number) => {
  const result = results.find((entry) => entry.provider === provider);
  return result ? pick(result) : 0;
};

function largest(results: readonly CalculatedProviderResult[], pick: (r: CalculatedProviderResult) => number): ProviderAmount | null {
  let best: ProviderAmount | null = null;
  for (const result of results) {
    const value = pick(result);
    if (value > 0 && (!best || value > best.monthlyExVatGbp)) best = { provider: result.provider, monthlyExVatGbp: value };
  }
  return best;
}

export function determineCostInsight(monthly: MonthlyCostCalculation): CostInsight | null {
  if (!monthly.ok) return null;
  const unpriced = monthly.providers.find((result) => result.status === 'custom-pricing');
  if (unpriced) return { kind: 'custom-pricing', provider: unpriced.provider === 'nearcut' ? 'nearcut' : 'fresha' };

  const calculated = monthly.providers.filter(
    (result): result is CalculatedProviderResult => result.status === 'calculated',
  );
  const candidates: Record<DriverKind, ProviderAmount | null> = {
    acquisition: largest(calculated, (r) => r.amounts.acquisitionFeesExVatGbp),
    team: largest(calculated, (r) => r.amounts.teamOrUserFeesExVatGbp),
    'add-ons': largest(calculated, (r) => r.amounts.addOnsExVatGbp),
    'deposit-processing': monthly.scenario.includeDepositProcessing
      ? largest(calculated, (r) => r.amounts.paymentProcessingExVatGbp)
      : null,
  };

  let driver: DriverKind | null = null;
  for (const kind of DRIVER_PRIORITY) {
    const candidate = candidates[kind];
    if (!candidate) continue;
    if (!driver || candidate.monthlyExVatGbp > candidates[driver]!.monthlyExVatGbp) driver = kind;
  }

  switch (driver) {
    case 'acquisition':
      return {
        kind: 'acquisition',
        booksyBoostGbp: amountFor(calculated, 'booksy', (r) => r.amounts.acquisitionFeesExVatGbp),
        freshaMarketplaceGbp: amountFor(calculated, 'fresha', (r) => r.amounts.acquisitionFeesExVatGbp),
        vagaroMarketplaceGbp: amountFor(calculated, 'vagaro', (r) => r.amounts.acquisitionFeesExVatGbp),
      };
    case 'team': {
      const fresha = calculated.find((entry) => entry.provider === 'fresha');
      const kersivo = calculated.find((entry) => entry.provider === 'kersivo');
      return {
        kind: 'team',
        booksyUserFeesGbp: amountFor(calculated, 'booksy', (r) => r.amounts.teamOrUserFeesExVatGbp),
        freshaTeamPlan: fresha?.lineItems.some((line) => line.plan === 'team') ?? false,
        kersivoFlat:
          kersivo !== undefined &&
          kersivo.amounts.teamOrUserFeesExVatGbp === 0 &&
          kersivo.lineItems.some((line) => line.id === 'kersivo-additional-barbers' && line.quantity > 0),
      };
    }
    case 'add-ons':
      return { kind: 'add-ons', freshaAddOnsGbp: amountFor(calculated, 'fresha', (r) => r.amounts.addOnsExVatGbp), vagaroAddOnsGbp: amountFor(calculated, 'vagaro', (r) => r.amounts.addOnsExVatGbp) };
    case 'deposit-processing': {
      const processing = (provider: ProviderId) =>
        amountFor(calculated, provider, (r) => r.amounts.paymentProcessingExVatGbp);
      return {
        kind: 'deposit-processing',
        booksyGbp: processing('booksy'),
        freshaGbp: processing('fresha'),
        vagaroGbp: processing('vagaro'),
        setoraGbp: processing('setora'),
        kersivoGbp: processing('kersivo'),
      };
    }
    default:
      return { kind: 'base' };
  }
}

const perMonth = (gbp: number) => `${formatMoneyGbp(gbp)}/month before VAT`;

export function describeCostInsight(insight: CostInsight): string {
  switch (insight.kind) {
    case 'custom-pricing':
      return insight.provider === 'nearcut'
        ? 'Nearcut Subscription requires a shop-specific quote or confirmed processing terms. The calculator does not guess missing fees, so a complete five-provider total is not available.'
        : `Fresha moves to custom Enterprise pricing above ${FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS} bookable team members, so a complete cost comparison is not available.`;
    case 'acquisition': {
      const parts = [
        insight.booksyBoostGbp > 0 ? `Booksy Boost ${perMonth(insight.booksyBoostGbp)}` : '',
        insight.freshaMarketplaceGbp > 0 ? `Fresha Marketplace ${perMonth(insight.freshaMarketplaceGbp)}` : '',
        insight.vagaroMarketplaceGbp > 0 ? `Vagaro Marketplace ${perMonth(insight.vagaroMarketplaceGbp)}` : '',
      ].filter(Boolean);
      return `New-client acquisition is the largest modelled variable cost in this scenario. Estimated fees: ${parts.join('; ')}. Each provider’s actual acquired-client count can differ; Vagaro excludes direct and returning clients.`;
    }
    case 'team': {
      const parts = [`Booksy adds ${perMonth(insight.booksyUserFeesGbp)} in additional-user fees`];
      if (insight.freshaTeamPlan) parts.push('Fresha prices its Team plan per bookable team member');
      const list = parts.join(', and ');
      const kersivo = insight.kersivoFlat
        ? ' KERSIVO stays flat per location in this single-location model.'
        : '';
      return `Team size is the largest modelled variable cost in this scenario. ${list}.${kersivo}`;
    }
    case 'add-ons': {
      const parts = [
        insight.freshaAddOnsGbp > 0 ? `Fresha ${perMonth(insight.freshaAddOnsGbp)}` : '',
        insight.vagaroAddOnsGbp > 0 ? `Vagaro MySite ${perMonth(insight.vagaroAddOnsGbp)}` : '',
      ].filter(Boolean);
      return `Optional add-ons are the largest modelled variable cost in this scenario: ${parts.join('; ')}.`;
    }
    case 'deposit-processing': {
      const month = (gbp: number) => `${formatMoneyGbp(gbp)}/month`;
      return `Booking deposit processing is the largest modelled variable cost in this scenario. Under the entered deposit volume, the processing estimates are ${month(insight.booksyGbp)} for Booksy, ${month(insight.freshaGbp)} for Fresha, ${month(insight.vagaroGbp)} for Vagaro, ${month(insight.setoraGbp)} for Setora/Stripe and ${month(insight.kersivoGbp)} for KERSIVO/Stripe before provider VAT where applicable.`;
    }
    case 'base':
      return 'Base subscription pricing is the main modelled cost in this scenario.';
  }
}
