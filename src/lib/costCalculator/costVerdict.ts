/**
 * Live "what this means for your shop" summary beside the calculator inputs.
 * Pure and DOM-free: it only orders and subtracts the cash totals the engine already returned.
 * It never prices a provider, never ranks providers that need a quote, and never names an overall pick.
 */

import type { ProviderId } from './barberSoftwareCostEngine';
import { PROVIDER_RESULTS } from './calculatorUi';
import type { CostPeriod } from './costPeriod';
import { formatMoneyGbp } from './money';
import type { ResultsView } from './resultView';

export type VerdictBar = {
  id: ProviderId;
  name: string;
  amountGbp: number;
  /** 0–1 share of the largest calculated total, for the bar length. */
  share: number;
  isKersivo: boolean;
};

export type CostVerdict = {
  ok: boolean;
  /** Calculated providers, highest cash cost first. */
  bars: readonly VerdictBar[];
  /** Providers whose total needs the shop's own quote or unverified terms. */
  quoteNeeded: readonly string[];
  kersivoGbp: number | null;
  kersivoLabel: string;
  /** One-line headline under the KERSIVO figure. */
  headline: string;
  /** Short sentences: what the calculated gap is, provider by provider. */
  lines: readonly string[];
};

const PERIOD_WORD: Record<CostPeriod, string> = {
  monthly: 'a month',
  annual: 'over 12 months',
  threeYear: 'over 3 years',
};

const nameOf = (id: ProviderId) => PROVIDER_RESULTS.find((entry) => entry.id === id)?.name ?? id;

const joinNames = (names: readonly string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** Smallest visible bar, so a zero-cost provider still shows a sliver of track. */
const MIN_BAR_SHARE = 0.012;

/** Bar length as a 0–1 share of the largest total, never below the visible minimum. */
export function barShare(amountGbp: number, maxGbp: number): number {
  return Math.max(maxGbp > 0 ? amountGbp / maxGbp : 0, MIN_BAR_SHARE);
}

/** One bar row per provider, in the server-rendered order the client reorders. */
export const VERDICT_BAR_ROWS: readonly { id: ProviderId; name: string }[] = PROVIDER_RESULTS.map((provider) => ({
  id: provider.id,
  name: provider.id === 'kersivo' ? 'Full KERSIVO' : provider.name,
}));

export const VERDICT_INVALID = 'Check the highlighted inputs to see what your shop would pay.';

export function buildCostVerdict(view: ResultsView): CostVerdict {
  const empty: CostVerdict = {
    ok: false,
    bars: [],
    quoteNeeded: [],
    kersivoGbp: null,
    kersivoLabel: '£—',
    headline: VERDICT_INVALID,
    lines: [],
  };
  if (!view.ok) return empty;

  const calculated = view.providers.filter(
    (provider): provider is typeof provider & { cashTotalGbp: number } =>
      provider.state === 'calculated' && provider.cashTotalGbp !== null,
  );
  const max = Math.max(0, ...calculated.map((provider) => provider.cashTotalGbp));
  const bars: VerdictBar[] = calculated
    .map((provider) => ({
      id: provider.id,
      name: nameOf(provider.id),
      amountGbp: provider.cashTotalGbp,
      share: barShare(provider.cashTotalGbp, max),
      isKersivo: provider.id === 'kersivo',
    }))
    .sort((a, b) => b.amountGbp - a.amountGbp || a.name.localeCompare(b.name));

  const quoteNeeded = view.providers
    .filter((provider) => provider.state === 'custom-pricing')
    .map((provider) => nameOf(provider.id));

  const kersivo = bars.find((bar) => bar.isKersivo);
  if (!kersivo) return { ...empty, ok: true, bars, quoteNeeded };

  const when = PERIOD_WORD[view.period];
  const higher = bars.filter((bar) => !bar.isKersivo && bar.amountGbp > kersivo.amountGbp);
  const lower = bars.filter((bar) => !bar.isKersivo && bar.amountGbp < kersivo.amountGbp);
  const level = bars.filter((bar) => !bar.isKersivo && bar.amountGbp === kersivo.amountGbp);

  const lines: string[] = [];
  for (const bar of higher.slice(0, 3)) {
    lines.push(`${formatMoneyGbp(bar.amountGbp - kersivo.amountGbp)} less than ${bar.name} ${when}`);
  }
  if (level.length > 0) lines.push(`Level with ${joinNames(level.map((bar) => bar.name))}`);
  if (lower.length > 0) {
    lines.push(
      `${joinNames(lower.map((bar) => bar.name))} ${lower.length === 1 ? 'costs' : 'cost'} less on software alone. Check what each includes before you compare.`,
    );
  }

  const headline =
    higher.length > 0
      ? `On your numbers, Full KERSIVO costs less than ${higher.length} of the ${bars.length - 1} other platforms we could fully price.`
      : 'On your numbers, Full KERSIVO is one flat price for the whole shop, with your website and domain included.';

  return {
    ok: true,
    bars,
    quoteNeeded,
    kersivoGbp: kersivo.amountGbp,
    kersivoLabel: formatMoneyGbp(kersivo.amountGbp),
    headline,
    lines,
  };
}
