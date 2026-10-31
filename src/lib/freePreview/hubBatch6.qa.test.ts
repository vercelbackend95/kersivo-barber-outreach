import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HUB_OWNER_MESSAGE_EMAIL_BUTTON } from './hubCopy';
import { PREVIEW_REPLY_TO_EMAIL } from './config';
import { tokenPrefixForLog } from './hubPage';
import { HUB_MAX_ACTIVE_FILES, HUB_MAX_BODY_BYTES, HUB_MAX_TOTAL_BYTES } from './hubAssets';
import { PREVIEW_HUB_MESSAGES_REQUEST_DAY_RATE, HUB_API_HEADERS } from './hubApi';
import { PRIVATE_PREVIEW_HEADERS } from './previewHeaders';
import { FREE_PREVIEW_PRIVACY_HUB_FILES_TEXT, FREE_PREVIEW_PRIVACY_HUB_MESSAGES_TEXT } from './legalCopy';
import { buildHubMessageFromKersivoEmail } from './emails';

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');
const apiFiles = (dir: string) => {
  const abs = path.join(process.cwd(), dir);
  return readdirSync(abs, { recursive: true })
    .map(String)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => path.join(dir, name).replaceAll('\\', '/'));
};

describe('Batch 6 A — pin mode skipped', () => {
  it('does not ship preview-feedback.js or a pin-mode toggle', () => {
    expect(existsSync(path.join(process.cwd(), 'public/preview-feedback.js'))).toBe(false);
    expect(read('src/components/previewHub/HubWebsiteView.tsx')).not.toContain('kfeedback');
    expect(read('src/components/previewHub/HubWebsiteView.tsx')).not.toContain('Pin a comment');
    expect(read('src/components/previewHub/HubWebsiteView.tsx')).not.toContain('kersivo-feedback');
    expect(read('docs/preview-hub/BATCH_0_FINDINGS.md')).toContain(
      'This repo does not render tenant websites.',
    );
    expect(read('docs/preview-hub/BATCH_0_FINDINGS.md')).toContain('Skip pin mode');
  });
});

describe('Batch 6 B — reply-by-email skipped', () => {
  it('keeps Reply in your shop hub and does not add an inbound webhook', () => {
    expect(HUB_OWNER_MESSAGE_EMAIL_BUTTON).toBe('Reply in your shop hub');
    expect(PREVIEW_REPLY_TO_EMAIL).toBe('hello@kersivo.co.uk');
    const email = buildHubMessageFromKersivoEmail({
      to: 'sam@example.com',
      shopName: 'Sharp Cuts',
      firstName: 'Sam',
      publicToken: 'A'.repeat(43),
      body: 'Hello',
    });
    expect(email.replyTo).toBe(PREVIEW_REPLY_TO_EMAIL);
    expect(email.html).toContain(HUB_OWNER_MESSAGE_EMAIL_BUTTON);
    expect(email.html).not.toContain('hub+');
    expect(email.html).not.toContain('@reply.');
    expect(existsSync(path.join(process.cwd(), 'src/pages/api/preview-hub/inbound.ts'))).toBe(false);
    expect(existsSync(path.join(process.cwd(), 'src/pages/api/webhooks/resend-inbound.ts'))).toBe(false);
    expect(read('.env.example')).not.toContain('RESEND_WEBHOOK');
    expect(read('.env.example')).not.toContain('REPLY_DOMAIN');
  });
});

