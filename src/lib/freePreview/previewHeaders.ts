/** Shared private-preview response headers (docs/preview-hub/HUB_SPEC.md §11 / GLOBAL RULE 6). */
export const PRIVATE_PREVIEW_HEADERS: Record<string, string> = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'private, no-store',
  // The token is in the URL: never send it to the framed site or to any link target.
  'Referrer-Policy': 'no-referrer',
  Vary: 'Cookie',
};

export function applyPrivatePreviewHeaders(headers: Headers): void {
  for (const [name, value] of Object.entries(PRIVATE_PREVIEW_HEADERS)) {
    headers.set(name, value);
  }
}

export function previewNotFoundResponse(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { ...PRIVATE_PREVIEW_HEADERS, 'Content-Type': 'text/plain' },
  });
}
