import { prisma } from '@/lib/db/client';
import { getSetupOnboardingFormUrlOrEmpty } from '@/lib/email/sender';
import { SetupDepositStatus } from '@prisma/client';

/**
 * Single replace point for the paid launch / Stripe purchase destination.
 */
export const OWNER_LAUNCH_HREF = '/admin/launch';

export type OwnerPreviewCta = {
  label: string;
  href: string;
};

type ResolveOwnerPreviewCtaInput = {
  onboardingCompleted: boolean;
  ownerEmail: string | null;
};

/**
 * Resolves the dominant owner CTA from existing workspace fields only.
 * Missing states (checkout started, active customer) fall through to Launch.
 */
export async function resolveOwnerPreviewCta(
  input: ResolveOwnerPreviewCtaInput,
): Promise<OwnerPreviewCta> {
  if (!input.onboardingCompleted) {
    return {
      label: 'Continue Setup',
      href: '/admin/onboarding',
    };
  }

  const email = input.ownerEmail?.trim().toLowerCase() || null;
  if (email) {
    const paidDeposit = await prisma.setupDeposit.findFirst({
      where: {
        customerEmail: { equals: email, mode: 'insensitive' },
        status: SetupDepositStatus.PAID,
      },
      select: { id: true },
    });

    if (paidDeposit) {
      const formUrl = getSetupOnboardingFormUrlOrEmpty().trim();
      return {
        label: 'View Setup Progress',
        href: formUrl || '/admin',
      };
    }

    const pendingDeposit = await prisma.setupDeposit.findFirst({
      where: {
        customerEmail: { equals: email, mode: 'insensitive' },
        status: SetupDepositStatus.PENDING,
      },
      select: { id: true },
    });

    if (pendingDeposit) {
      return {
        label: 'Continue Purchase',
        href: '/admin/launch?step=2',
      };
    }
  }

  return {
    label: 'Launch My Barbershop',
    href: OWNER_LAUNCH_HREF,
  };
}
