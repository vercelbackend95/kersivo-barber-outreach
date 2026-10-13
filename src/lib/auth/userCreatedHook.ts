import { provisionShopForUser } from '@/lib/auth/provisionShop';
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
export async function handleUserCreated(user: {
  id: string;
  name: string;
  email: string;
}): Promise<void> {
  try {
    await provisionShopForUser({
      userId: user.id,
      name: user.name,
      email: user.email,
    });
  } finally {
    await enqueueRegistrationNotification(user.id).catch((error: unknown) => {
      console.error('[auth] Registration notification enqueue threw', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}
