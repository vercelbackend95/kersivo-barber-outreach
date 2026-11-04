/**
 * Which database fields reach the ops build pack (src/lib/ops/buildPack.ts) and which are left out on purpose.
 *
 * Every scalar column of these models must be in exactly one of the two lists; buildPack.coverage.test.ts
 * checks that against the Prisma schema, so a new hub field cannot silently miss /ops again. The loader's
 * Prisma `select` objects are built from the MAPPED lists, so "mapped" always means "actually read".
 *
 * No Prisma import here: the lists are plain data, safe for any test or client graph.
 */

export type BuildPackModel = 'PreviewRequest' | 'ShopSettings' | 'ShopPublicProfile' | 'Service' | 'Barber' | 'Product' | 'PreviewHubAsset' | 'PreviewChangeRequest';

/** Fields the loader reads (website-relevant, supplied by the owner or set for the build). */
export const BUILD_PACK_MAPPED_FIELDS = {
  PreviewRequest: [
    'id',
    'shopName',
    'townCity',
    'bookingPageUrl',
    'instagramUrl',
    'googleListingUrl',
    'websiteUrl',
    'workLinks',
    'barberCount',
    'currentBookingSystem',
    'hasOwnDomain',
    'notes',
    'draftShopId',
    'changesRequestedText',
    'changesRequestedAt',
    'anonymisedAt',
    'brandPrimaryColour',
    'brandSecondaryColour',
    'brandBackgroundTone',
    'brandColoursSource',
    'brandPaletteExtracted',
    'brandColoursSentAt',
    'brandSubmittedSnapshot',
    'styleNotes',
    'aboutText',
    'websiteExtraText',
  ],
  ShopSettings: ['id', 'name', 'townCity', 'logoUrl', 'bookingSlug', 'sitePreviewUrl', 'sitePreviewVersion'],
  ShopPublicProfile: [
    'tagline',
    'description',
    'addressLine1',
    'addressLine2',
    'postcode',
    'phone',
    'email',
    'instagramUrl',
    'facebookUrl',
    'tiktokUrl',
    'otherSocialUrl',
    'brandPrimaryColour',
    'brandSecondaryColour',
    'updatedAt',
  ],
  Service: ['id', 'name', 'description', 'imageUrl', 'pricePence', 'priceFrom', 'durationMinutes', 'displayOrder', 'category', 'featured'],
  Barber: ['id', 'name', 'avatarUrl', 'title', 'bio', 'sortOrder'],
  Product: ['id', 'name', 'description', 'pricePence', 'imageUrl', 'featured', 'category', 'sortOrder'],
  PreviewHubAsset: [
    'id',
    'kind',
    'storagePath',
    'thumbPath',
    'originalFileName',
    'contentType',
    'sizeBytes',
    'width',
    'height',
    'caption',
    'sortOrder',
    'barberId',
    'uploadedBy',
    'createdAt',
  ],
  PreviewChangeRequest: ['id', 'round', 'page', 'body', 'attachmentId', 'status', 'createdAt', 'sentAt'],
} as const satisfies Record<BuildPackModel, readonly string[]>;

/**
 * Fields deliberately left out, with the reason. The coverage test checks every model listed here in full.
 * ShopSettings is not listed: it is mostly booking/billing configuration, and the hub only writes name and
 * town to it (both mapped).
 */
