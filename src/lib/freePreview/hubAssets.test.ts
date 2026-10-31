import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { sniffFile } from '@/lib/storage/fileSniff';

const { findMany, create, count, update, findFirst, deleteMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  findFirst: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    previewHubAsset: { findMany, create, count, update, findFirst, deleteMany },
  },
}));
vi.mock('@/lib/storage/privateOnboardingBlob', () => ({
  uploadPrivateOnboardingFile: vi.fn(),
  deletePrivateOnboardingFile: vi.fn(),
  retrievePrivateOnboardingFile: vi.fn(),
}));

import {
  assertHubUploadCaps,
  collectHubAssetBlobPaths,
  deleteHubAssetRows,
  deleteHubBlobPaths,
  hubAssetServePlan,
  makeHubAssetPath,
  processHubUpload,
  serializeHubAsset,
} from './hubAssets';

function jpegWithGps(jpeg: Buffer): Buffer {
  const app1Body = Buffer.from([
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
    0x25, 0x88, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x1a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x02, 0x00, 0x02, 0x00, 0x00, 0x00, 0x4e, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00,
  ]);
  const app1 = Buffer.alloc(4 + app1Body.length);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1.writeUInt16BE(app1.length - 2, 2);
  app1Body.copy(app1, 4);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('processHubUpload', () => {
  it('strips EXIF/GPS from a JPEG fixture and stores a re-encoded image', async () => {
    const raw = await sharp({
      create: { width: 80, height: 60, channels: 3, background: { r: 20, g: 80, b: 40 } },
    })
      .jpeg()
      .toBuffer();
    const withGps = jpegWithGps(raw);
    expect(withGps.includes(Buffer.from('Exif'))).toBe(true);
    expect(withGps.includes(Buffer.from([0x25, 0x88]))).toBe(true);

    const result = await processHubUpload({
      bytes: withGps,
      originalFileName: 'shop.jpg',
      kind: 'SHOP_PHOTO',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meta = await sharp(result.file.buffer).metadata();
    expect(meta.exif).toBeUndefined();
    expect(result.file.buffer.includes(Buffer.from('Exif'))).toBe(false);
    expect(result.file.thumb?.contentType).toBe('image/webp');
  });

  it('rejects a renamed executable even when the name ends in .jpg', async () => {
    const exe = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(64, 1)]);
    const result = await processHubUpload({
      bytes: exe,
      originalFileName: 'virus.jpg',
      kind: 'SHOP_PHOTO',
    });
    expect(result.ok).toBe(false);
  });

  it('stores SVG originals and a raster thumb, and never plans to serve SVG inline', async () => {
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10" fill="#d72638"/></svg>`,
      'utf8',
    );
    expect(sniffFile(svg)).toMatchObject({ kind: 'svg' });
    const result = await processHubUpload({
      bytes: svg,
      originalFileName: 'logo.svg',
      kind: 'LOGO',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.contentType).toBe('image/svg+xml');
    expect(result.file.buffer.includes(Buffer.from('<script>'))).toBe(true);
    expect(result.file.thumb?.contentType).toBe('image/png');
    const plan = hubAssetServePlan({ size: 'full', contentType: 'image/svg+xml', sniffedExt: 'svg' });
    expect(plan.disposition).toBe('attachment');
    expect(plan.contentType).toBe('application/octet-stream');
  });

  it('stores PDFs as-is and serves them as attachments', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n', 'ascii');
    const result = await processHubUpload({
      bytes: pdf,
      originalFileName: 'menu.pdf',
      kind: 'PRICE_LIST',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.contentType).toBe('application/pdf');
    expect(result.file.thumb).toBeNull();
    expect(hubAssetServePlan({ size: 'full', contentType: 'application/pdf' }).disposition).toBe('attachment');
  });
});

describe('hub asset helpers', () => {
  it('builds a private preview-hub path without the original file name', () => {
    const path = makeHubAssetPath('req_1', 'SHOP_PHOTO', 'jpg');
    expect(path.startsWith('preview-hub/req_1/shop_photo/')).toBe(true);
    expect(path.endsWith('.jpg')).toBe(true);
    expect(path).not.toContain('secret');
  });

  it('serialises an asset without storage paths', () => {
    const json = serializeHubAsset({
      id: 'asset_1',
      kind: 'LOGO',
      originalFileName: 'mark.png',
      contentType: 'image/png',
      sizeBytes: 1200,
      width: 64,
      height: 64,
      caption: null,
      sortOrder: 0,
      barberId: null,
      uploadedBy: 'OWNER',
      createdAt: new Date('2026-10-31T12:00:00Z'),
      thumbPath: 'preview-hub/req/logo/thumb.webp',
    });
    expect(json.hasThumb).toBe(true);
    expect(JSON.stringify(json)).not.toContain('preview-hub/');
  });

  it('enforces per-request caps', async () => {
    findMany.mockResolvedValueOnce(Array.from({ length: 60 }, () => ({ kind: 'SHOP_PHOTO', sizeBytes: 10 })));
    expect((await assertHubUploadCaps({ previewRequestId: 'req', kind: 'OTHER', incomingBytes: 10 })).ok).toBe(false);
    findMany.mockResolvedValueOnce([{ kind: 'PRICE_LIST', sizeBytes: 10 }]);
    expect((await assertHubUploadCaps({ previewRequestId: 'req', kind: 'PRICE_LIST', incomingBytes: 10 })).ok).toBe(
      true,
    );
    findMany.mockResolvedValueOnce(Array.from({ length: 5 }, () => ({ kind: 'PRICE_LIST', sizeBytes: 10 })));
    expect((await assertHubUploadCaps({ previewRequestId: 'req', kind: 'PRICE_LIST', incomingBytes: 10 })).ok).toBe(
      false,
    );
  });
});

describe('purge hub assets with a fake blob client', () => {
  it('deletes rows and every stored blob path', async () => {
    const db = {
      previewHubAsset: {
        findMany: vi.fn(async () => [
          { storagePath: 'preview-hub/req/logo/a.svg', thumbPath: 'preview-hub/req/logo/a.png' },
          { storagePath: 'preview-hub/req/photo/b.jpg', thumbPath: null },
        ]),
        deleteMany: vi.fn(async () => ({ count: 2 })),
      },
    };
    const deleted: string[] = [];
    const paths = await collectHubAssetBlobPaths(db as never, 'req');
    expect(paths).toEqual([
      'preview-hub/req/logo/a.svg',
      'preview-hub/req/logo/a.png',
      'preview-hub/req/photo/b.jpg',
    ]);
    expect(await deleteHubAssetRows(db as never, 'req')).toBe(2);
    await deleteHubBlobPaths(paths, { delete: async (path) => { deleted.push(path); } });
    expect(deleted).toEqual(paths);
  });
});
