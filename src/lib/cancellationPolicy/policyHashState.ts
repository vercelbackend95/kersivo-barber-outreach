import {
  CANCEL_METHODS,
  DEFAULT_POLICY_OPTIONS,
  normalisePolicyOptions,
  type CancelMethod,
  type PolicyOptions,
} from './policyText';

/**
 * Policy options <-> URL hash (#deposit=5&notice=24…), so a policy can be bookmarked or
 * shared without creating new crawlable URLs. Query parameters are never used.
 * The phone number is deliberately left out: it is never stored, logged or put in a URL.
 */

const OUTCOME_CODES = { keep_deposit: 'keep', keep_payment: 'keep', future_deposit: 'future' } as const;

export function encodePolicyHash(input: PolicyOptions): string {
  const o = normalisePolicyOptions(input);
  const params = new URLSearchParams();
  params.set('deposit', o.deposit === 'fixed' ? String(o.depositAmount) : o.deposit);
  if (o.deposit === 'fixed') params.set('deducted', o.depositDeducted ? '1' : '0');
  params.set('notice', String(o.noticeHours));
  params.set('late', OUTCOME_CODES[o.lateCancel]);
  params.set('noshow', OUTCOME_CODES[o.noShow]);
  params.set('grace', String(o.graceMinutes));
  params.set('after', o.lateAction === 'no_show' ? 'noshow' : 'shorten');
  params.set('cancel', o.cancelMethods.join(','));
  params.set('tone', o.tone);
  if (o.shopName) params.set('name', o.shopName);
  return params.toString();
}

function outcomeFromCode(code: string | null, fallback: PolicyOptions['lateCancel']) {
  if (code === 'future') return 'future_deposit' as const;
  // Normalisation maps 'keep' onto the deposit or the prepayment for the chosen deposit type.
  if (code === 'keep') return 'keep_deposit' as const;
  return fallback;
}

export function decodePolicyHash(hash: string): PolicyOptions {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const d = DEFAULT_POLICY_OPTIONS;
  const deposit = params.get('deposit');
  const amount = deposit && /^\d+$/.test(deposit) ? Number(deposit) : undefined;
  const methods = (params.get('cancel') ?? '')
    .split(',')
    .filter((m): m is CancelMethod => (CANCEL_METHODS as readonly string[]).includes(m));

  return normalisePolicyOptions({
    shopName: params.get('name') ?? '',
    deposit: amount !== undefined ? 'fixed' : deposit === 'none' || deposit === 'full' ? deposit : d.deposit,
    depositAmount: amount ?? d.depositAmount,
    depositDeducted: params.has('deducted') ? params.get('deducted') !== '0' : d.depositDeducted,
    noticeHours: Number(params.get('notice') ?? d.noticeHours) as PolicyOptions['noticeHours'],
    lateCancel: outcomeFromCode(params.get('late'), d.lateCancel),
    noShow: outcomeFromCode(params.get('noshow'), d.noShow),
    graceMinutes: Number(params.get('grace') ?? d.graceMinutes) as PolicyOptions['graceMinutes'],
    lateAction: params.get('after') === 'noshow' ? 'no_show' : 'shorten',
    cancelMethods: methods.length > 0 ? methods : [...d.cancelMethods],
    phone: '',
    tone: params.get('tone') === 'direct' ? 'direct' : 'friendly',
  });
}