export const BUILD_PACK_EXCLUDED_FIELDS: Record<'PreviewRequest' | 'ShopPublicProfile' | 'Service' | 'Barber' | 'Product' | 'PreviewHubAsset' | 'PreviewChangeRequest', Record<string, string>> = {
  PreviewRequest: {
    publicToken: 'Secret capability token.',
    publicTokenHash: 'Secret token hash.',
    status: 'Lifecycle, shown in Request admin.',
    firstName: 'Owner personal data, not website content (data minimisation).',
    email: 'Owner personal request email, not the public shop email.',
    authorisationConsentAt: 'Consent record, shown in Request admin.',
    authorisationStatementVersion: 'Consent record, shown in Request admin.',
    marketingOptInAt: 'Marketing consent, shown in Request admin.',
    detailsTokenHash: 'Secret token hash.',
    detailsTokenExpiresAt: 'Token lifecycle.',
    entryPoint: 'Internal attribution, shown in Request admin.',
    previewReadyAt: 'Lifecycle date.',
    firstViewedAt: 'Lifecycle date.',
    lastViewedAt: 'Lifecycle date.',
    viewCount: 'Lifecycle counter.',
    expiresAt: 'Lifecycle date.',
    convertedAt: 'Lifecycle date.',
    stripeCustomerId: 'Billing identifier.',
    stripeSubscriptionId: 'Billing identifier.',
    declinedAt: 'Lifecycle date.',
    rejectedAt: 'Lifecycle date.',
    followupSentAt: 'Email log.',
    expiryReminderSentAt: 'Email log.',
    emailOptOut: 'Email preference.',
    emailOptOutAt: 'Email preference.',
    internalNotes: 'KERSIVO internal notes, not owner-supplied.',
    brandPaletteLogoAssetId: 'Cache key for palette extraction; the logo itself is in the pack.',
    brandSubmittedByUserId: 'Account id of the submitter.',
    includedChangeRounds: 'Commercial allowance, not website content.',
    changeRoundsUsed: 'Commercial allowance, not website content.',
    ownerLastSeenAt: 'Activity timestamp.',
    opsLastSeenAt: 'Activity timestamp.',
    opsFilesNotifiedAt: 'Notification log.',
    opsMessagesNotifiedAt: 'Notification log.',
    launchApprovedAt: 'Launch lifecycle.',
    liveAt: 'Launch lifecycle.',
    ourStepDomainAt: 'Launch lifecycle.',
    ourStepSslAt: 'Launch lifecycle.',
    createdAt: 'Lifecycle date, shown in Request admin.',
    updatedAt: 'Row bookkeeping.',
  },
  ShopPublicProfile: {
    id: 'Row id.',
    shopId: 'Foreign key; the shop is identified by the request.',
    createdAt: 'Row bookkeeping.',
  },
  Service: {
    shopId: 'Foreign key.',
    bufferMinutes: 'Booking engine setting, not shown to clients.',
    isActive: 'Used as a filter: only active services are included.',
    createdAt: 'Row bookkeeping.',
    updatedAt: 'Row bookkeeping.',
  },
  Barber: {
    shopId: 'Foreign key.',
    userId: 'Account link.',
    email: 'Barber personal email.',
    showOnWebsite: 'Used as a filter: only barbers shown on the website are included.',
    active: 'Used as a filter: only active barbers are included.',
    intendedRole: 'Dashboard permission, not website content.',
    createdAt: 'Row bookkeeping.',
    updatedAt: 'Row bookkeeping.',
  },
  Product: {
    shopId: 'Foreign key.',
    active: 'Used as a filter: only active products are included.',
    inStock: 'Stock level, not for the website build.',
    createdAt: 'Row bookkeeping.',
    updatedAt: 'Row bookkeeping.',
  },
  PreviewHubAsset: {
    previewRequestId: 'Foreign key.',
    deletedAt: 'Used as a filter: deleted files are left out.',
  },
  PreviewChangeRequest: {
    previewRequestId: 'Foreign key.',
    anchor: 'Pin data, unused.',
    opsNote: 'KERSIVO internal note.',
    resolvedAt: 'Lifecycle date.',
  },
};

export function selectFor<M extends BuildPackModel>(model: M): Record<(typeof BUILD_PACK_MAPPED_FIELDS)[M][number], true> {
  return Object.fromEntries(BUILD_PACK_MAPPED_FIELDS[model].map((field) => [field, true])) as Record<
    (typeof BUILD_PACK_MAPPED_FIELDS)[M][number],
    true
  >;
}
