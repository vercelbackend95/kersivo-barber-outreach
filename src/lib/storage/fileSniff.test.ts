import { describe, expect, it } from 'vitest';
import { sniffAllowedForHubKind, sniffFile } from './fileSniff';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x10, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from([0x00, 0x00]),
]);
const PDF = Buffer.from('%PDF-1.4\n', 'ascii');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf8');
const EXE = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00]), Buffer.alloc(20, 0xff)]);

describe('sniffFile', () => {
  it('detects jpeg, png, webp, pdf and svg from magic bytes', () => {
    expect(sniffFile(JPEG)).toMatchObject({ ok: true, kind: 'jpeg' });
    expect(sniffFile(PNG)).toMatchObject({ ok: true, kind: 'png' });
    expect(sniffFile(WEBP)).toMatchObject({ ok: true, kind: 'webp' });
    expect(sniffFile(PDF)).toMatchObject({ ok: true, kind: 'pdf' });
    expect(sniffFile(SVG)).toMatchObject({ ok: true, kind: 'svg' });
  });

  it('rejects empty buffers, executables and unknown bytes', () => {
    expect(sniffFile(Buffer.alloc(0))).toEqual({ ok: false, reason: 'empty' });
    expect(sniffFile(EXE)).toEqual({ ok: false, reason: 'unknown' });
    expect(sniffFile(Buffer.from([0x00, 0x01, 0x02, 0x03]))).toEqual({ ok: false, reason: 'unknown' });
  });

  it('never trusts a renamed .exe as a shop photo', () => {
    expect(sniffAllowedForHubKind('SHOP_PHOTO', EXE)).toEqual({ ok: false, reason: 'unknown' });
    expect(sniffAllowedForHubKind('SHOP_PHOTO', JPEG)).toMatchObject({ ok: true, kind: 'jpeg' });
    expect(sniffAllowedForHubKind('SHOP_PHOTO', PDF)).toEqual({ ok: false, reason: 'kind' });
    expect(sniffAllowedForHubKind('LOGO', SVG)).toMatchObject({ ok: true, kind: 'svg' });
  });
});
