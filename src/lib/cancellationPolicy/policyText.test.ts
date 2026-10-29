import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POLICY_OPTIONS,
  FULL_PAYMENT_KEPT_GBP,
  GRACE_MINUTES,
  NOTICE_HOURS,
  ONE_LINE_MAX_CHARS,
  SHORT_VERSION_MAX_CHARS,
  buildPolicy,
  buildPolicyTextFile,
  normalisePolicyOptions,
  policyWarnings,
  type CancelMethod,
  type DepositType,
  type LateAction,
  type PaymentOutcome,
  type PolicyOptions,
  type PolicyTone,
} from './policyText';
import { decodePolicyHash, encodePolicyHash } from './policyHashState';
import { FULL_PAYMENT_RETAINED_CAP_PENCE } from '@/lib/booking/bookingPaymentPolicy';

const DEPOSITS: DepositType[] = ['none', 'fixed', 'full'];
const OUTCOMES: PaymentOutcome[] = ['keep_deposit', 'keep_payment', 'future_deposit'];
const LATE_ACTIONS: LateAction[] = ['shorten', 'no_show'];
const TONES: PolicyTone[] = ['friendly', 'direct'];
const METHOD_SETS: CancelMethod[][] = [['link'], ['phone'], ['instagram'], ['link', 'phone', 'instagram']];

function* everyCombination(): Generator<Partial<PolicyOptions>> {
  for (const deposit of DEPOSITS)
    for (const lateCancel of OUTCOMES)
      for (const noShow of OUTCOMES)
        for (const lateAction of LATE_ACTIONS)
          for (const tone of TONES)
            for (const cancelMethods of METHOD_SETS)
              for (const noticeHours of NOTICE_HOURS)
                for (const graceMinutes of GRACE_MINUTES)
                  for (const depositDeducted of [true, false])
                    yield {
                      // Worst case for length: longest name, phone, amount.
                      shopName: 'The Very Long Named Gentlemen’s Barbershop & Grooming Lounge',
                      phone: '+44 20 7946 0958 123',
                      deposit,
                      depositAmount: 50,
                      depositDeducted,
                      lateCancel,
                      noShow,
                      lateAction,
                      tone,
                      cancelMethods,
                      noticeHours,
                      graceMinutes,
                    };
}

function allText(input: Partial<PolicyOptions>) {
  const v = buildPolicy(input);
  return { v, text: [v.website, v.short, v.oneLine].join('\n') };
}

