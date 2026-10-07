export const prerender = false;

import type { APIRoute } from 'astro';
import { Prisma } from '@prisma/client';
import { resolveAdminAccess, requireVerifiedEmail } from '@/lib/admin/auth';
import { requirePermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import {
  CURRENT_TERMS_VERSION,
  TERMS_ACCEPTANCE_PURPOSES,
  postFullStarterTermsAllowService,
} from '@/lib/legal/termsVersion';
import {
  parseTermsAccepted,
  recordTermsAcceptance,
  TERMS_ACCEPTANCE_REQUIRED_MESSAGE,
} from '@/lib/legal/requireTermsAcceptance';
import {
  FREE_BOOKABLE_BARBER_LIMIT,
  FREE_BOOKABLE_BARBER_LIMIT_CODE,
  countActiveBookableBarbers,
} from '@/lib/shop/freeBookableBarbers';
import {
  ACCOUNT_LIFECYCLE_ACTIONS,
  recordAccountLifecycleEvent,
} from '@/lib/setup/accountLifecycleAudit';
import {
  SHOP_DEPARTURE_IN_PROGRESS,
  SHOP_DEPARTURE_IN_PROGRESS_MESSAGE,
} from '@/lib/shop/shopDepartureCopy';
import { loadStarterPublicLaunchReadiness } from '@/lib/setup/starterPublicLaunchReadiness';

type PostFullChoice = 'STARTER' | 'LEAVE';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseChoice(body: unknown): PostFullChoice | null {
  if (!body || typeof body !== 'object') return null;
  const value = String((body as { choice?: unknown }).choice ?? '').trim().toUpperCase();
  return value === 'STARTER' || value === 'LEAVE' ? value : null;
}

/**
 * Records the owner's explicit choice for what happens when the current Full KERSIVO
 * subscription ends. It never cancels Stripe itself; /cancel-subscription owns that action.
 *
 * Allowed only after cancellation is scheduled or once the subscription is already canceled.
 * Full remains active until Stripe entitlement actually ends.
 */
export const POST: APIRoute = async (context) => {
  const access = await resolveAdminAccess(context);
  if (!access || access.via !== 'session') return json({ error: 'Unauthorized' }, 401);

  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;
  const unverified = requireVerifiedEmail(access);
  if (unverified) return unverified;

  const body: unknown = await context.request.json().catch(() => null);
  const choice = parseChoice(body);
  if (!choice) {
    return json(
      { error: 'Choose KERSIVO Starter or Leave KERSIVO.', code: 'INVALID_POST_FULL_PLAN' },
      400,
    );
  }

  const termsAccepted = parseTermsAccepted(body);
  const now = new Date();

  const outcome = await prisma.$transaction(async (tx) => {
    // Same shop lock as departure materialization: a choice and a departure never interleave.
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "ShopSettings" WHERE id = ${access.shopId} FOR UPDATE`,
    );
    const subscription = await tx.saasSubscription.findFirst({
      where: { shopId: access.shopId, status: { not: 'PENDING' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
        retentionEndsAt: true,
        postFullPlan: true,
        postFullPlanChosenAt: true,
        postFullTermsVersion: true,
      },
    });

    if (!subscription) {
      return { response: json({ error: 'No Full KERSIVO subscription found.' }, 404) } as const;
    }

    const departure = await tx.shopDeparture.findUnique({
      where: { shopId: access.shopId },
      select: { id: true },
    });
    if (departure) {
      return {
        response: json(
          { error: SHOP_DEPARTURE_IN_PROGRESS_MESSAGE, code: SHOP_DEPARTURE_IN_PROGRESS },
          409,
        ),
      } as const;
    }

    const status = String(subscription.status);
    const cancellationScheduled =
      subscription.cancelAtPeriodEnd &&
      (status === 'ACTIVE' || status === 'PAST_DUE' || status === 'SUSPENDED');
    const alreadyCanceled = status === 'CANCELED';

    if (!cancellationScheduled && !alreadyCanceled) {
      return {
        response: json(
          {
            error: 'Cancel Full KERSIVO first, then choose what happens after the paid period.',
            code: 'CANCELLATION_NOT_SCHEDULED',
          },
          409,
        ),
      } as const;
    }

    if (
      alreadyCanceled &&
      subscription.retentionEndsAt &&
      subscription.retentionEndsAt.getTime() <= now.getTime()
    ) {
      return {
        response: json(
          {
            error: 'The post-cancellation retention window has ended.',
            code: 'RETENTION_ENDED',
          },
          409,
        ),
      } as const;
    }

    const sameRecordedChoice =
      String(subscription.postFullPlan) === choice &&
      Boolean(subscription.postFullPlanChosenAt);
    const starterTermsAllowService =
      postFullStarterTermsAllowService(subscription.postFullTermsVersion);

    if (sameRecordedChoice && (choice !== 'STARTER' || starterTermsAllowService)) {
      return {
        response: null,
        subscriptionId: subscription.id,
        choice,
        currentPeriodEnd: subscription.currentPeriodEnd,
        alreadyChosen: true,
      } as const;
    }

    if (choice === 'STARTER' && alreadyCanceled) {
      // A valid current/legacy-effective Starter choice returned above. Any remaining ended-Full
      // case is already a departure path and cannot be converted into Starter after the fact.
      return {
        response: json(
          { error: SHOP_DEPARTURE_IN_PROGRESS_MESSAGE, code: SHOP_DEPARTURE_IN_PROGRESS },
          409,
        ),
      } as const;
    }

    if (choice === 'STARTER') {
      if (!termsAccepted) {
        return {
          response: json(
            { error: TERMS_ACCEPTANCE_REQUIRED_MESSAGE, code: 'TERMS_NOT_ACCEPTED' },
            400,
          ),
        } as const;
      }

      const activeBookableBarbers = await countActiveBookableBarbers(access.shopId, tx);
      if (activeBookableBarbers > FREE_BOOKABLE_BARBER_LIMIT) {
        return {
          response: json(
            {
              error:
                'KERSIVO Starter supports up to 4 active bookable barbers. Reduce the active booking team to 4 or fewer before choosing Starter.',
              code: FREE_BOOKABLE_BARBER_LIMIT_CODE,
              limit: FREE_BOOKABLE_BARBER_LIMIT,
              activeBookableBarbers,
            },
            409,
          ),
        } as const;
      }

      const email = access.userEmail?.trim().toLowerCase() ?? '';
      if (!email) {
        return {
          response: json(
            { error: 'Your account needs an email address before choosing KERSIVO Starter.' },
            400,
          ),
        } as const;
      }

      await recordTermsAcceptance({
        purpose: TERMS_ACCEPTANCE_PURPOSES.FULL_TO_STARTER,
        email,
        userId: access.userId,
        shopId: access.shopId,
        request: context.request,
        meta: {
          saasSubscriptionId: subscription.id,
          postFullPlan: 'STARTER',
          activeBookableBarbers,
          starterBookableBarberLimit: FREE_BOOKABLE_BARBER_LIMIT,
          termsVersion: CURRENT_TERMS_VERSION,
          refreshingRecordedStarterChoice: sameRecordedChoice,
        },
        db: tx,
      });
    }

    const updated = await tx.saasSubscription.update({
      where: { id: subscription.id },
      data: {
        postFullPlan: choice,
        postFullPlanChosenAt:
          sameRecordedChoice && subscription.postFullPlanChosenAt
            ? subscription.postFullPlanChosenAt
            : now,
        postFullTermsVersion: choice === 'STARTER' ? CURRENT_TERMS_VERSION : null,
      },
      select: {
        id: true,
        postFullPlan: true,
        postFullPlanChosenAt: true,
        postFullTermsVersion: true,
        currentPeriodEnd: true,
      },
    });

    return {
      response: null,
      subscriptionId: updated.id,
      choice,
      currentPeriodEnd: updated.currentPeriodEnd,
      alreadyChosen: sameRecordedChoice,
    } as const;
  });

  if (outcome.response) return outcome.response;

  // Readiness never blocks the choice: once the current Terms version is recorded, Starter
  // entitlement begins when Full ends; Stripe / £5 blockers pause only new public booking intake.
  const starterPublicLaunch =
    outcome.choice === 'STARTER' ? await loadStarterPublicLaunchReadiness(access.shopId) : null;

  await recordAccountLifecycleEvent({
    action: ACCOUNT_LIFECYCLE_ACTIONS.POST_FULL_PLAN_CHOSEN,
    userId: access.userId,
    email: access.userEmail ?? null,
    shopId: access.shopId,
    meta: {
      saasSubscriptionId: outcome.subscriptionId,
      postFullPlan: outcome.choice,
      alreadyChosen: outcome.alreadyChosen,
      currentPeriodEnd: outcome.currentPeriodEnd?.toISOString() ?? null,
      ...(starterPublicLaunch
        ? {
            starterPublicLaunchReady: starterPublicLaunch.ready,
            starterPublicLaunchPauseReasons: starterPublicLaunch.reasons,
            starterServicesBelowMinimum: starterPublicLaunch.servicesBelowMinimum.map((s) => s.id),
          }
        : {}),
    },
  });

  return json({
    ok: true,
    choice: outcome.choice,
    alreadyChosen: outcome.alreadyChosen,
    currentPeriodEnd: outcome.currentPeriodEnd?.toISOString() ?? null,
    starterPublicLaunch,
  });
};
