export const prerender = false;

import type { APIRoute } from 'astro';
import { ClientOnboardingAssetKind } from '@prisma/client';
import { resolveAdminAccess } from '@/lib/admin/auth';
import {
  assertWritableClientOnboarding,
  ensureClientOnboarding,
  requireClientOnboardingAccess,
} from '@/lib/admin/clientOnboarding/service';
import { prisma } from '@/lib/db/client';
import {
  assetValidationMessage,
  deletePrivateOnboardingFile,
  makePrivateOnboardingPath,
  uploadPrivateOnboardingFile,
  validateOnboardingAssetFile,
} from '@/lib/storage/privateOnboardingBlob';

const KIND_VALUES = new Set(Object.values(ClientOnboardingAssetKind));

function parseKind(raw: FormDataEntryValue | null): ClientOnboardingAssetKind | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim() as ClientOnboardingAssetKind;
  return KIND_VALUES.has(value) ? value : null;
}

export const POST: APIRoute = async (ctx) => {
  const accessOrErr = await requireClientOnboardingAccess(await resolveAdminAccess(ctx));
  if (accessOrErr instanceof Response) return accessOrErr;

  const writable = await assertWritableClientOnboarding(accessOrErr.shopId);
  if (writable instanceof Response) return writable;

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

    const onboarding = await ensureClientOnboarding(accessOrErr.shopId);
    const asset = await prisma.clientOnboardingAsset.create({
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
        console.error('[client-onboarding] orphan private blob cleanup failed', {
          pathname: uploadedPathname,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
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

  const writable = await assertWritableClientOnboarding(accessOrErr.shopId);
  if (writable instanceof Response) return writable;

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

  const asset = await prisma.clientOnboardingAsset.findFirst({
    where: { id, shopId: accessOrErr.shopId },
  });
  if (!asset) {
    return new Response(JSON.stringify({ error: 'Asset not found.' }), { status: 404 });
  }

  try {
    await deletePrivateOnboardingFile(asset.storagePath);
  } catch (error) {
    console.error('[client-onboarding] private blob delete failed; keeping DB row', {
      assetId: asset.id,
      pathname: asset.storagePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(
      JSON.stringify({
        error: 'Unable to delete private file. Metadata retained for retry.',
        code: 'PRIVATE_BLOB_DELETE_FAILED',
      }),
      { status: 503 },
    );
  }

  try {
    await prisma.clientOnboardingAsset.delete({ where: { id: asset.id } });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to delete onboarding asset.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
