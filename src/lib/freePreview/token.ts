import { timingSafeEqual } from 'node:crypto';
import { hashPreviewToken } from '@/lib/preview/shopPreviewSession';

/** mintPreviewToken(): 32 random bytes as base64url, i.e. exactly 43 characters (256-bit). */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isWellFormedPreviewToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/** Lookup key stored in PreviewRequest.publicTokenHash. */
export function previewTokenLookupHash(token: string): string {
  return hashPreviewToken(token);
}

/** Constant-time comparison of the presented token with the stored one. */
export function previewTokensMatch(presented: string, stored: string): boolean {
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(stored, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
