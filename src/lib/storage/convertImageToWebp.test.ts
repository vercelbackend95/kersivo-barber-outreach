import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { convertImageFileToWebp } from './convertImageToWebp';

describe('convertImageFileToWebp', () => {
  it('converts a small PNG to a WebP buffer (sharp 0.35 regression)', async () => {
    const png = await sharp({
      create: {
        width: 32,
        height: 24,
        channels: 3,
        background: { r: 20, g: 40, b: 60 },
      },
    })
      .png()
      .toBuffer();

    const file = new File([png], 'sample.png', { type: 'image/png' });
    const webp = await convertImageFileToWebp(file, { maxDimension: 64, quality: 80 });

    expect(Buffer.isBuffer(webp)).toBe(true);
    expect(webp.byteLength).toBeGreaterThan(0);

    const meta = await sharp(webp).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(32);
    expect(meta.height).toBe(24);
  });

  it('rejects oversized inputs before decoding', async () => {
    const huge = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', {
      type: 'image/png',
    });
    await expect(convertImageFileToWebp(huge)).rejects.toThrow(/too large/i);
  });
});
