import { describe, expect, it } from 'vitest';
import { resolveKersivoAccess } from './kersivoAccess';
import { resolvePublicBookingDestination } from './publicBookingDestination';

const shop = { id: 'shop-1', bookingSlug: 'fade-room' };
const OWN = 'https://faderoom.co.uk/book';
const verified = { shopId: 'shop-1', status: 'VERIFIED_LIVE', url: OWN };
const hosted = (source: 'starter_hosted' | 'full_hosted_fallback') => ({
  kind: 'hosted',
  path: '/book/fade-room',
  source,
});

const NOW = new Date('2026-10-05T12:00:00.000Z');
const activeFull = { status: 'ACTIVE', currentPeriodEnd: new Date('2026-11-05T00:00:00.000Z') };

/** Shop fields that support the site-launch / onboarding workflow but are NOT routing authority. */
const deliveryWorkflowFields = {
  sitePreviewUrl: 'https://fade-room-preview.vercel.app',
  sitePreviewVersion: 'v4',
  sitePreviewReadyAt: new Date('2026-09-01'),
  launchApprovedAt: new Date('2026-09-02'),
  launchApprovedVersion: 'v4',
  goLiveAt: new Date('2026-09-02'),
  onboarding: {
    currentWebsiteUrl: 'https://faderoom-old.co.uk',
    domainMode: 'EXISTING',
    existingDomain: 'faderoom.co.uk',
    domainRegistrar: 'GoDaddy',
    preferredDomain1: 'faderoom.london',
    preferredDomain2: 'thefaderoom.co.uk',
    preferredDomain3: null,
    domainRegistrationAuthorised: true,
  },
};

function resolveFor(shopFields: Record<string, unknown>, subscription: Record<string, unknown> | null, record = null as typeof verified | null) {
  const access = resolveKersivoAccess(
    { id: 'shop-1', shopPaidAt: null, smsRemindersEnabled: false, freeBookingActivatedAt: null, ...shopFields } as never,
    subscription as never,
    NOW,
  );
  return resolvePublicBookingDestination({ state: access.state, shop, fullDestination: record });
}

describe('resolvePublicBookingDestination (authoritative source)', () => {
  it('1 + E: Starter uses hosted /book/{slug}, even with a stored Full destination', () => {
    expect(resolvePublicBookingDestination({ state: 'FREE_BOOKING', shop, fullDestination: verified })).toEqual(
      hosted('starter_hosted'),
    );
  });

  it('2 + A: Full with no verified destination uses the hosted fallback (payment alone never switches)', () => {
    expect(resolvePublicBookingDestination({ state: 'FULL_KERSIVO', shop })).toEqual(hosted('full_hosted_fallback'));
    expect(resolveFor({}, activeFull)).toEqual(hosted('full_hosted_fallback'));
  });

  it('3 + D: Full with a verified live destination uses that exact URL', () => {
    expect(resolvePublicBookingDestination({ state: 'FULL_KERSIVO', shop, fullDestination: verified })).toEqual({
      kind: 'own_domain',
      url: OWN,
      source: 'full_verified_own_domain',
    });
  });

  it('4: SETUP exposes no active booking destination', () => {
    expect(resolvePublicBookingDestination({ state: 'SETUP', shop, fullDestination: verified })).toEqual({
      kind: 'unavailable',
      source: 'setup_unavailable',
    });
  });

  it.each(['WINDING_DOWN', 'RETENTION'])('5 + H: %s departure cannot use a stored Full destination', (status) => {
    expect(
      resolveFor(
        { freeBookingActivatedAt: new Date('2026-01-01'), departure: { status } },
        { status: 'CANCELED', currentPeriodEnd: new Date('2026-09-01'), postFullPlan: 'LEAVE' },
        verified,
      ),
    ).toEqual({ kind: 'unavailable', source: 'setup_unavailable' });
  });

  it.each([
    ['6: sitePreviewUrl', { sitePreviewUrl: deliveryWorkflowFields.sitePreviewUrl }],
    ['sitePreviewReadyAt', { sitePreviewReadyAt: deliveryWorkflowFields.sitePreviewReadyAt }],
    ['7: launchApprovedAt', { launchApprovedAt: deliveryWorkflowFields.launchApprovedAt }],
    ['launchApprovedVersion', { launchApprovedVersion: 'v4' }],
    ['8: goLiveAt', { goLiveAt: deliveryWorkflowFields.goLiveAt }],
    ['9: onboarding existingDomain', { onboarding: { existingDomain: 'faderoom.co.uk' } }],
    ['10: onboarding preferredDomain1', { onboarding: { preferredDomain1: 'faderoom.london' } }],
    ['11: onboarding currentWebsiteUrl', { onboarding: { currentWebsiteUrl: 'https://faderoom-old.co.uk' } }],
    ['domainRegistrationAuthorised', { onboarding: { domainRegistrationAuthorised: true } }],
    ['B + C: all delivery workflow fields together', deliveryWorkflowFields],
  ])('%s alone does not switch the Full destination', (_label, fields) => {
    expect(resolveFor(fields, activeFull)).toEqual(hosted('full_hosted_fallback'));
  });

  it('only a VERIFIED_LIVE record for the SAME shop counts', () => {
    expect(
      resolvePublicBookingDestination({ state: 'FULL_KERSIVO', shop, fullDestination: { ...verified, status: 'INVALIDATED' } }),
    ).toEqual(hosted('full_hosted_fallback'));
    expect(
      resolvePublicBookingDestination({ state: 'FULL_KERSIVO', shop, fullDestination: { ...verified, shopId: 'shop-2' } }),
    ).toEqual(hosted('full_hosted_fallback'));
  });

  it('46: Full → Starter keeps the record but the resolver ignores it', () => {
    const starterAgain = resolveFor({}, { status: 'CANCELED', currentPeriodEnd: new Date('2026-09-01'), postFullPlan: 'STARTER' }, verified);
    expect(starterAgain).toEqual(hosted('starter_hosted'));
  });

  it('44 / 45: Starter → Full is hosted before verification and own-domain after', () => {
    expect(resolveFor({}, activeFull, null)).toEqual(hosted('full_hosted_fallback'));
    expect(resolveFor({}, activeFull, verified)).toMatchObject({ kind: 'own_domain', url: OWN });
  });
});
