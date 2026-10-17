/**
 * The worked payment example for /barbershop-online-booking Section 04: one illustrative £25
 * service and the two KERSIVO Starter checkout choices for it. Every amount is derived from the
 * pure booking-payment policy the real booking flow and server use, so the example cannot drift
 * from the live rule. Nothing here charges, connects to Stripe or touches a booking.
 */
import {
  BOOKING_DEPOSIT_CAP_PENCE,
  KERSIVO_STARTER_PLATFORM_FEE_BPS,
  STARTER_MIN_PUBLIC_SERVICE_PRICE_PENCE,
  resolveRequiredBookingPayment,
  resolveStarterPublicPaymentMode,
  type StarterPublicPaymentChoice,
} from '@/lib/booking/bookingPaymentPolicy';

/** Illustrative price only; not a catalogue item of any demo shop. */
export const EXAMPLE_SERVICE_PRICE_PENCE = 2500;

export type PaymentExampleOption = {
  choice: StarterPublicPaymentChoice;
  /** Same labels as the live Starter booking page (BookingFlow). */
  label: string;
  nowPence: number;
  atShopPence: number;
  totalPence: number;
};

export type PaymentExample = {
  pricePence: number;
  depositPence: number;
  minimumPricePence: number;
  platformFeeBps: number;
  options: PaymentExampleOption[];
};

const LABELS: Record<StarterPublicPaymentChoice, string> = {
  DEPOSIT: `Pay ${formatGbp(BOOKING_DEPOSIT_CAP_PENCE)} deposit`,
  FULL: 'Pay in full',
};

export function formatGbp(pence: number): string {
  const pounds = pence / 100;
  return Number.isInteger(pounds) ? `£${pounds}` : `£${pounds.toFixed(2)}`;
}

/** The Starter checkout choices a customer is offered for one service price. */
export function starterPaymentOptions(pricePence: number): PaymentExampleOption[] {
  const choices: StarterPublicPaymentChoice[] = ['DEPOSIT', 'FULL'];
  const options: PaymentExampleOption[] = [];
  for (const choice of choices) {
    const decision = resolveStarterPublicPaymentMode({ servicePricePence: pricePence, requestedChoice: choice });
    if (!decision.ok) return [];
    if (options.some((option) => option.choice === decision.mode)) continue;
    const { amountPence } = resolveRequiredBookingPayment({ mode: decision.mode, servicePricePence: pricePence });
    options.push({
      choice: decision.mode,
      label: LABELS[decision.mode],
      nowPence: amountPence,
      atShopPence: pricePence - amountPence,
      totalPence: pricePence,
    });
  }
  return options;
}

export function buildPaymentExample(pricePence: number = EXAMPLE_SERVICE_PRICE_PENCE): PaymentExample {
  return {
    pricePence,
    depositPence: BOOKING_DEPOSIT_CAP_PENCE,
    minimumPricePence: STARTER_MIN_PUBLIC_SERVICE_PRICE_PENCE,
    platformFeeBps: KERSIVO_STARTER_PLATFORM_FEE_BPS,
    options: starterPaymentOptions(pricePence),
  };
}