describe('buildPolicy — every option combination', () => {
  it('never emits undefined/null/NaN, double spaces or broken punctuation', () => {
    let count = 0;
    for (const input of everyCombination()) {
      const { text } = allText(input);
      expect(text).not.toMatch(/undefined|null|NaN|\[object/);
      expect(text).not.toMatch(/ {2}/);
      expect(text).not.toMatch(/\s[.,;]|\.\.|,,/);
      count += 1;
    }
    expect(count).toBeGreaterThan(5000);
  });

  it('keeps B ≤ 500 and C ≤ 160 characters and C on one line', () => {
    for (const input of everyCombination()) {
      const { v } = allText(input);
      expect(v.short.length).toBeLessThanOrEqual(SHORT_VERSION_MAX_CHARS);
      expect(v.oneLine.length).toBeLessThanOrEqual(ONE_LINE_MAX_CHARS);
      expect(v.oneLine).not.toContain('\n');
      expect(v.short).not.toContain('\n');
      expect(v.short).not.toContain('•');
    }
  });

  it('never mentions a deposit, refund or payment kept when "No deposit" is chosen, except future deposits', () => {
    for (const input of everyCombination()) {
      if (input.deposit !== 'none') continue;
      const { text } = allText(input);
      const withoutFutureDeposit = text
        .replace(/we don’t take a deposit/gi, '')
        .replace(/no deposit is taken/gi, '')
        .replace(/(a )?deposit (on|for) (your )?future bookings/gi, '')
        .replace(/deposit (is )?(may be )?required for future bookings/gi, '')
        .replace(/(need|ask for) a deposit (next time|for future bookings)|deposit needed next time/gi, '');
      expect(withoutFutureDeposit).not.toMatch(/deposit|refund|non-refundable|£/i);
    }
  });

  it('website version uses bullets; B and C use plain sentences', () => {
    const v = buildPolicy(DEFAULT_POLICY_OPTIONS);
    expect(v.website.split('\n').filter((line) => line.startsWith('• '))).toHaveLength(v.bullets.length);
    expect(v.short).not.toMatch(/•/);
  });

  it('always tells clients what happens if the shop cancels', () => {
    for (const deposit of DEPOSITS) {
      for (const tone of TONES) {
        const v = buildPolicy({ deposit, tone });
        expect(v.website).toMatch(/If we (ever need to )?cancel or move your appointment/);
        if (deposit !== 'none') expect(v.website).toContain('full refund of anything you’ve paid');
      }
    }
  });
});

describe('buildPolicy — default policy', () => {
  it('matches the server-rendered default (Friendly, £5 deducted, 24h, deposit kept)', () => {
    const v = buildPolicy();
    expect(v.heading).toBe('Cancellation & No-Show Policy');
    expect(v.bullets).toEqual([
      'We ask for a £5 deposit to secure your appointment. It comes off the price of your service.',
      'You can cancel or rebook free of charge up to 24 hours before your appointment — your deposit will be refunded or moved to your new time.',
      'If you cancel within 24 hours, the deposit is kept.',
      'If you don’t turn up, the deposit is kept.',
      'Running late? We’ll always try to fit you in, but after 10 minutes we may need to shorten your service or ask you to rebook.',
      'If we ever need to cancel or move your appointment, you’ll get a full refund of anything you’ve paid.',
      'To cancel or rebook, use the link in your confirmation email.',
    ]);
    expect(v.closing).toBe('Thanks for understanding — it helps us keep our diary fair for every client.');
    expect(v.oneLine).toBe(
      'Plans changed? Free cancellation up to 24h before. Later cancellations and no-shows lose the deposit. Use the link in this email to cancel.',
    );
  });

  it('puts the shop name only in the heading', () => {
    const v = buildPolicy({ shopName: '  Fade   Room ' });
    expect(v.heading).toBe('Fade Room — Cancellation & No-Show Policy');
    expect(v.bullets.join(' ')).not.toContain('Fade Room');
    expect(v.short).not.toContain('Fade Room');
  });

  it('straight-to-the-point tone is shorter and has no closing line', () => {
    const friendly = buildPolicy({ tone: 'friendly' });
    const direct = buildPolicy({ tone: 'direct' });
    expect(direct.closing).toBeNull();
    expect(direct.website.length).toBeLessThan(friendly.website.length);
    expect(direct.website).not.toMatch(/Thanks|We’ll always/);
  });

  it('lists several ways to cancel with "or" and includes the phone number', () => {
    const v = buildPolicy({ cancelMethods: ['link', 'phone', 'instagram'], phone: '01234 567890' });
    expect(v.bullets.at(-1)).toBe(
      'To cancel or rebook, use the link in your confirmation email, call us on 01234 567890 or send us a message on Instagram.',
    );
  });
});

describe('full prepayment wording matches KERSIVO settlement', () => {
  it('keeps the same amount KERSIVO retains and refunds the rest, never "non-refundable"', () => {
    expect(FULL_PAYMENT_KEPT_GBP * 100).toBe(FULL_PAYMENT_RETAINED_CAP_PENCE);
    for (const tone of TONES) {
      const v = buildPolicy({ deposit: 'full', lateCancel: 'keep_payment', noShow: 'keep_payment', tone });
      const text = [v.website, v.short, v.oneLine].join('\n');
      expect(text).not.toMatch(/non-refundable|not refunded|no refund/i);
      expect(v.website).toMatch(/£5 of (your|the) payment is kept|keep £5 of your payment/);
      expect(v.short).toContain('£5 is kept, the rest refunded');
      expect(v.oneLine).toContain('£5 kept, the rest refunded');
    }
    expect(buildPolicy({ deposit: 'full', lateCancel: 'keep_payment', noShow: 'keep_payment' }).bullets.slice(2, 4)).toEqual([
      'If you cancel within 24 hours, we keep £5 of your payment and refund the rest.',
      'If you don’t turn up, we keep £5 of your payment and refund the rest.',
    ]);
  });
});

describe('normalisePolicyOptions', () => {
  it('switches "Deposit is kept" to future deposits when there is no deposit', () => {
    const o = normalisePolicyOptions({ deposit: 'none', lateCancel: 'keep_deposit', noShow: 'keep_payment' });
    expect(o.lateCancel).toBe('future_deposit');
    expect(o.noShow).toBe('future_deposit');
  });

  it('maps "kept" onto the prepayment for full payment and onto the deposit for a fixed deposit', () => {
    expect(normalisePolicyOptions({ deposit: 'full', lateCancel: 'keep_deposit' }).lateCancel).toBe('keep_payment');
    expect(normalisePolicyOptions({ deposit: 'fixed', noShow: 'keep_payment' }).noShow).toBe('keep_deposit');
  });

  it('clamps deposits to whole pounds between £1 and £50 and trims long input', () => {
    expect(normalisePolicyOptions({ depositAmount: 0 }).depositAmount).toBe(1);
    expect(normalisePolicyOptions({ depositAmount: 75 }).depositAmount).toBe(50);
    expect(normalisePolicyOptions({ depositAmount: 12.6 }).depositAmount).toBe(13);
    expect(normalisePolicyOptions({ shopName: 'x'.repeat(100) }).shopName).toHaveLength(60);
    expect(normalisePolicyOptions({ cancelMethods: [] }).cancelMethods).toEqual(['link']);
  });

  it('flags large deposits and 48-hour notice as guidance', () => {
    expect(policyWarnings(normalisePolicyOptions({ depositAmount: 21 })).largeDeposit).toBe(true);
    expect(policyWarnings(normalisePolicyOptions({ depositAmount: 20 })).largeDeposit).toBe(false);
    expect(policyWarnings(normalisePolicyOptions({ deposit: 'full', depositAmount: 40 })).largeDeposit).toBe(false);
    expect(policyWarnings(normalisePolicyOptions({ noticeHours: 48 })).longNotice).toBe(true);
  });
});

describe('policy hash state', () => {
  it('round-trips every option except the phone number', () => {
    const input = normalisePolicyOptions({
      shopName: 'Fade & Co',
      deposit: 'fixed',
      depositAmount: 12,
      depositDeducted: false,
      noticeHours: 48,
      lateCancel: 'future_deposit',
      noShow: 'keep_deposit',
      graceMinutes: 15,
      lateAction: 'no_show',
      cancelMethods: ['phone', 'instagram'],
      phone: '07700 900123',
      tone: 'direct',
    });
    const hash = encodePolicyHash(input);
    expect(hash).toContain('deposit=12');
    expect(hash).toContain('notice=48');
    expect(hash).not.toContain('07700');
    expect(decodePolicyHash(`#${hash}`)).toEqual({ ...input, phone: '' });
  });

  it('round-trips full payment and no deposit', () => {
    for (const deposit of ['full', 'none'] as const) {
      const input = normalisePolicyOptions({ deposit });
      expect(decodePolicyHash(encodePolicyHash(input))).toEqual(input);
    }
  });

  it('falls back to defaults for an empty or hostile hash', () => {
    expect(decodePolicyHash('')).toEqual(normalisePolicyOptions());
    expect(decodePolicyHash('#deposit=<script>&notice=999&cancel=evil').deposit).toBe('fixed');
  });
});

describe('buildPolicyTextFile', () => {
  it('contains all three versions with Windows line endings', () => {
    const v = buildPolicy();
    const file = buildPolicyTextFile(v);
    expect(file).toContain('A) WEBSITE VERSION');
    expect(file).toContain(v.short);
    expect(file).toContain(v.oneLine);
    expect(file).not.toMatch(/[^\r]\n/);
  });
});
