export const prerender = false;

/**
 * GET /api/ops/preview-requests/[id]/build-pack — everything the owner supplied, as one download for
 * building their website (docs/ops/build-pack.md).
 *   (default)      application/zip, streamed: originals from private Blob, never thumbnails
 *   ?format=md     brief.md as text (the "Copy brief" button)
 *   ?format=json   shop.json
 * Operators only. 404 unknown id, 410 personal data deleted.
 */
import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db/client';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import { defaultHubBlobClient } from '@/lib/freePreview/hubAssets';
import { loadBuildPack, type BuildPack } from '@/lib/ops/buildPack';
import { buildPackBriefMd } from '@/lib/ops/buildPackBrief';
import {
  REMOTE_IMAGE_NOT_FETCHED,
  extensionForContentType,
  fetchRemoteImage,
  isAllowedRemoteImageUrl,
  remoteImageStoreHost,
} from '@/lib/ops/buildPackRemoteImages';
import {
  buildPackChangeRequestsMd,
  buildPackColoursJson,
  buildPackFolderName,
  buildPackReadme,
  planBuildPackFiles,
  toBuildPackJson,
  uniquePath,
  withExtension,
  zipFileId,
  type BuildPackZipFile,
} from '@/lib/ops/buildPackZipPlan';
import { OPS_API_HEADERS, requireOperatorAccess } from '@/lib/ops/operatorAuth';
import { iterableToStream, readableToIterable, zipChunks, type ZipEntry } from '@/lib/ops/streamZip';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

const DOWNLOAD_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
} as const;

export const GET: APIRoute = async (context) => {
  const access = await requireOperatorAccess(context);
  if (access instanceof Response) return access;

  const id = (context.params.id ?? '').trim();
  if (!id || id.length > 64) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  const row = await prisma.previewRequest.findUnique({ where: { id }, select: { id: true, anonymisedAt: true } });
  if (!row) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  if (row.anonymisedAt) return json({ ok: false, error: { code: 'GONE' } }, 410);

  const now = new Date();
  const pack = await loadBuildPack(id, now);
  if (!pack) return json({ ok: false, error: { code: 'GONE' } }, 410);

  const folder = buildPackFolderName(pack, now);
  const files = planBuildPackFiles(pack);
  const format = new URL(context.request.url).searchParams.get('format');

  if (format === 'md') {
    return new Response(buildPackBriefMd(pack, files), {
      status: 200,
      headers: { ...DOWNLOAD_HEADERS, 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }
  if (format === 'json') {
    return new Response(JSON.stringify(toBuildPackJson(pack, files), null, 2), {
      status: 200,
      headers: {
        ...DOWNLOAD_HEADERS,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${folder}_shop.json"`,
      },
    });
  }

  const stream = iterableToStream(zipChunks(packEntries({ pack, folder, files, actorEmail: access.email })));
  return new Response(stream, {
    status: 200,
    headers: {
      ...DOWNLOAD_HEADERS,
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${folder}.zip"`,
    },
  });
};

function notFetchableIds(files: BuildPackZipFile[], storeHost = remoteImageStoreHost()): Set<string> {
  return new Set(files.filter((f) => f.remote && !isAllowedRemoteImageUrl(f.remote.url, storeHost)).map(zipFileId));
}

async function* oneChunk(bytes: Uint8Array): AsyncGenerator<Uint8Array> {
  yield bytes;
}

/**
 * Zip entries in order: originals first, then the text files, so README can list any file that could
 * not be read. The download event is recorded once the files have been streamed.
 */
async function* packEntries(input: {
  pack: BuildPack;
  folder: string;
  files: ReturnType<typeof planBuildPackFiles>;
  actorEmail: string | null;
}): AsyncGenerator<ZipEntry> {
  const { pack, folder, files } = input;
  const failed: Array<{ path: string; reason: string }> = [];
  const failedIds = new Set<string>();

  const storeHost = remoteImageStoreHost();
  const fail = (file: BuildPackZipFile, reason: string) => {
    failed.push({ path: file.path, reason });
    failedIds.add(zipFileId(file));
    console.error('[ops/build-pack] file skipped', { requestId: pack.requestId, fileId: zipFileId(file), reason });
  };

  for (const file of files) {
    if (file.remote) {
      // Dashboard images: one at a time, fully checked before the entry is added (never half-written).
      if (!isAllowedRemoteImageUrl(file.remote.url, storeHost)) {
        fail(file, REMOTE_IMAGE_NOT_FETCHED);
        continue;
      }
      const result = await fetchRemoteImage(file.remote.url, { storeHost });
      if (!result.ok) {
        fail(file, result.reason);
        continue;
      }
      if (!file.extFromUrl) {
        const taken = new Set(files.filter((other) => other !== file).map((other) => other.path.toLowerCase()));
        file.path = uniquePath(withExtension(file.path, extensionForContentType(result.contentType)), taken);
      }
      yield { path: `${folder}/${file.path}`, open: async () => oneChunk(result.bytes), onFail: (reason) => fail(file, reason) };
      continue;
    }
    const asset = file.asset;
    yield {
      path: `${folder}/${file.path}`,
      open: async () => {
        const blob = await defaultHubBlobClient.get(asset.storagePath);
        if (!blob.stream || blob.statusCode !== 200) return null;
        return readableToIterable(blob.stream);
      },
      onFail: (reason) => fail(file, reason),
    };
  }

  const included = files.length - failedIds.size;
  await prisma.previewRequestEvent
    .create({
      data: {
        previewRequestId: pack.requestId,
        action: PREVIEW_REQUEST_ACTIONS.OPS_BUILD_PACK_DOWNLOADED,
        actorEmail: input.actorEmail,
        meta: { fileCount: included, failedCount: failedIds.size },
      },
    })
    .catch((error) => {
      console.error('[ops/build-pack] event failed', error instanceof Error ? error.message : error);
    });

  yield { path: `${folder}/shop.json`, text: JSON.stringify(toBuildPackJson(pack, files, failedIds), null, 2) };
  yield { path: `${folder}/brand/colours.json`, text: JSON.stringify(buildPackColoursJson(pack), null, 2) };
  yield { path: `${folder}/revisions/change-requests.md`, text: buildPackChangeRequestsMd(pack, files) };
  yield { path: `${folder}/brief.md`, text: buildPackBriefMd(pack, files, failedIds) };
  yield { path: `${folder}/README.md`, text: buildPackReadme({ pack, folder, files, failed }) };
}
