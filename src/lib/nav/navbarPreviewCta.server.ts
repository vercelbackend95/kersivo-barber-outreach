import type { APIContext } from 'astro';
import { SetupDepositStatus } from '@prisma/client';
import { resolveAdminAccess } from '@/lib/admin/auth';
import { prisma } from '@/lib/db/client';
import {
  NAVBAR_SUBSCRIBE_CTA_LABEL,
  type Navbar17CtaTrack,
} from '@/lib/nav/navbar17Items';

export type NavbarPreviewCtaState =
  | 'get_started'
  | 'continue_setup'
  | 'continue_purchase'
  | 'launch_barbershop';

export type NavbarPreviewCta = {
  state: NavbarPreviewCtaState;
  label: string;
  /** Null means render an inert button (no navigation). */
  href: string | null;
  track?: Navbar17CtaTrack;
};

const GET_STARTED: NavbarPreviewCta = {
  state: 'get_started',
  label: NAVBAR_SUBSCRIBE_CTA_LABEL,
  href: '/admin/launch',
  track: 'saas_subscribe_click',
};

const CONTINUE_SETUP: NavbarPreviewCta = {
  state: 'continue_setup',
  label: 'Continue My Setup',
  href: '/admin/onboarding',
  track: 'plan_my_setup_click',
};

const CONTINUE_PURCHASE: NavbarPreviewCta = {
  state: 'continue_purchase',
  label: 'Continue Purchase',
  href: '/admin/launch?step=2',
};

const LAUNCH_BARBERSHOP: NavbarPreviewCta = {
  state: 'launch_barbershop',
  label: 'Launch My Barbershop',
  href: '/admin/launch',
};

/**
 * Resolves the marketing navbar CTA for landing / shop / testShop variants.
 */
export async function resolveNavbarPreviewCta(
  context: APIContext,
): Promise<NavbarPreviewCta> {
  const access = await resolveAdminAccess(context);
  if (!access || access.via !== 'session') {
    return GET_STARTED;
  }

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: { onboardingCompleted: true },
  });

  if (!shop || !shop.onboardingCompleted) {
    return CONTINUE_SETUP;
  }

  const email = access.userEmail?.trim().toLowerCase() || null;
  if (email) {
    const pendingDeposit = await prisma.setupDeposit.findFirst({
      where: {
        customerEmail: { equals: email, mode: 'insensitive' },
        status: SetupDepositStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (pendingDeposit) {
      return CONTINUE_PURCHASE;
    }
  }

  return LAUNCH_BARBERSHOP;
}
