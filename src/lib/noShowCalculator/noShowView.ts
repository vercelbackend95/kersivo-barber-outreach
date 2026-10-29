/**
 * Display strings for the no-show calculator. Shared by the server render
 * (default results without JavaScript) and the browser script, so both always
 * show identical wording. Rounds only here: 2 dp per no-show, whole pounds for
 * weekly and yearly figures.
 */
import {
  calculateNoShowCost,
  type NoShowInputs,
  type NoShowResult,
} from './noShowCalculator';

const wholePounds = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const pence = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Rounds half away from zero, absorbing float noise (4.445 → 4.45, 2.2499…96 → 2.3),
 * and avoids "−£0" for tiny negatives.
 */
function tidy(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const rounded = (Math.sign(value) * Math.round(Math.abs(value) * factor + 1e-9)) / factor;
  return rounded === 0 ? 0 : rounded;
}

/** £1,234 — whole pounds; negatives as −£12. */
export function gbp(value: number): string {
  const v = tidy(value, 0);
  return `${v < 0 ? '−' : ''}£${wholePounds.format(Math.abs(v))}`;
}

/** £4.45 — two decimals; negatives as −£4.93. */
export function gbp2(value: number): string {
  const v = tidy(value, 2);
  return `${v < 0 ? '−' : ''}£${pence.format(Math.abs(v))}`;
}

/** +£12 / −£12 / £0 for component lists. */
export function signedGbp(value: number): string {
  const v = tidy(value, 0);
  if (v === 0) return '£0';
  return `${v > 0 ? '+' : '−'}£${wholePounds.format(Math.abs(v))}`;
}

function percent(value: number): string {
  const decimals = Math.abs(value) < 10 ? 1 : 0;
  const v = tidy(value, decimals);
  return `${v.toFixed(decimals).replace(/\.0$/, '')}%`;
}

export function depositLabel(result: NoShowResult): string {
  if (result.deposit.isFullPayment) return 'full payment at booking';
  return `a ${gbp2(result.deposit.amount).replace(/\.00$/, '')} deposit`;
}

export type NoShowView = {
  noShowRate: string;
  headlineTitle: string;
  headlineSub: string;
  busyLoss: string;
  quietLoss: string;
  busyQuietSentence: string;
  depositHeading: string;
  depositNet: string;
  depositTone: 'positive' | 'neutral';
  depositSentence: string;
  depositsRetained: string;
  extraCardFees: string;
  fewerNoShows: string;
  lostBookings: string;
  breakEven: string;
  depositNote: string;
  fairnessQuiet: string;
  fairnessBusy: string;
  fairnessWarning: string;
  carrier: string;
  chart: {
    without: number;
    withDeposit: number;
    withoutLabel: string;
    withLabel: string;
    withName: string;
    /** Bar widths as a fraction of the longest bar (0–1). */
    withoutWidth: number;
    withWidth: number;
    ariaLabel: string;
  };
};

