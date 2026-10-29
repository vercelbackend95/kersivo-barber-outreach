/**
 * Text builder for the free barbershop cancellation policy template
 * (/barbershop-cancellation-policy-template). Pure and browser-safe: no DOM, no storage.
 *
 * Output is assembled from small sentence blocks so every option combination stays
 * grammatical, rather than one hardcoded paragraph per combination.
 */

export type DepositType = 'none' | 'fixed' | 'full';
export type PaymentOutcome = 'keep_deposit' | 'keep_payment' | 'future_deposit';
export type LateAction = 'shorten' | 'no_show';
export type CancelMethod = 'link' | 'phone' | 'instagram';
export type PolicyTone = 'friendly' | 'direct';

export const NOTICE_HOURS = [12, 24, 48] as const;
export const GRACE_MINUTES = [5, 10, 15] as const;
export const PRESET_DEPOSITS_GBP = [5, 10] as const;
export const CANCEL_METHODS: readonly CancelMethod[] = ['link', 'phone', 'instagram'];

export type NoticeHours = (typeof NOTICE_HOURS)[number];
export type GraceMinutes = (typeof GRACE_MINUTES)[number];

export const MIN_DEPOSIT_GBP = 1;
export const MAX_DEPOSIT_GBP = 50;
/** Above this a gentle, non-blocking guidance note is shown (guidance, not a statistic). */
export const LARGE_DEPOSIT_WARNING_ABOVE_GBP = 20;
export const SHOP_NAME_MAX_LENGTH = 60;
export const PHONE_MAX_LENGTH = 20;

export const SHORT_VERSION_MAX_CHARS = 500;
export const ONE_LINE_MAX_CHARS = 160;

export const POLICY_HEADING = 'Cancellation & No-Show Policy';

export type PolicyOptions = {
  shopName: string;
  deposit: DepositType;
  /** Whole pounds; only used when `deposit` is 'fixed'. */
  depositAmount: number;
  /** Fixed deposit only: the deposit counts towards the service price. */
  depositDeducted: boolean;
  noticeHours: NoticeHours;
  lateCancel: PaymentOutcome;
  noShow: PaymentOutcome;
  graceMinutes: GraceMinutes;
  lateAction: LateAction;
  cancelMethods: CancelMethod[];
  /** Shown only when 'phone' is a cancel method. Never stored or put in the URL. */
  phone: string;
  tone: PolicyTone;
};

export const DEFAULT_POLICY_OPTIONS: Readonly<PolicyOptions> = Object.freeze<PolicyOptions>({
  shopName: '',
  deposit: 'fixed',
  depositAmount: 5,
  depositDeducted: true,
  noticeHours: 24,
  lateCancel: 'keep_deposit',
  noShow: 'keep_deposit',
  graceMinutes: 10,
  lateAction: 'shorten',
  cancelMethods: ['link'],
  phone: '',
  tone: 'friendly',
});

/** Which payment outcomes make sense for a deposit type. */
export function allowedOutcomes(deposit: DepositType): PaymentOutcome[] {
  if (deposit === 'fixed') return ['keep_deposit', 'future_deposit'];
  if (deposit === 'full') return ['keep_payment', 'future_deposit'];
  return ['future_deposit'];
}

/**
 * Map an outcome onto the chosen deposit type: "keep" swaps between deposit and
 * prepayment, and anything that cannot apply (e.g. "Deposit is kept" with no deposit)
 * falls back to "No charge, but a deposit is required for future bookings".
 */
export function normaliseOutcome(outcome: PaymentOutcome, deposit: DepositType): PaymentOutcome {
  if (outcome === 'future_deposit' || deposit === 'none') return 'future_deposit';
  return deposit === 'fixed' ? 'keep_deposit' : 'keep_payment';
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
}

