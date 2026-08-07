export const prerender = false;

import type { APIRoute } from 'astro';
import { ClientOnboardingAssetKind } from '@prisma/client';
import { resolveAdminAccess } from '@/lib/admin/auth';
import {
  assertWritableClientOnboarding,
  ensureClientOnboarding,
  requireClientOnboardingAccess,
} from '@/lib/admin/clientOnboarding/service';
import {
  clientOnboardingLockedResponse,
  isClientOnboardingWriteLocked,
} from '@/lib/admin/clientOnboarding/schema';
import { withClientOnboardingWriteLock } from '@/lib/admin/clientOnboarding/writeLock';
import {
  assetValidationMessage,
  deletePrivateOnboardingFile,
  makePrivateOnboardingPath,
  uploadPrivateOnboardingFile,
  validateOnboardingAssetFile,
} from '@/lib/storage/privateOnboardingBlob';
import { notifyOpsDurable } from '@/lib/ops/stripeWebhookLedger';

const KIND_VALUES = new Set(Object.values(ClientOnboardingAssetKind));

function parseKind(raw: FormDataEntryValue | null): ClientOnboardingAssetKind | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim() as ClientOnboardingAssetKind;
  return KIND_VALUES.has(value) ? value : null;
}

async function alertPrivateBlobCleanupFailed(input: {
  shopId: string;
  pathname: string;
  kind: string;
  filename: string;
  reason: 'db_finalize_failed' | 'locked_before_finalize';
  error: unknown;
}): Promise<void> {
  const errorMessage =
    input.error instanceof Error ? input.error.message : String(input.error);
  console.error('[client-onboarding] private blob cleanup failed', {
    shopId: input.shopId,
    pathname: input.pathname,
    kind: input.kind,
    reason: input.reason,
    error: errorMessage,
  });
  try {
    await notifyOpsDurable({
      severity: 'critical',
      title: 'Client onboarding private blob cleanup failed',
      body: errorMessage.slice(0, 500),
      dedupeKey: `client-onboarding:blob-cleanup:${input.pathname}`,
      fields: {
        shopId: input.shopId,
        pathname: input.pathname,
        kind: input.kind,
        filename: input.filename,
        reason: input.reason,
      },
    });
  } catch (alertError) {
    console.error('[client-onboarding] ops alert for blob cleanup failed', {
      pathname: input.pathname,
      error: alertError instanceof Error ? alertError.message : String(alertError),
    });
  }
}

