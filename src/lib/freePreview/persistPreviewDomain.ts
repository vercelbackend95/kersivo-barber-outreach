import { ClientOnboardingDomainMode } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import type { DomainChoiceResult } from '@/lib/domains/validateChoice';

type PreviewContact = {
  firstName: string | null;
  email: string;
  townCity: string;
  instagramUrl: string | null;
  websiteUrl: string | null;
};

/**
 * Write the owner's domain decision onto the draft shop's ClientOnboarding row
 * before Stripe Checkout. Claim-time upsert uses update: {}, so these fields survive payment.
 */
export async function persistPreviewDomainChoice(input: {
  shopId: string;
  preview: PreviewContact;
  contactName: string;
  choice: Extract<DomainChoiceResult, { ok: true }>;
}): Promise<void> {
  const authorised = input.choice.domainMode === 'KERSIVO_REGISTER' && input.choice.authorised;
  const now = authorised ? new Date() : null;
  const email = input.preview.email.trim().toLowerCase();

  await prisma.clientOnboarding.upsert({
    where: { shopId: input.shopId },
    create: {
      shopId: input.shopId,
      primaryContactName: input.contactName.trim() || input.preview.firstName,
      primaryContactEmail: email,
      publicEmail: email,
      townCity: input.preview.townCity,
      instagramUrl: input.preview.instagramUrl,
      currentWebsiteUrl: input.preview.websiteUrl,
      domainMode:
        input.choice.domainMode === 'EXISTING'
          ? ClientOnboardingDomainMode.EXISTING
          : ClientOnboardingDomainMode.KERSIVO_REGISTER,
      existingDomain: input.choice.domainMode === 'EXISTING' ? input.choice.hostname : null,
      preferredDomain1: input.choice.domainMode === 'KERSIVO_REGISTER' ? input.choice.hostname : null,
      preferredDomain2: null,
      preferredDomain3: null,
      domainRegistrationAuthorised: authorised,
      domainRegistrationAuthorisedAt: now,
    },
    update: {
      primaryContactName: input.contactName.trim() || input.preview.firstName,
      domainMode:
        input.choice.domainMode === 'EXISTING'
          ? ClientOnboardingDomainMode.EXISTING
          : ClientOnboardingDomainMode.KERSIVO_REGISTER,
      existingDomain: input.choice.domainMode === 'EXISTING' ? input.choice.hostname : null,
      preferredDomain1: input.choice.domainMode === 'KERSIVO_REGISTER' ? input.choice.hostname : null,
      preferredDomain2: null,
      preferredDomain3: null,
      domainRegistrationAuthorised: authorised,
      domainRegistrationAuthorisedAt: now,
    },
  });
}