function oneOf<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Coerce any (possibly partial or hostile) input into a valid, consistent option set. */
export function normalisePolicyOptions(input: Partial<PolicyOptions> = {}): PolicyOptions {
  const d = DEFAULT_POLICY_OPTIONS;
  const deposit = oneOf<DepositType>(input.deposit, ['none', 'fixed', 'full'], d.deposit);
  const rawAmount = Math.round(Number(input.depositAmount));
  const depositAmount = Number.isFinite(rawAmount)
    ? Math.min(MAX_DEPOSIT_GBP, Math.max(MIN_DEPOSIT_GBP, rawAmount))
    : d.depositAmount;
  const methods = Array.isArray(input.cancelMethods)
    ? CANCEL_METHODS.filter((method) => input.cancelMethods!.includes(method))
    : [...d.cancelMethods];

  return {
    shopName: cleanText(input.shopName, SHOP_NAME_MAX_LENGTH),
    deposit,
    depositAmount,
    depositDeducted: typeof input.depositDeducted === 'boolean' ? input.depositDeducted : d.depositDeducted,
    noticeHours: oneOf(Number(input.noticeHours), NOTICE_HOURS, d.noticeHours),
    lateCancel: normaliseOutcome(
      oneOf<PaymentOutcome>(input.lateCancel, ['keep_deposit', 'keep_payment', 'future_deposit'], d.lateCancel),
      deposit,
    ),
    noShow: normaliseOutcome(
      oneOf<PaymentOutcome>(input.noShow, ['keep_deposit', 'keep_payment', 'future_deposit'], d.noShow),
      deposit,
    ),
    graceMinutes: oneOf(Number(input.graceMinutes), GRACE_MINUTES, d.graceMinutes),
    lateAction: oneOf<LateAction>(input.lateAction, ['shorten', 'no_show'], d.lateAction),
    cancelMethods: methods.length > 0 ? methods : [...d.cancelMethods],
    phone: cleanText(input.phone, PHONE_MAX_LENGTH),
    tone: oneOf<PolicyTone>(input.tone, ['friendly', 'direct'], d.tone),
  };
}

/* ----------------------------- Sentence blocks ----------------------------- */

type Ctx = PolicyOptions & { friendly: boolean; paid: string };

function paidNoun(o: PolicyOptions): string {
  return o.deposit === 'full' ? 'payment' : 'deposit';
}

function introBlock(c: Ctx): string {
  if (c.deposit === 'none') {
    return c.friendly
      ? 'We don’t take a deposit, so we rely on you to let us know if your plans change.'
      : 'No deposit is taken.';
  }
  if (c.deposit === 'full') {
    return c.friendly ? 'Appointments are paid in full when you book.' : 'Full payment is taken at booking.';
  }
  const intro = c.friendly
    ? `We ask for a £${c.depositAmount} deposit to secure your appointment.`
    : `A £${c.depositAmount} deposit is required to book.`;
  const deducted = c.depositDeducted
    ? c.friendly
      ? 'It comes off the price of your service.'
      : 'It is deducted from the service price.'
    : c.friendly
      ? 'It is not taken off the price of your service.'
      : 'It is not deducted from the service price.';
  return `${intro} ${deducted}`;
}

function freeCancelBlock(c: Ctx): string {
  const h = c.noticeHours;
  if (c.friendly) {
    const tail = c.deposit === 'none' ? '' : ` — your ${c.paid} will be refunded or moved to your new time`;
    return `You can cancel or rebook free of charge up to ${h} hours before your appointment${tail}.`;
  }
  const tail = c.deposit === 'none' ? '' : `; your ${c.paid} is refunded or moved`;
  return `Free cancellation or rebooking up to ${h} hours before your appointment${tail}.`;
}

function lateCancelBlock(c: Ctx): string {
  const lead = c.friendly ? `If you cancel within ${c.noticeHours} hours,` : `Cancel within ${c.noticeHours} hours and`;
  switch (c.lateCancel) {
    case 'keep_deposit':
      return `${lead} the deposit is kept.`;
    case 'keep_payment':
      return `${lead} the payment is non-refundable.`;
    default:
      return c.friendly
        ? `${lead} we may ask for a deposit on your future bookings.`
        : `${lead} a deposit may be required for future bookings.`;
  }
}

function noShowBlock(c: Ctx): string {
  switch (c.noShow) {
    case 'keep_deposit':
      return c.friendly ? 'If you don’t turn up, the deposit is kept.' : 'No-shows lose the deposit.';
    case 'keep_payment':
      return c.friendly ? 'If you don’t turn up, the payment is non-refundable.' : 'No-shows are not refunded.';
    default:
      return c.friendly
        ? 'If you don’t turn up, we’ll ask for a deposit on future bookings.'
        : 'After a no-show, a deposit is required for future bookings.';
  }
}