export const POST: APIRoute = async (ctx) => {
  const accessOrErr = await requireClientOnboardingAccess(await resolveAdminAccess(ctx));
  if (accessOrErr instanceof Response) return accessOrErr;

  // Fast reject before upload when already locked (still re-checked under write lock).
  const earlyWritable = await assertWritableClientOnboarding(accessOrErr.shopId);
  if (earlyWritable instanceof Response) return earlyWritable;

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Expected multipart form data.' }), {
      status: 400,
    });
  }

  const kind = parseKind(form.get('kind'));
  if (!kind) {
    return new Response(JSON.stringify({ error: 'Valid asset kind is required.' }), {
      status: 400,
    });
  }

  const filePart = form.get('file');
  if (!(filePart instanceof File)) {
    return new Response(JSON.stringify({ error: 'File is required.' }), { status: 400 });
  }

  const invalid = validateOnboardingAssetFile(kind, filePart);
  if (invalid) {
    return new Response(
      JSON.stringify({ error: assetValidationMessage(invalid), code: invalid }),
      { status: 400 },
    );
  }

  const storagePath = makePrivateOnboardingPath(
    accessOrErr.shopId,
    kind,
    filePart.name,
  );

  let uploadedPathname: string | null = null;
  try {
    const uploaded = await uploadPrivateOnboardingFile(
      filePart,
      storagePath,
      filePart.type || undefined,
    );
    uploadedPathname = uploaded.pathname;

    type FinalizeResult =
      | { kind: 'locked' }
      | {
          kind: 'created';
          asset: {
            id: string;
            kind: string;
            storagePath: string;
            originalFileName: string;
            contentType: string;
            sizeBytes: number;
            createdAt: Date;
          };
        };

    const finalized = await withClientOnboardingWriteLock(
      accessOrErr.shopId,
      async (tx): Promise<FinalizeResult> => {
        const onboarding = await ensureClientOnboarding(accessOrErr.shopId, tx);
        if (isClientOnboardingWriteLocked(onboarding.status)) {
          return { kind: 'locked' };
        }

        const asset = await tx.clientOnboardingAsset.create({
          data: {
            shopId: accessOrErr.shopId,
            onboardingId: onboarding.id,
            kind,
            storagePath: uploaded.pathname,
            originalFileName: filePart.name.trim(),
            contentType: uploaded.contentType,
            sizeBytes: uploaded.sizeBytes,
          },
        });
        return { kind: 'created', asset };
      },
    );

    if (finalized.kind === 'locked') {
      try {
        await deletePrivateOnboardingFile(uploaded.pathname);
      } catch (cleanupError) {
        await alertPrivateBlobCleanupFailed({
          shopId: accessOrErr.shopId,
          pathname: uploaded.pathname,
          kind,
          filename: filePart.name.trim(),
          reason: 'locked_before_finalize',
          error: cleanupError,
        });
      }
      return clientOnboardingLockedResponse();
    }

    const asset = finalized.asset;
    return new Response(
      JSON.stringify({
        ok: true,
        asset: {
          id: asset.id,
          kind: asset.kind,
          storagePath: asset.storagePath,
          originalFileName: asset.originalFileName,
          contentType: asset.contentType,
          sizeBytes: asset.sizeBytes,
          createdAt: asset.createdAt.toISOString(),
        },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    if (uploadedPathname) {
      try {
        await deletePrivateOnboardingFile(uploadedPathname);
      } catch (cleanupError) {
        await alertPrivateBlobCleanupFailed({
          shopId: accessOrErr.shopId,
          pathname: uploadedPathname,
          kind,
          filename: filePart.name.trim(),
          reason: 'db_finalize_failed',
          error: cleanupError,
        });
      }
    }
    const message =
      error instanceof Error ? error.message : 'Unable to upload onboarding asset.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};

export const DELETE: APIRoute = async (ctx) => {
  const accessOrErr = await requireClientOnboardingAccess(await resolveAdminAccess(ctx));
  if (accessOrErr instanceof Response) return accessOrErr;

  let body: { id?: string };
  try {
    body = (await ctx.request.json()) as { id?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) {
    return new Response(JSON.stringify({ error: 'Asset id is required.' }), { status: 400 });
  }

  try {
    type DeleteResult =
      | { kind: 'locked' }
      | { kind: 'not_found' }
      | { kind: 'blob_failed' }
      | { kind: 'ok' };

    const result = await withClientOnboardingWriteLock(
      accessOrErr.shopId,
      async (tx): Promise<DeleteResult> => {
        const writable = await assertWritableClientOnboarding(accessOrErr.shopId, tx);
        if (writable instanceof Response) return { kind: 'locked' };

        const asset = await tx.clientOnboardingAsset.findFirst({
          where: { id, shopId: accessOrErr.shopId },
        });
        if (!asset) return { kind: 'not_found' };

        try {
          await deletePrivateOnboardingFile(asset.storagePath);
        } catch (error) {
          console.error('[client-onboarding] private blob delete failed; keeping DB row', {
            assetId: asset.id,
            pathname: asset.storagePath,
            error: error instanceof Error ? error.message : String(error),
          });
          return { kind: 'blob_failed' };
        }

        await tx.clientOnboardingAsset.delete({ where: { id: asset.id } });
        return { kind: 'ok' };
      },
    );

    if (result.kind === 'locked') return clientOnboardingLockedResponse();
    if (result.kind === 'not_found') {
      return new Response(JSON.stringify({ error: 'Asset not found.' }), { status: 404 });
    }
    if (result.kind === 'blob_failed') {
      return new Response(
        JSON.stringify({
          error: 'Unable to delete private file. Metadata retained for retry.',
          code: 'PRIVATE_BLOB_DELETE_FAILED',
        }),
        { status: 503 },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to delete onboarding asset.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
