import { describe, expect, it } from 'vitest';
import { DEFAULT_NO_SHOW_INPUTS, type NoShowInputs } from './noShowCalculator';
import { clampField, decodeHash, encodeHash, normaliseInputs, numericField, parseNumber } from './noShowInputs';
import { buildNoShowSummary, buildNoShowView, gbp, gbp2, signedGbp } from './noShowView';

const D = DEFAULT_NO_SHOW_INPUTS;
const view = (overrides: Partial<NoShowInputs> = {}) => buildNoShowView({ ...D, ...overrides });

describe('money formatting', () => {
  it('rounds whole pounds and pence for display only', () => {
    expect(gbp(2635.3125)).toBe('£2,635');
    expect(gbp(-61.25)).toBe('−£61');
    expect(gbp(-0.2)).toBe('£0');
    expect(gbp2(4.445)).toBe('£4.45');
    expect(gbp2(-4.925)).toBe('−£4.93');
    expect(signedGbp(708.75)).toBe('+£709');
    expect(signedGbp(-770)).toBe('−£770');
    expect(signedGbp(0.3)).toBe('£0');
  });
});

describe('inputs', () => {
  it('parses UK-style entries and rejects junk', () => {
    expect(parseNumber('£25')).toBe(25);
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber('20p')).toBe(20);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });

  it('clamps to min/max and falls back to the example value when empty', () => {
    expect(clampField(numericField('weeksOpen'), 60)).toBe(52);
    expect(clampField(numericField('price'), -5)).toBe(0);
    expect(clampField(numericField('price'), null)).toBe(25);
    expect(clampField(numericField('customDeposit'), 0.2)).toBe(1);
  });

  it('keeps no-shows within appointments', () => {
    expect(normaliseInputs({ appointments: '10', noShows: '40' }).noShows).toBe(10);
  });

  it('round-trips the URL hash and ignores unknown values', () => {
    const custom: NoShowInputs = {
      ...D,
      price: 32.5,
      shopPayment: 'cash',
      chairModel: 'commission',
      depositType: 'custom',
      customDeposit: 8,
      keepDepositWhenRefilled: false,
      noShowReductionPercent: 20,
    };
    const hash = encodeHash(custom);
    expect(hash.startsWith('#p=32.5&a=80&n=3')).toBe(true);
    expect(hash).not.toContain('?');
    expect(decodeHash(hash)).toEqual(custom);
    expect(decodeHash('#p=abc&pay=bitcoin')).toEqual({ ...D });
    expect(decodeHash('#faq')).toBeNull();
    expect(decodeHash('')).toBeNull();
  });
});

describe('default view', () => {
  const v = view();

  it('headline and sub line', () => {
    expect(v.headlineTitle).toBe('No-shows cost you about £2,635 a year');
    expect(v.headlineSub).toBe('£53 a week · £17.57 per no-show · about 113 services’ worth of contribution');
    expect(v.noShowRate).toBe('3.8% of bookings');
  });

  it('busy vs quiet', () => {
    expect(v.busyLoss).toBe('£9.37');
    expect(v.quietLoss).toBe('£21.08');
    expect(v.busyQuietSentence).toBe('A quiet-time no-show costs you 2.3× more than a busy-time one.');
  });

  it('deposit card is neutral when the deposit loses money', () => {
    expect(v.depositHeading).toBe('Net yearly effect of a £5 deposit');
    expect(v.depositNet).toBe('−£61 a year');
    expect(v.depositTone).toBe('neutral');
    expect(v.depositsRetained).toBe('+£709');
    expect(v.extraCardFees).toBe('−£770');
    expect(v.fewerNoShows).toBe('£0');
    expect(v.lostBookings).toBe('£0');
    expect(v.breakEven).toMatch(/^A deposit breaks even if it cuts no-shows by at least 3\.2%\.$/);
    expect(v.fairnessWarning).toBe('');
  });

  it('chart data and accessible label', () => {
    expect(v.chart.withoutLabel).toBe('£2,635');
    expect(v.chart.withLabel).toBe('£2,697');
    expect(v.chart.withWidth).toBe(1);
    expect(v.chart.ariaLabel).toBe('Yearly cost of no-shows: £2,635 without a deposit, £2,697 with a £5 deposit.');
  });

  it('owner carries the loss', () => {
    expect(v.carrier).toBe('The shop carries the full £2,635 a year.');
  });
});

describe('view variants', () => {
  it('positive deposit is green-toned', () => {
    const v = view({ noShowReductionPercent: 50 });
    expect(v.depositTone).toBe('positive');
    expect(v.depositNet.startsWith('+£')).toBe(true);
    expect(v.depositSentence).toMatch(/better off\.$/);
  });

  it('positive-at-zero and not-reachable wording', () => {
    expect(view({ shopPayment: 'cash', noShows: 10 }).breakEven).toBe('A £5 deposit comes out ahead even if no-shows don’t fall at all.');
    expect(view({ lostBookingsPercent: 30 }).breakEven).toBe('With these numbers, a £5 deposit doesn’t break even, even if no-shows stopped completely.');
  });

  it('fairness warning for a deposit above the quiet-slot loss', () => {
    const v = view({ depositType: 'custom', customDeposit: 20, quietRefillPercent: 50 });
    expect(v.fairnessWarning).toBe(
      'Your deposit is higher than your estimated net loss per no-show. Under CMA guidance, keeping more than your net loss may be harder to justify as fair. This is not legal advice.',
    );
  });

  it('full payment and coerced deposits', () => {
    expect(view({ depositType: 'full' }).depositHeading).toBe('Net yearly effect of full payment at booking');
    expect(view({ depositType: 'custom', customDeposit: 40 }).depositNote).toMatch(/treated as full payment/);
  });

  it('chair models', () => {
    const c = view({ chairModel: 'commission', barberCommissionPercent: 40 });
    expect(c.headlineTitle).toBe('No-shows cost about £2,635 a year');
    expect(c.carrier).toBe('Roughly, in line with the split: the shop carries about £1,581 a year (60%) and the barber about £1,054 (40%).');
    const r = view({ chairModel: 'rent' });
    expect(r.headlineTitle).toBe('No-shows cost your chair renters about £2,635 a year');
    expect(r.carrier).toMatch(/^The renter loses the service; your rent arrives either way\./);
  });

  it('no busy sentence when busy loss is zero', () => {
    expect(view({ busyRefillPercent: 100 }).busyQuietSentence).toBe('');
  });

  it('zero inputs still render text without NaN', () => {
    const v = view({ price: 0, appointments: 0, noShows: 0, products: 0 });
    expect(JSON.stringify(v)).not.toMatch(/NaN|Infinity/);
    expect(v.headlineSub).toBe('£0 a week · £0.00 per no-show');
  });
});

describe('copy summary', () => {
  it('includes inputs, results and the disclaimer', () => {
    const text = buildNoShowSummary(D, undefined, 'https://kersivo.co.uk/barbershop-no-show-calculator#p=25');
    expect(text).toContain('- Average service price: £25.00');
    expect(text).toContain('- No-shows per week: 3 (3.8% of bookings)');
    expect(text).toContain('- No-shows cost you about £2,635 a year');
    expect(text).toContain('Not financial or legal advice.');
    expect(text.endsWith('https://kersivo.co.uk/barbershop-no-show-calculator#p=25')).toBe(true);
  });
});