function latenessBlock(c: Ctx): string {
  const m = c.graceMinutes;
  if (c.lateAction === 'no_show') {
    return c.friendly
      ? `Running late? Please let us know. After ${m} minutes your appointment counts as a no-show.`
      : `More than ${m} minutes late counts as a no-show.`;
  }
  return c.friendly
    ? `Running late? We’ll always try to fit you in, but after ${m} minutes we may need to shorten your service or ask you to rebook.`
    : `More than ${m} minutes late and we may shorten your service or ask you to rebook.`;
}

function shopCancelBlock(c: Ctx): string {
  if (c.deposit === 'none') {
    return c.friendly
      ? 'If we ever need to cancel or move your appointment, we’ll let you know as soon as we can.'
      : 'If we cancel or move your appointment, we will tell you as soon as possible.';
  }
  return c.friendly
    ? 'If we ever need to cancel or move your appointment, you’ll get a full refund of anything you’ve paid.'
    : 'If we cancel or move your appointment, you get a full refund of anything you’ve paid.';
}

function joinOr(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`;
}

function methodPhrase(method: CancelMethod, c: Ctx): string {
  if (method === 'phone') return c.phone ? `call us on ${c.phone}` : 'call us';
  if (method === 'instagram') return 'send us a message on Instagram';
  return 'use the link in your confirmation email';
}

function howToCancelBlock(c: Ctx): string {
  return `To cancel or rebook, ${joinOr(c.cancelMethods.map((m) => methodPhrase(m, c)))}.`;
}

const CLOSING_FRIENDLY = 'Thanks for understanding — it helps us keep our diary fair for every client.';

/* --------------------------------- Builders -------------------------------- */

export type PolicyVersions = {
  /** Website version heading, e.g. "Fade Room — Cancellation & No-Show Policy". */
  heading: string;
  /** Website version bullet sentences (rendered with "• " in plain text). */
  bullets: string[];
  /** Friendly tone only: a closing line after the bullets. */
  closing: string | null;
  /** A) Full website version as plain text. */
  website: string;
  /** B) ≤ 500 characters, plain sentences. */
  short: string;
  /** C) ≤ 160 characters, one line. */
  oneLine: string;
};

function ctx(options: PolicyOptions): Ctx {
  return { ...options, friendly: options.tone === 'friendly', paid: paidNoun(options) };
}

/** Joins sentence pieces, dropping optional pieces (lowest priority first) until it fits. */
function fit(pieces: { text: string; priority: number }[], max: number): string {
  const kept = [...pieces];
  const render = () => kept.map((piece) => piece.text).join(' ');
  while (render().length > max) {
    const optional = kept.filter((piece) => piece.priority > 0);
    if (optional.length === 0) break;
    const drop = optional.reduce((a, b) => (b.priority > a.priority ? b : a));
    kept.splice(kept.indexOf(drop), 1);
  }
  return render();
}

/** B) Compact blocks so the shop-cancels refund rule always fits within 500 characters. */
function shortVersion(c: Ctx): string {
  const h = c.noticeHours;
  const intro =
    c.deposit === 'fixed'
      ? `A £${c.depositAmount} deposit secures your appointment${c.depositDeducted ? ' and comes off the price of your service' : ''}.`
      : c.deposit === 'full'
        ? 'Appointments are paid in full when you book.'
        : c.friendly
          ? 'We don’t take a deposit, so please let us know if your plans change.'
          : 'No deposit is taken.';
  const freeCancel = `Free cancellation or rebooking up to ${h} hours before${c.deposit === 'none' ? '' : `; your ${c.paid} is refunded or moved`}.`;
  const late = {
    keep_deposit: `Cancel within ${h} hours and the deposit is kept.`,
    keep_payment: `Cancel within ${h} hours and the payment is non-refundable.`,
    future_deposit: `Cancel within ${h} hours and we may ask for a deposit next time.`,
  }[c.lateCancel];
  const noShow = {
    keep_deposit: 'No-shows lose the deposit.',
    keep_payment: 'No-shows are not refunded.',
    future_deposit: 'No-shows will need a deposit for future bookings.',
  }[c.noShow];
  const lateness =
    c.lateAction === 'no_show'
      ? `Over ${c.graceMinutes} minutes late counts as a no-show.`
      : `Over ${c.graceMinutes} minutes late and we may shorten your service or ask you to rebook.`;
  const shopCancel =
    c.deposit === 'none'
      ? 'If we need to cancel or move your appointment, we’ll tell you as soon as we can.'
      : 'If we cancel or move your appointment, you get a full refund.';
  const methods = c.cancelMethods.map((m) =>
    m === 'phone' ? (c.phone ? `call ${c.phone}` : 'call us') : m === 'instagram' ? 'message us on Instagram' : 'use the link in your confirmation email',
  );
  const howTo = `To cancel or rebook, ${joinOr(methods)}.`;
  return fit(
    [
      { text: intro, priority: 0 },
      { text: freeCancel, priority: 0 },
      { text: late, priority: 0 },
      { text: noShow, priority: 0 },
      { text: lateness, priority: 2 },
      { text: shopCancel, priority: 0 },
      { text: howTo, priority: 1 },
      ...(c.friendly ? [{ text: 'Thanks for understanding.', priority: 3 }] : []),
    ],
    SHORT_VERSION_MAX_CHARS,
  );
}

const ONE_LINE_OUTCOME: Record<PaymentOutcome, string> = {
  keep_deposit: 'deposit kept',
  keep_payment: 'no refund',
  future_deposit: 'deposit needed next time',
};

function oneLineVersion(c: Ctx): string {
  const notice = `Free cancellation up to ${c.noticeHours}h before.`;
  let outcome: string;
  if (c.lateCancel === c.noShow) {
    outcome = {
      keep_deposit: 'Later cancellations and no-shows lose the deposit.',
      keep_payment: 'Later cancellations and no-shows are non-refundable.',
      future_deposit: 'Late cancellations and no-shows need a deposit next time.',
    }[c.lateCancel];
  } else {
    outcome = `Late cancellations: ${ONE_LINE_OUTCOME[c.lateCancel]}. No-shows: ${ONE_LINE_OUTCOME[c.noShow]}.`;
  }
  const first = c.cancelMethods[0];
  const how =
    first === 'link'
      ? 'Use the link in this email to cancel.'
      : first === 'phone'
        ? c.phone
          ? `Call ${c.phone} to cancel.`
          : 'Call us to cancel.'
        : 'Message us on Instagram to cancel.';
  return fit(
    [
      ...(c.friendly ? [{ text: 'Plans changed?', priority: 3 }] : []),
      { text: notice, priority: 0 },
      { text: outcome, priority: 0 },
      { text: how, priority: 1 },
    ],
    ONE_LINE_MAX_CHARS,
  );
}

export function buildPolicy(input: Partial<PolicyOptions> = {}): PolicyVersions {
  const options = normalisePolicyOptions(input);
  const c = ctx(options);
  const heading = options.shopName ? `${options.shopName} — ${POLICY_HEADING}` : POLICY_HEADING;
  const bullets = [
    introBlock(c),
    freeCancelBlock(c),
    lateCancelBlock(c),
    noShowBlock(c),
    latenessBlock(c),
    shopCancelBlock(c),
    howToCancelBlock(c),
  ];
  const closing = c.friendly ? CLOSING_FRIENDLY : null;
  const website = [heading, '', ...bullets.map((line) => `• ${line}`), ...(closing ? ['', closing] : [])].join('\n');

  return {
    heading,
    bullets,
    closing,
    website,
    short: shortVersion(c),
    oneLine: oneLineVersion(c),
  };
}

/** Plain-text file with all three versions, for "Download as .txt". */
export function buildPolicyTextFile(versions: PolicyVersions): string {
  return [
    'A) WEBSITE VERSION',
    '',
    versions.website,
    '',
    '',
    'B) SHORT VERSION (Instagram, Google Business Profile or booking page)',
    '',
    versions.short,
    '',
    '',
    'C) ONE LINE FOR BOOKING CONFIRMATIONS',
    '',
    versions.oneLine,
    '',
    '',
    'This template is general information, not legal advice.',
    '',
  ]
    .join('\n')
    .replace(/\n/g, '\r\n');
}

export type PolicyWarnings = { largeDeposit: boolean; longNotice: boolean };

export function policyWarnings(options: PolicyOptions): PolicyWarnings {
  return {
    largeDeposit: options.deposit === 'fixed' && options.depositAmount > LARGE_DEPOSIT_WARNING_ABOVE_GBP,
    longNotice: options.noticeHours === 48,
  };
}
