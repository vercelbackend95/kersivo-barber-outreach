import { prisma } from '../db/client';
import {
  ONBOARDING_STEP_REVIEW,
  markOnboardingCompleted,
  shopMeetsOnboardingCompletionRequirements,
} from '../admin/onboarding';
import { TERMS_ACCEPTANCE_PURPOSES } from '../legal/termsVersion';
import {
  TERMS_ACCEPTANCE_REQUIRED_MESSAGE,
  recordTermsAcceptance,
} from '../legal/requireTermsAcceptance';
import {
  FREE_BOOKABLE_BARBER_LIMIT,
  countActiveBookableBarbers,
  freeBookableBarberLimitError,
  isFreeActivationBarberCountEligible,
  lockShopForBookableBarberChange,
  type FreeBookableBarberLimitError,
} from './freeBookableBarbers';
import { loadKersivoAccess } from './kersivoAccess';

export const ONBOARDING_REQUIREMENTS_MESSAGE =
  'Finish shop, team, services and hours before continuing.';

export type FreeBookingActivationOutcome =
  /** SETUP → FREE_BOOKING in this request. */
  | 'activated'
  /** Already FREE_BOOKING (replay / double submit). No new marker or legal record. */
  | 'already_free'
  /** FULL_KERSIVO: onboarding completed, no Free opt-in marker written. */
  | 'full_kersivo';

export type FreeBookingActivationFailure =
  | { ok: false; status: 400; code: 'ONBOARDING_INCOMPLETE'; error: string }
  | { ok: false; status: 400; code: 'TERMS_NOT_ACCEPTED'; error: string }
  | { ok: false; status: 400; code: 'ACCOUNT_EMAIL_REQUIRED'; error: string }
  | FreeBookableBarberLimitError;

export type FreeBookingActivationResult =
  | { ok: true; outcome: FreeBookingActivationOutcome }
  | FreeBookingActivationFailure;

/**
 * Authoritative final onboarding action for signed-in tenants.
 * The only production path that writes ShopSettings.freeBookingActivatedAt.
 */
export async function activateFreeBooking(params: {
  shopId: string;
  userId: string;
  email: string | null;
  termsAccepted: boolean;
  request: Request;
  now?: Date;
}): Promise<FreeBookingActivationResult> {
  const { shopId } = params;

  if (!(await shopMeetsOnboardingCompletionRequirements(shopId))) {
    return {
      ok: false,
      status: 400,
      code: 'ONBOARDING_INCOMPLETE',
      error: ONBOARDING_REQUIREMENTS_MESSAGE,
    };
  }

  const { state } = await loadKersivoAccess(shopId);
  if (state === 'FULL_KERSIVO') {
    await markOnboardingCompleted(shopId);
    return { ok: true, outcome: 'full_kersivo' };
  }
  if (state === 'FREE_BOOKING') {
    await markOnboardingCompleted(shopId);
    return { ok: true, outcome: 'already_free' };
  }

  if (params.termsAccepted !== true) {
    return {
      ok: false,
      status: 400,
      code: 'TERMS_NOT_ACCEPTED',
      error: TERMS_ACCEPTANCE_REQUIRED_MESSAGE,
    };
  }

  const email = params.email?.trim().toLowerCase() ?? '';
  if (!email) {
    return {
      ok: false,
      status: 400,
      code: 'ACCOUNT_EMAIL_REQUIRED',
      error: 'Your account needs an email address before activating Free Booking.',
    };
  }

  const now = params.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    await lockShopForBookableBarberChange(tx, shopId);

    const shop = await tx.shopSettings.findUniqueOrThrow({
      where: { id: shopId },
      select: {
        freeBookingActivatedAt: true,
        onboardingCompleted: true,
        onboardingCompletedAt: true,
      },
    });
    if (shop.freeBookingActivatedAt) {
      return { ok: true as const, outcome: 'already_free' as const };
    }

    const bookable = await countActiveBookableBarbers(shopId, tx);
    if (!isFreeActivationBarberCountEligible(bookable)) {
      return freeBookableBarberLimitError();
    }

    await tx.shopSettings.update({
      where: { id: shopId },
      data: {
        freeBookingActivatedAt: now,
        onboardingCompleted: true,
        onboardingCompletedAt:
          shop.onboardingCompleted && shop.onboardingCompletedAt ? shop.onboardingCompletedAt : now,
        onboardingCurrentStep: ONBOARDING_STEP_REVIEW,
      },
    });

    await recordTermsAcceptance({
      purpose: TERMS_ACCEPTANCE_PURPOSES.FREE_BOOKING_ACTIVATION,
      email,
      userId: params.userId,
      shopId,
      request: params.request,
      meta: {
        freeBookingActivatedAt: now.toISOString(),
        activeBookableBarbers: bookable,
        freeBookableBarberLimit: FREE_BOOKABLE_BARBER_LIMIT,
      },
      db: tx,
    });

    return { ok: true as const, outcome: 'activated' as const };
  });
}
