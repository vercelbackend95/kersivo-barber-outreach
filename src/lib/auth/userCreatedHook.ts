import { provisionShopForUser } from '@/lib/auth/provisionShop';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import {
  analyticsClientIdFromCookieHeader,
  analyticsSessionIdFromCookieHeader,
  sendServerAnalyticsEvent,
} from '@/lib/analytics/serverEvents';
import {
  enqueueRegistrationNotification,
  recordProductionRegistrationOrigin,
} from '@/lib/email/internalSignupNotifications';

/**
 * Better Auth `user.create.before` handler. Records a Production-origin marker so the email-outbox
 * reconciliation can tell a real Production registration from Preview activity in the shared
 * database. Never throws and never modifies the user being created.
 */
export async function handleUserCreating(user: { email?: string | null }): Promise<void> {
  await recordProductionRegistrationOrigin(user.email).catch((error: unknown) => {
    console.error('[auth] Registration origin marker threw', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * Better Auth `user.create.after` handler. Runs only when a new user row is committed
 * (email/password sign-up or a first-time OAuth user), never for sign-in, session refresh,
 * profile updates or OAuth account linking.
 *
 * The internal registration notification is queued even when provisioning throws, and its
 * failures never propagate; provisioning errors keep their existing behaviour.
 */
/** The part of Better Auth's endpoint context the hook reads (null for server-side user creation). */
export type UserCreatedContext = {
  path?: string | null;
  headers?: Headers | null;
  request?: Request | null;
  params?: Record<string, string | undefined> | null;
} | null;

/** `email` for email/password sign-up, the provider id for an OAuth callback (e.g. `google`). */
export function signupMethodFromContext(context: UserCreatedContext | undefined): string | null {
  const path = context?.path ?? '';
  if (path.includes('/sign-up/email')) return 'email';
  if (path.includes('/callback')) return context?.params?.id?.trim() || 'oauth';
  return null;
}

/**
 * GA4 `signup_completed`: a new account that got its own shop (an invited team member joining an
 * existing shop is not a signup). Uses the visitor's GA cookies from the sign-up / OAuth callback
 * request, so nothing is sent without Analytics consent or from a device marked internal.
 */
export async function sendSignupCompletedEvent(context: UserCreatedContext | undefined): Promise<boolean> {
  const cookieHeader = context?.headers?.get('cookie') ?? context?.request?.headers.get('cookie') ?? null;
  const clientId = analyticsClientIdFromCookieHeader(cookieHeader);
  if (!clientId) return false;
  const method = signupMethodFromContext(context);
  return sendServerAnalyticsEvent({
    name: FUNNEL_EVENTS.signup_completed,
    clientId,
    sessionId: analyticsSessionIdFromCookieHeader(cookieHeader),
    params: method ? { method } : undefined,
  });
}

export async function handleUserCreated(
  user: {
    id: string;
    name: string;
    email: string;
  },
  context?: UserCreatedContext,
): Promise<void> {
  try {
    const { shopId } = await provisionShopForUser({
      userId: user.id,
      name: user.name,
      email: user.email,
    });
    if (shopId) {
      await sendSignupCompletedEvent(context).catch(() => false);
    }
  } finally {
    await enqueueRegistrationNotification(user.id).catch((error: unknown) => {
      console.error('[auth] Registration notification enqueue threw', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}