describe('HUB_SPEC §11 security checklist', () => {
  it('private headers on hub pages and APIs; asset GET may cache 300s', () => {
    expect(PRIVATE_PREVIEW_HEADERS).toMatchObject({
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'private, no-store',
    });
    expect(HUB_API_HEADERS).toMatchObject({
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'private, no-store',
    });
    expect(read('src/lib/freePreview/hubAssets.ts')).toContain("cache: 'private, max-age=300'");
    for (const file of [
      'src/pages/preview/[token]/overview.astro',
      'src/pages/preview/[token]/website.astro',
      'src/pages/preview/[token]/details.astro',
      'src/pages/preview/[token]/changes.astro',
      'src/pages/preview/[token]/messages.astro',
    ]) {
      expect(read(file)).toContain('applyPrivatePreviewHeaders');
    }
  });

  it('never logs more than the first 6 characters of a token', () => {
    const token = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno';
    expect(tokenPrefixForLog(token)).toBe('ABCDEF');
    expect(tokenPrefixForLog(token)).toHaveLength(6);
    expect(read('src/lib/freePreview/hubApi.ts')).toContain('tokenPrefixForLog');
  });

  it('REJECTED and unknown tokens are indistinguishable 404s', () => {
    expect(read('src/lib/freePreview/hubStage.ts')).toContain("if (request.status === 'REJECTED') return { kind: 'not_found' }");
    expect(read('src/lib/freePreview/hubApi.ts')).toContain('hubNotFoundJson()');
  });

  it('mutations require exact same-origin; JSON except multipart uploads', () => {
    expect(read('src/lib/freePreview/hubApi.ts')).toContain('evaluateExactSameOrigin');
    expect(read('src/lib/freePreview/hubLaunchApi.ts')).toContain('evaluateExactSameOrigin');
    expect(read('src/pages/api/preview-hub/[token]/assets.ts')).toContain('formData');
  });

  it('uploads sniff magic bytes, cap the body, and store under preview-hub/', () => {
    expect(HUB_MAX_BODY_BYTES).toBe(4 * 1024 * 1024);
    expect(HUB_MAX_ACTIVE_FILES).toBe(60);
    expect(HUB_MAX_TOTAL_BYTES).toBe(250 * 1024 * 1024);
    expect(read('src/lib/storage/fileSniff.ts')).toContain('Never trust the client MIME');
    expect(read('src/lib/freePreview/hubAssets.ts')).toContain('sniffAllowedForHubKind');
    expect(read('src/lib/freePreview/hubAssets.ts')).toContain('preview-hub/${requestId}');
    expect(read('src/lib/freePreview/hubAssets.ts')).toContain('uploadPrivateOnboardingFile');
    expect(read('src/lib/freePreview/hubAssets.ts')).toContain("contentType: 'application/octet-stream'");
  });

  it('token hub progress omits address, legal, Stripe and migration data', () => {
    const src = read('src/lib/freePreview/hubLaunch.ts');
    const start = src.indexOf('export function hubLaunchProgressFrom');
    const end = src.indexOf('async function writeLaunchEvent', start);
    const from = src.slice(start, end === -1 ? start + 800 : end);
    expect(from).toContain('yourSteps');
    expect(from).not.toContain('addressLine1');
    expect(from).not.toContain('companyNumber');
    expect(from).not.toContain('registeredOffice');
    expect(from).not.toContain('stripeConnect');
  });

  it('message links are escaped and marked ugc nofollow', () => {
    expect(read('src/lib/freePreview/hubMessageText.ts')).toContain("replace(/</g, '&lt;')");
    expect(read('src/components/previewHub/HubMessages.tsx')).toContain('noopener noreferrer nofollow ugc');
  });

  it('purge clears hub files, messages, changes and reviews', () => {
    const src = read('src/lib/freePreview/lifecycle.ts');
    expect(src).toContain('deleteHubAssetRows');
    expect(src).toContain('clearHubMessageBodies');
    expect(src).toContain('clearHubChangeBodies');
    expect(src).toContain('clearHubReviewProposals');
    expect(FREE_PREVIEW_PRIVACY_HUB_FILES_TEXT).toContain('Files you add in your private shop hub');
    expect(FREE_PREVIEW_PRIVACY_HUB_MESSAGES_TEXT).toContain('Messages you send in your private shop hub');
  });

  it('REJECTED hub POSTs 404 and owner messages are capped at 100/day', () => {
    expect(PREVIEW_HUB_MESSAGES_REQUEST_DAY_RATE.limit).toBe(100);
    expect(read('src/pages/api/preview-hub/[token]/messages.ts')).toContain('enforceHubMessageRates');
    expect(read('src/lib/freePreview/hubStage.ts')).toContain("'REJECTED'");
  });

  it('every hub API still goes through resolveHubApiContext (flag-off 404)', () => {
    for (const file of apiFiles('src/pages/api/preview-hub')) {
      expect(read(file)).toContain('resolveHubApiContext');
    }
  });
});
