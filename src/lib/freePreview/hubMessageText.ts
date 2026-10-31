export const HUB_MESSAGE_EXCERPT_CHARS = 500;
const URL_IN_TEXT = /\bhttps?:\/\/[^\s<]+/gi;

export function hubMessageExcerpt(body: string, max = HUB_MESSAGE_EXCERPT_CHARS): string {
  const normalised = body.replace(/\r\n/g, '\n').trim();
  if (normalised.length <= max) return normalised;
  return `${normalised.slice(0, max).trimEnd()}…`;
}

export function escapeHubText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function splitHubMessageParts(body: string): Array<{ type: 'text' | 'url'; value: string }> {
  const parts: Array<{ type: 'text' | 'url'; value: string }> = [];
  let last = 0;
  for (const match of body.matchAll(URL_IN_TEXT)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ type: 'text', value: body.slice(last, index) });
    parts.push({ type: 'url', value: match[0]! });
    last = index + match[0]!.length;
  }
  if (last < body.length) parts.push({ type: 'text', value: body.slice(last) });
  return parts;
}
