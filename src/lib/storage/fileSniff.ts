/**
 * Magic-byte sniffing for Shop Hub uploads. Never trust the client MIME or extension.
 * SVG is text, so we also look at the decoded head (no script execution).
 */

export type SniffedFileKind = 'jpeg' | 'png' | 'webp' | 'pdf' | 'svg';

export type FileSniffResult =
  | { ok: true; kind: SniffedFileKind; mime: string; ext: string }
  | { ok: false; reason: 'empty' | 'unknown' };

const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const WEBP_RIFF = Buffer.from([0x52, 0x49, 0x46, 0x46]); // RIFF
const WEBP_WEBP = Buffer.from([0x57, 0x45, 0x42, 0x50]); // WEBP at offset 8
const MZ = Buffer.from([0x4d, 0x5a]); // Windows executable

function startsWith(buf: Buffer, magic: Buffer, offset = 0): boolean {
  if (buf.length < offset + magic.length) return false;
  return buf.subarray(offset, offset + magic.length).equals(magic);
}

function looksLikeSvg(buf: Buffer): boolean {
  const head = buf.subarray(0, Math.min(buf.length, 2048)).toString('utf8').replace(/^\uFEFF/, '').trimStart();
  if (head.startsWith('<?xml')) {
    return /<svg[\s>]/i.test(head);
  }
  return /^<svg[\s>]/i.test(head);
}

export function sniffFile(input: Buffer | Uint8Array): FileSniffResult {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buf.length === 0) return { ok: false, reason: 'empty' };
  if (startsWith(buf, MZ)) return { ok: false, reason: 'unknown' };
  if (startsWith(buf, JPEG)) return { ok: true, kind: 'jpeg', mime: 'image/jpeg', ext: 'jpg' };
  if (startsWith(buf, PNG)) return { ok: true, kind: 'png', mime: 'image/png', ext: 'png' };
  if (startsWith(buf, WEBP_RIFF) && startsWith(buf, WEBP_WEBP, 8)) {
    return { ok: true, kind: 'webp', mime: 'image/webp', ext: 'webp' };
  }
  if (startsWith(buf, PDF)) return { ok: true, kind: 'pdf', mime: 'application/pdf', ext: 'pdf' };
  if (looksLikeSvg(buf)) return { ok: true, kind: 'svg', mime: 'image/svg+xml', ext: 'svg' };
  return { ok: false, reason: 'unknown' };
}

export const HUB_KIND_ALLOWED_SNIFF: Record<string, readonly SniffedFileKind[]> = {
  LOGO: ['jpeg', 'png', 'webp', 'svg', 'pdf'],
  SHOP_PHOTO: ['jpeg', 'png', 'webp'],
  TEAM_PHOTO: ['jpeg', 'png', 'webp'],
  PRICE_LIST: ['jpeg', 'png', 'webp', 'pdf'],
  MESSAGE_ATTACHMENT: ['jpeg', 'png', 'webp', 'pdf'],
  CHANGE_ATTACHMENT: ['jpeg', 'png', 'webp', 'pdf'],
  OTHER: ['jpeg', 'png', 'webp', 'pdf'],
};

export function sniffAllowedForHubKind(
  kind: string,
  input: Buffer | Uint8Array,
): FileSniffResult | { ok: false; reason: 'empty' | 'unknown' | 'kind' } {
  const sniffed = sniffFile(input);
  if (!sniffed.ok) return sniffed;
  const allowed = HUB_KIND_ALLOWED_SNIFF[kind];
  if (!allowed) return { ok: false, reason: 'kind' };
  if (!allowed.includes(sniffed.kind)) return { ok: false, reason: 'kind' };
  return sniffed;
}