export function buildNoShowView(inputs: NoShowInputs, result: NoShowResult = calculateNoShowCost(inputs)): NoShowView {
  const dep = result.withDeposit;
  const label = depositLabel(result);
  const Label = label.charAt(0).toUpperCase() + label.slice(1);

  const headlineTitle =
    result.carrier.model === 'rent'
      ? `No-shows cost your chair renters about ${gbp(result.yearlyCost)} a year`
      : result.carrier.model === 'commission'
        ? `No-shows cost about ${gbp(result.yearlyCost)} a year`
        : `No-shows cost you about ${gbp(result.yearlyCost)} a year`;

  const subParts = [
    `${gbp(result.weeklyCost)} a week`,
    `${gbp2(result.lossPerNoShow)} per no-show`,
  ];
  if (result.servicesWorth !== null) {
    subParts.push(`about ${wholePounds.format(Math.round(result.servicesWorth))} services’ worth of contribution`);
  }

  const busy = result.lossPerNoShowBusy;
  const quiet = result.lossPerNoShowQuiet;
  let busyQuietSentence = '';
  if (busy > 0) {
    const ratio = quiet / busy;
    busyQuietSentence =
      ratio >= 1.05
        ? `A quiet-time no-show costs you ${tidy(ratio, 1).toFixed(1)}× more than a busy-time one.`
        : ratio <= 0.95
          ? `A busy-time no-show costs you ${tidy(1 / ratio, 1).toFixed(1)}× more than a quiet-time one.`
          : 'Busy-time and quiet-time no-shows cost you about the same.';
  }

  const net = dep.yearlyNetEffect;
  const netRounded = tidy(net, 0);
  const depositSentence =
    netRounded > 0
      ? `With these numbers, ${label} would leave you about ${gbp(net)} a year better off.`
      : netRounded < 0
        ? `With these numbers, ${label} would leave you about ${gbp(-net)} a year worse off.`
        : `With these numbers, ${label} would roughly break even.`;

  let breakEven: string;
  switch (dep.breakEven.kind) {
    case 'positive-at-zero':
      breakEven = `${Label} comes out ahead even if no-shows don’t fall at all.`;
      break;
    case 'reduction':
      breakEven = `A deposit breaks even if it cuts no-shows by at least ${percent(dep.breakEven.percent)}.`;
      break;
    default:
      breakEven = `With these numbers, ${label} doesn’t break even, even if no-shows stopped completely.`;
  }

  const notes: string[] = [];
  if (result.deposit.coercedToFull) {
    notes.push('Your deposit isn’t less than the service price, so it’s treated as full payment at booking.');
  }

  const fairnessWarning = result.fairness.depositAboveQuietLoss
    ? 'Your deposit is higher than your estimated net loss per no-show. Under CMA guidance, keeping more than your net loss may be harder to justify as fair. This is not legal advice.'
    : '';

  let carrier: string;
  if (result.carrier.model === 'rent') {
    carrier = `The renter loses the service; your rent arrives either way. Estimated loss to your renters: ${gbp(result.yearlyCost)} a year.`;
  } else if (result.carrier.model === 'commission') {
    const shopPct = Math.round(result.carrier.shopShare * 100);
    const barberPct = 100 - shopPct;
    carrier = `Roughly, in line with the split: the shop carries about ${gbp(result.yearlyCost * result.carrier.shopShare)} a year (${shopPct}%) and the barber about ${gbp(result.yearlyCost * result.carrier.barberShare)} (${barberPct}%).`;
  } else {
    carrier = `The shop carries the full ${gbp(result.yearlyCost)} a year.`;
  }

  const without = Math.max(0, result.yearlyCost);
  const withDeposit = Math.max(0, dep.yearlyCostWithDeposit);
  const longest = Math.max(without, withDeposit);
  const withName = result.deposit.isFullPayment ? 'With full payment at booking' : `With ${label}`;

  return {
    noShowRate: `${percent(result.noShowRate * 100)} of bookings`,
    headlineTitle,
    headlineSub: subParts.join(' · '),
    busyLoss: gbp2(busy),
    quietLoss: gbp2(quiet),
    busyQuietSentence,
    depositHeading: `Net yearly effect of ${label}`,
    depositNet: `${netRounded > 0 ? '+' : ''}${gbp(net)} a year`,
    depositTone: netRounded > 0 ? 'positive' : 'neutral',
    depositSentence,
    depositsRetained: signedGbp(dep.depositsRetained),
    extraCardFees: signedGbp(dep.extraCardFees),
    fewerNoShows: signedGbp(dep.fewerNoShows),
    lostBookings: signedGbp(dep.lostBookings),
    breakEven,
    depositNote: notes.join(' '),
    fairnessQuiet: gbp2(quiet),
    fairnessBusy: gbp2(busy),
    fairnessWarning,
    carrier,
    chart: {
      without,
      withDeposit,
      withoutLabel: gbp(without),
      withLabel: gbp(withDeposit),
      withName,
      withoutWidth: longest > 0 ? without / longest : 0,
      withWidth: longest > 0 ? withDeposit / longest : 0,
      ariaLabel: `Yearly cost of no-shows: ${gbp(without)} without a deposit, ${gbp(withDeposit)} ${withName.toLowerCase()}.`,
    },
  };
}

const CHAIR_LABELS = {
  owner: 'Owner or employed barbers',
  commission: 'Commission',
  rent: 'Self-employed chair renters',
} as const;

/** Plain-text summary for "Copy summary". */
export function buildNoShowSummary(inputs: NoShowInputs, view: NoShowView = buildNoShowView(inputs), pageUrl?: string): string {
  const chair =
    inputs.chairModel === 'commission'
      ? `${CHAIR_LABELS.commission} (barber keeps ${inputs.barberCommissionPercent}%)`
      : CHAIR_LABELS[inputs.chairModel];
  const depositType =
    inputs.depositType === 'full'
      ? 'Full payment at booking'
      : inputs.depositType === 'custom'
        ? `Fixed deposit ${gbp2(inputs.customDeposit)}`
        : 'Fixed deposit £5';

  const lines = [
    'Barbershop no-show cost — KERSIVO calculator',
    '',
    'Your numbers',
    `- Average service price: ${gbp2(inputs.price)}`,
    `- Appointments booked per week: ${inputs.appointments}`,
    `- No-shows per week: ${inputs.noShows} (${view.noShowRate})`,
    `- Weeks open per year: ${inputs.weeksOpen}`,
    `- Products per service: ${gbp2(inputs.products)}`,
    `- Card fee: ${inputs.cardFeePercent}% + ${inputs.cardFeeFixedPence}p`,
    `- Clients pay in the shop by: ${inputs.shopPayment === 'card' ? 'card' : 'cash'}`,
    `- No-shows at busy times: ${inputs.busySharePercent}%`,
    `- Chance a busy slot is refilled: ${inputs.busyRefillPercent}%`,
    `- Chance a quiet slot is refilled: ${inputs.quietRefillPercent}%`,
    `- Chair model: ${chair}`,
    `- Deposit: ${depositType}; kept if the slot is refilled: ${inputs.keepDepositWhenRefilled ? 'yes' : 'no'}`,
    `- Expected fall in no-shows: ${inputs.noShowReductionPercent}%; bookings lost: ${inputs.lostBookingsPercent}%`,
    '',
    'Results',
    `- ${view.headlineTitle}`,
    `- ${view.headlineSub}`,
    `- Loss per no-show: ${view.busyLoss} at busy times, ${view.quietLoss} at quiet times`,
    `- ${view.depositHeading}: ${view.depositNet}`,
    `- ${view.breakEven}`,
    `- ${view.carrier}`,
  ];
  if (view.fairnessWarning) lines.push(`- ${view.fairnessWarning}`);
  lines.push(
    '',
    'Estimates based on the numbers you entered. Fixed costs such as rent and fixed wages are not included because they don’t change when one client doesn’t turn up. Not financial or legal advice.',
  );
  if (pageUrl) lines.push('', pageUrl);
  return lines.join('\n');
}
