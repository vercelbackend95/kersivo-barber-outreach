import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { recordDebouncedPreviewRequestEvent } from '@/lib/adminHub/ownerEditEvents';
import { HEX_COLOUR_RE, normaliseHexColour } from './extractLogoColours';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import { HUB_DETAILS_INSTAGRAM_INVALID } from './hubCopy';
import { maybeNotifyOpsOfHubFiles } from './hubFilesNotify';
import { normaliseWorkLink } from './workLinkNormalise';

export const HUB_STYLE_NOTES_MAX = 500;
export const HUB_ABOUT_TEXT_MAX = 600;
export const HUB_WEBSITE_EXTRA_TEXT_MAX = 2000;

const optionalHex = z
  .union([z.string(), z.null()])
  .optional()
  .superRefine((value, ctx) => {
    if (value === undefined || value === null || value.trim() === '') return;
    if (!HEX_COLOUR_RE.test(value.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Colour must be #RRGGBB.' });
    }
  })
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null || value.trim() === '') return null;
    return normaliseHexColour(value);
  });

const optionalText = (max: number) =>
  z
    .union([z.string().max(max), z.null()])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === null ? null : value.trim() || null));

/** Accept @name, name, or an instagram.com URL; store https://www.instagram.com/<handle>/. */
export function normaliseHubInstagramUrl(raw: string | null | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const link = normaliseWorkLink('instagram', trimmed);
  if (!link?.handle) return null;
  return `https://www.instagram.com/${link.handle}/`;
}

const optionalInstagram = z
  .union([z.string(), z.null()])
  .optional()
  .superRefine((value, ctx) => {
    if (value === undefined || value === null || value.trim() === '') return;
    if (!normaliseHubInstagramUrl(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: HUB_DETAILS_INSTAGRAM_INVALID });
    }
  })
  .transform((value) => normaliseHubInstagramUrl(value));

export const hubDetailsSchema = z.object({
  brandPrimaryColour: optionalHex,
  brandSecondaryColour: optionalHex,
  styleNotes: optionalText(HUB_STYLE_NOTES_MAX),
  aboutText: optionalText(HUB_ABOUT_TEXT_MAX),
  instagramUrl: optionalInstagram,
  websiteExtraText: optionalText(HUB_WEBSITE_EXTRA_TEXT_MAX),
});

export type HubDetailsInput = z.infer<typeof hubDetailsSchema>;

export type HubDetailsPublic = {
  brandPrimaryColour: string | null;
  brandSecondaryColour: string | null;
  styleNotes: string | null;
  aboutText: string | null;
  instagramUrl: string | null;
  websiteExtraText: string | null;
};

export const hubAssetPatchSchema = z.object({
  caption: z
    .union([z.string().max(140), z.null()])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === null ? null : value.trim() || null)),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  barberId: z.union([z.string().min(1).max(64), z.null()]).optional(),
});

const TEXT_FIELDS = ['aboutText', 'instagramUrl', 'websiteExtraText'] as const;

export function publicHubDetails(row: {
  brandPrimaryColour: string | null;
  brandSecondaryColour: string | null;
  styleNotes: string | null;
  aboutText: string | null;
  instagramUrl: string | null;
  websiteExtraText: string | null;
}): HubDetailsPublic {
  return {
    brandPrimaryColour: row.brandPrimaryColour,
    brandSecondaryColour: row.brandSecondaryColour,
    styleNotes: row.styleNotes,
    aboutText: row.aboutText,
    instagramUrl: row.instagramUrl,
    websiteExtraText: row.websiteExtraText,
  };
}

export async function saveHubDetails(input: {
  requestId: string;
  patch: HubDetailsInput;
  shopName?: string;
  recordOwnerEvent?: boolean;
}): Promise<HubDetailsPublic> {
  const data: Record<string, string | null> = {};
  if (input.patch.brandPrimaryColour !== undefined) data.brandPrimaryColour = input.patch.brandPrimaryColour;
  if (input.patch.brandSecondaryColour !== undefined) data.brandSecondaryColour = input.patch.brandSecondaryColour;
  if (input.patch.styleNotes !== undefined) data.styleNotes = input.patch.styleNotes;
  if (input.patch.aboutText !== undefined) data.aboutText = input.patch.aboutText;
  if (input.patch.instagramUrl !== undefined) data.instagramUrl = input.patch.instagramUrl;
  if (input.patch.websiteExtraText !== undefined) data.websiteExtraText = input.patch.websiteExtraText;

  const fields = Object.keys(data);
  const textFields = fields.filter((field): field is (typeof TEXT_FIELDS)[number] =>
    (TEXT_FIELDS as readonly string[]).includes(field),
  );
  const otherFields = fields.filter((field) => !(TEXT_FIELDS as readonly string[]).includes(field));
  const recordOwnerEvent = input.recordOwnerEvent !== false;

  const row = await prisma.previewRequest.update({
    where: { id: input.requestId },
    data: {
      ...data,
      ...(recordOwnerEvent && otherFields.length
        ? {
            events: {
              create: { action: PREVIEW_REQUEST_ACTIONS.HUB_DETAILS_SAVED, meta: { fields: otherFields } },
            },
          }
        : {}),
    },
    select: {
      brandPrimaryColour: true,
      brandSecondaryColour: true,
      styleNotes: true,
      aboutText: true,
      instagramUrl: true,
      websiteExtraText: true,
      shopName: true,
    },
  });

  if (recordOwnerEvent && textFields.length) {
    await recordDebouncedPreviewRequestEvent({
      previewRequestId: input.requestId,
      action: PREVIEW_REQUEST_ACTIONS.OWNER_EDITED_WEBSITE_TEXT,
      meta: { fields: textFields, section: 'website-text' },
    });
    await maybeNotifyOpsOfHubFiles({
      requestId: input.requestId,
      shopName: input.shopName ?? row.shopName,
      detailsUpdated: true,
    }).catch((error) => {
      console.error('[preview-hub] details digest failed', error instanceof Error ? error.message : error);
    });
  }

  return publicHubDetails(row);
}
