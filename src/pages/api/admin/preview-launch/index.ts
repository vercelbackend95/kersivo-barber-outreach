export const prerender = false;

import type { APIRoute } from 'astro';
import { analyticsClientIdFromRequest } from '@/lib/analytics/serverEvents';
import {
  launchBusinessSchema,
  launchChecklistPatchSchema,
  loadLaunchChecklist,
  markMigrationUploaded,
  saveLaunchBusinessDetails,
  skipLaunchItem,
} from '@/lib/freePreview/hubLaunch';
import { launchJson, requireLaunchOwner } from '@/lib/freePreview/hubLaunchApi';

export const GET: APIRoute = async (ctx) => {
  const access = await requireLaunchOwner(ctx, 'GET');
  if (access instanceof Response) return access;
  const state = await loadLaunchChecklist(access.shopId);
  if (!state) return launchJson({ error: 'Not found.' }, 404);
  return launchJson({ ok: true, checklist: state });
};

export const PATCH: APIRoute = async (ctx) => {
  const access = await requireLaunchOwner(ctx, 'MUTATE');
  if (access instanceof Response) return access;

  const body = await ctx.request.json().catch(() => null);
  const parsed = launchChecklistPatchSchema.safeParse(body);
  if (!parsed.success) return launchJson({ error: 'Validation failed.', details: parsed.error.flatten() }, 400);

  const clientId = analyticsClientIdFromRequest(ctx.request);
  if (parsed.data.item === 'business') {
    const business = launchBusinessSchema.safeParse(parsed.data);
    if (!business.success) return launchJson({ error: 'Validation failed.' }, 400);
    const { state } = await saveLaunchBusinessDetails({
      shopId: access.shopId,
      previewRequestId: access.previewRequestId,
      data: business.data,
      clientId,
    });
    return launchJson({ ok: true, checklist: state });
  }
  if (parsed.data.item === 'payments') {
    const state = await skipLaunchItem({
      shopId: access.shopId,
      previewRequestId: access.previewRequestId,
      item: 'payments',
      clientId,
    });
    return launchJson({ ok: true, checklist: state });
  }
  if (parsed.data.item === 'migration') {
    if (parsed.data.skip) {
      const state = await skipLaunchItem({
        shopId: access.shopId,
        previewRequestId: access.previewRequestId,
        item: 'migration',
        clientId,
      });
      return launchJson({ ok: true, checklist: state });
    }
    const state = await markMigrationUploaded({
      shopId: access.shopId,
      previewRequestId: access.previewRequestId,
      lawful: parsed.data.migrationDataConfirmedLawful === true,
      clientId,
    });
    return launchJson({ ok: true, checklist: state });
  }
  return launchJson({ error: 'Use the approve endpoint for launch approval.' }, 400);
};
