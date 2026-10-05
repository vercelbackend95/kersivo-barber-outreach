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
import { ensureShopBookingSlug } from '../booking/bookingSlug';

export const ONBOARDING_REQUIREMENTS_MESSAGE =
  'Finish shop, team, services and hours before continuing.';

export type FreeBookingActivationOutcome =
  /** SETUP → FREE_BOOKING in this request. */
  | 'activated'
  /** Already FREE_BOOKING (replay / double submit). No new marker or legal record. */
  | 'already_free'
  /** FULL_KERSIVO: onboarding completed, no Free opt-in marker written. */
  | 'full_kersivo';

export const STARTER_PLAN_CHOICE = 'STARTER';

export const PLAN_CHOICE_REQUIRED_MESSAGE =
  'Choose KERSIVO Starter or Full KERSIVO before finishing setup.';

export const POST_FULL_PLAN_CHOICE_REQUIRED_MESSAGE =
  'Your Full KERSIVO subscription has ended. Choose KERSIVO Starter from the plan choice to continue on Starter.';

export type FreeBookingActivationFailure =
  | { ok: false; status: 400; code: 'ONBOARDING_INCOMPLETE'; error: string }
  | { ok: false; status: 400; code: 'PLAN_CHOICE_REQUIRED'; error: string }
  | { ok: false; status: 409; code: 'POST_FULL_PLAN_CHOICE_REQUIRED'; error: string }
  | { ok: false; status: 400; code: 'TERMS_NOT_ACCEPTED'; error: string }
  | { ok: false; status: 400; code: 'ACCOUNT_EMAIL_REQUIRED'; error: string }
  | FreeBookableBarberLimitError;

export type FreeBookingActivationResult =
  | { ok: true; outcome: FreeBookingActivationOutcome }
  | FreeBookingActivationFailure;

/**
 * Authoritative final onboarding action for signed-in tenants.
 * The only production path that writes ShopSettings.freeBookingActivatedAt.
 * A new Starter activation requires the explicit `plan: 'STARTER'` choice; replays and Full shops
 * complete without one, so an absent choice can never activate a plan.
 */
export async function activateFreeBooking(params: {
  shopId: string;
  userId: string;
  email: string | null;
  termsAccepted: boolean;
  /** Explicit onboarding plan choice; only 'STARTER' may write a new activation. */
  plan: string | null;
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

  const now = params.now ?? new Date();

  // Fast path only: it never writes the Free marker or a slug, so a stale read here is harmless.
  // Already-Free replays go through the locked path so a missing slug can be repaired.
  const { state: preLockState } = await loadKersivoAccess(shopId, now);
  if (preLockState === 'FULL_KERSIVO') {
    await markOnboardingCompleted(shopId);
    return { ok: true, outcome: 'full_kersivo' };
  }

  return prisma.$transaction(async (tx): Promise<FreeBookingActivationResult> => {
    await lockShopForBookableBarberChange(tx, shopId);

    const shop = await tx.shopSettings.findUniqueOrThrow({
      where: { id: shopId },
      select: {
        freeBookingActivatedAt: true,
        onboardingCompleted: true,
        onboardingCompletedAt: true,
      },
    });

    const completeOnboarding = async () => {
      if (shop.onboardingCompleted) return;
      await tx.shopSettings.update({
        where: { id: shopId },
        data: {
          onboardingCompleted: true,
          onboardingCompletedAt: now,
          onboardingCurrentStep: ONBOARDING_STEP_REVIEW,
        },
      });
    };

    // Authoritative decision: state resolved under the shop lock overrides the pre-lock read.
    const { state } = await loadKersivoAccess(shopId, now, tx);
    if (state === 'FULL_KERSIVO') {
      await completeOnboarding();
      return { ok: true, outcome: 'full_kersivo' };
    }
    if (state === 'SETUP') {
      // After Full, the legacy marker never grants Starter: only the post-Full choice can.
      const hadFull = await tx.saasSubscription.count({
        where: { shopId, status: { not: 'PENDING' } },
      });
      if (hadFull > 0) {
        return {
          ok: false,
          status: 409,
          code: 'POST_FULL_PLAN_CHOICE_REQUIRED',
          error: POST_FULL_PLAN_CHOICE_REQUIRED_MESSAGE,
        };
      }
    }
    if (state === 'FREE_BOOKING' || shop.freeBookingActivatedAt) {
      // Defensive repair for legacy/dev Free rows without a slug; keeps the existing slug,
      // activation timestamp and legal record untouched.
      await ensureShopBookingSlug(tx, shopId);
      await completeOnboarding();
      return { ok: true, outcome: 'already_free' };
    }

    if (params.plan !== STARTER_PLAN_CHOICE) {
      return {
        ok: false,
        status: 400,
        code: 'PLAN_CHOICE_REQUIRED',
        error: PLAN_CHOICE_REQUIRED_MESSAGE,
      };
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
        error: 'Your account needs an email address before activating KERSIVO Starter.',
      };
    }

    const bookable = await countActiveBookableBarbers(shopId, tx);
    if (!isFreeActivationBarberCountEligible(bookable)) {
      return freeBookableBarberLimitError();
    }

    // Slug, Free marker and Terms acceptance commit or roll back together.
    const bookingSlug = await ensureShopBookingSlug(tx, shopId);

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
        bookingSlug,
      },
      db: tx,
    });

    return { ok: true, outcome: 'activated' };
  });
}
