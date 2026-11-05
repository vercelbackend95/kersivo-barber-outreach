/**
 * HTTP and Stripe probe checks (cron, "Run checks now", launch guard). Every URL is derived from the shop's
 * own records only:
 *   https://kersivo.co.uk/book/<bookingSlug or id>, /shop/<id>, /api/public/site/<bookingSlug or id>,
 *   and the website origin = the VERIFIED_LIVE FullBookingDestination origin, else sitePreviewUrl.
 * All fetches go through probe.ts (SSRF guard). One fetch per URL per run (memoised on the context).
 */
import { hasKersivoCapability } from '@/lib/shop/kersivoAccess';
import { retrieveConnectAccountHealth, type ConnectAccountHealth } from '@/lib/shop/stripeConnect';
import { KERSIVO_ORIGIN } from '@/lib/ops/healthProbeAuth';
import { probeUrl, type ProbeResult } from '../probe';
import { paymentsApply } from './config';
import type { ShopHealthApplies, ShopHealthCheck, ShopHealthContext, ShopHealthOutcome } from '../types';

export const SLOW_SITE_MS = 3_000;
export const TLS_MIN_DAYS = 14;
export const STRIPE_CACHE_MS = 60 * 60 * 1000;

export type ProbeDeps = {
  probe: (url: string) => Promise<ProbeResult>;
  stripeAccount: (accountId: string) => Promise<ConnectAccountHealth>;
  now?: () => number;
};

// ---------------------------------------------------------------------------------------------------
// Targets

export function shopIdentifier(ctx: ShopHealthContext): string {
  return encodeURIComponent(ctx.shop.bookingSlug?.trim() || ctx.shop.id);
}

export function bookingPageUrl(ctx: ShopHealthContext): string {
  return `${KERSIVO_ORIGIN}/book/${shopIdentifier(ctx)}`;
}

export function siteDataUrl(ctx: ShopHealthContext): string {
  return `${KERSIVO_ORIGIN}/api/public/site/${shopIdentifier(ctx)}`;
}

export function retailPageUrl(ctx: ShopHealthContext): string {
  return `${KERSIVO_ORIGIN}/shop/${encodeURIComponent(ctx.shop.id)}`;
}

export type SiteTarget = { url: string; source: 'verified' | 'preview' };

/** The website to check: the verified live booking destination's origin, else the preview URL. */
export function websiteTarget(ctx: ShopHealthContext): SiteTarget | null {
  const toOrigin = (raw: string | null | undefined) => {
    try {
      const url = new URL(String(raw ?? '').trim());
      return url.protocol === 'https:' ? `${url.origin}/` : null;
    } catch {
      return null;
    }
  };
  const verified = toOrigin(ctx.verifiedDestinationUrl);
  if (verified) return { url: verified, source: 'verified' };
  const preview = ctx.shop.sitePreviewUrl?.trim();
  if (preview && toOrigin(preview)) return { url: preview, source: 'preview' };
  return null;
}

// ---------------------------------------------------------------------------------------------------
// HTML helpers

export function decodeEntities(html: string): string {
  return html
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const norm = (text: string) => decodeEntities(text).replace(/[’‘]/g, "'").replace(/\s+/g, ' ').toLowerCase();

export function htmlContainsText(html: string, text: string | null | undefined): boolean {
  const needle = norm(String(text ?? '')).trim();
  return Boolean(needle) && norm(html).includes(needle);
}

const compact = (text: string) => decodeEntities(text).replace(/\s+/g, '').toUpperCase();

export function htmlContainsPhone(html: string, phone: string | null | undefined): boolean {
  const value = String(phone ?? '').trim();
  if (!value) return false;
  if (compact(html).includes(compact(value))) return true;
  const digits = value.replace(/\D/g, '').replace(/^44/, '0');
  if (digits.length < 7) return false;
  return Array.from(html.matchAll(/href=["']tel:([^"']+)["']/gi)).some((m) => m[1].replace(/\D/g, '').replace(/^44/, '0') === digits);
}

/** "noindex" in <meta name="robots|googlebot"> or the X-Robots-Tag header. */
export function noindexSources(html: string, headers: Record<string, string>): string[] {
  const found: string[] = [];
  if (/noindex/i.test(headers['x-robots-tag'] ?? '')) found.push(`X-Robots-Tag: ${headers['x-robots-tag']}`);
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/\bname\s*=\s*["']?(robots|googlebot)["']?/i.test(tag)) continue;
    const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
    if (/noindex/i.test(content)) found.push(`<meta name="robots" content="${content}">`);
  }
  return found;
}

export function htmlLinksTo(html: string, target: string, pageUrl: string): boolean {
  let wanted: URL;
  try {
    wanted = new URL(target);
  } catch {
    return false;
  }
  const strip = (u: URL) => `${u.origin}${u.pathname.replace(/\/$/, '')}`;
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const href = new URL(decodeEntities(match[1]), pageUrl);
      if (strip(href) === strip(wanted)) return true;
    } catch {
      // ignore malformed hrefs
    }
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------

type SiteDataBody = {
  contractVersion?: unknown;
  business?: { name?: string };
  location?: { phone?: string | null; postcode?: string | null };
  planFeatures?: { onlineBooking?: boolean };
  booking?: { available?: boolean; url?: string | null };
};

const probeMemo = new WeakMap<ShopHealthContext, Map<string, Promise<ProbeResult>>>();
function probeOnce(ctx: ShopHealthContext, deps: ProbeDeps, url: string): Promise<ProbeResult> {
  let map = probeMemo.get(ctx);
  if (!map) probeMemo.set(ctx, (map = new Map()));
  let pending = map.get(url);
  if (!pending) map.set(url, (pending = deps.probe(url)));
  return pending;
}

async function loadSiteData(ctx: ShopHealthContext, deps: ProbeDeps): Promise<{ result: ProbeResult; data: SiteDataBody | null }> {
  const result = await probeOnce(ctx, deps, siteDataUrl(ctx));
  if (!result.ok || result.status !== 200) return { result, data: null };
  try {
    return { result, data: JSON.parse(result.body) as SiteDataBody };
  } catch {
    return { result, data: null };
  }
}

function describeProbeFailure(result: ProbeResult): string {
  return result.ok ? `HTTP ${result.status}` : result.reason;
}

const liveOnly = (ctx: ShopHealthContext, applies: boolean): ShopHealthApplies =>
  ctx.mode === 'LIVE' ? (applies ? 'yes' : 'no') : applies ? 'after_launch' : 'no';

// ---------------------------------------------------------------------------------------------------

const stripeCache = new Map<string, { at: number; value: ConnectAccountHealth }>();
export function clearStripeHealthCache(): void {
  stripeCache.clear();
}

export function createProbeChecks(deps: ProbeDeps): ShopHealthCheck[] {
  const now = deps.now ?? Date.now;

  const bookingPage: ShopHealthCheck = {
    id: 'booking.page',
    area: 'booking',
    title: 'Booking page online',
    severity: 'critical',
    kind: 'probe',
    appliesWhen: (ctx) => liveOnly(ctx, true),
    async run(ctx) {
      const url = bookingPageUrl(ctx);
      const r = await probeOnce(ctx, deps, url);
      if (!r.ok || r.status !== 200) {
        return {
          status: 'fail',
          message: `The booking page did not load (${describeProbeFailure(r)}).`,
          fix: 'Open the booking page; check the deployment and the shop’s booking link.',
          evidence: { url },
        };
      }
      if (!htmlContainsText(r.body, ctx.shop.name)) {
        return {
          status: 'fail',
          message: `The booking page loads but does not show “${ctx.shop.name}”.`,
          fix: 'Check that the booking link points to this shop.',
          evidence: { url },
        };
      }
      return { status: 'pass', message: `The booking page loads and shows the shop (${r.durationMs} ms).`, evidence: { url, ms: r.durationMs } };
    },
  };

  const siteData: ShopHealthCheck = {
    id: 'website.site_data',
    area: 'website',
    title: 'Website data feed',
    severity: 'critical',
    kind: 'probe',
    appliesWhen: (ctx) => liveOnly(ctx, hasKersivoCapability(ctx.access, 'BRANDED_SITE')),
    async run(ctx) {
      const url = siteDataUrl(ctx);
      const { result, data } = await loadSiteData(ctx, deps);
      if (!result.ok || result.status !== 200 || !data) {
        return {
          status: 'fail',
          message: `The website data feed did not load (${describeProbeFailure(result)}). The website cannot show this shop’s details.`,
          fix: 'Check /api/public/site for this shop (docs/site-data-contract.md).',
          evidence: { url },
        };
      }
      if (data.contractVersion !== 1) {
        return { status: 'fail', message: `Unexpected website data version (${String(data.contractVersion)}).`, evidence: { url } };
      }
      if (data.planFeatures?.onlineBooking !== true) {
        return {
          status: 'fail',
          message: 'The website data says online booking is off, so the website shows no booking button.',
          fix: 'Fix the “Online booking accepted” check first.',
          evidence: { url },
        };
      }
      return { status: 'pass', message: 'The website data feed is up and online booking is on.', evidence: { url } };
    },
  };

  const siteApplies = (ctx: ShopHealthContext) => liveOnly(ctx, Boolean(websiteTarget(ctx)));

  const websiteUp: ShopHealthCheck = {
    id: 'website.up',
    area: 'website',
    title: 'Website online',
    severity: 'critical',
    kind: 'probe',
    appliesWhen: siteApplies,
    async run(ctx) {
      const target = websiteTarget(ctx)!;
      const r = await probeOnce(ctx, deps, target.url);
      if (!r.ok || r.status !== 200) {
        return {
          status: 'fail',
          message: `The website is down (${describeProbeFailure(r)}).`,
          fix: 'Open the site; check the hosting deployment, DNS and the domain.',
          evidence: { url: target.url },
        };
      }
      if (r.durationMs > SLOW_SITE_MS) {
        return {
          status: 'warn',
          message: `The website is up but slow (${(r.durationMs / 1000).toFixed(1)} s).`,
          fix: 'Check the site’s hosting and image sizes.',
          evidence: { url: r.finalUrl, ms: r.durationMs },
        };
      }
      return { status: 'pass', message: `The website is up over HTTPS (${r.durationMs} ms).`, evidence: { url: r.finalUrl, ms: r.durationMs } };
    },
  };

  const websiteBookingLink: ShopHealthCheck = {
    id: 'website.booking_link',
    area: 'website',
    title: 'Website links to booking',
    severity: 'critical',
    kind: 'probe',
    appliesWhen: siteApplies,
    async run(ctx): Promise<ShopHealthOutcome> {
      const target = websiteTarget(ctx)!;
      const r = await probeOnce(ctx, deps, target.url);
      if (!r.ok || r.status !== 200) return { status: 'skip', message: 'Skipped: the website did not load.' };
      const { data } = await loadSiteData(ctx, deps);
      const bookingUrl = data?.booking?.url ?? null;
      if (!bookingUrl) {
        return { status: 'inconclusive', message: 'No booking URL in the website data feed to compare with.' };
      }
      return htmlLinksTo(r.body, bookingUrl, r.finalUrl)
        ? { status: 'pass', message: 'The website links to the shop’s booking page.', evidence: { bookingUrl } }
        : {
            status: 'fail',
            message: 'The website does not link to this shop’s booking page, so customers cannot book from it.',
            fix: `Make the Book button point to ${bookingUrl}.`,
            evidence: { bookingUrl, url: r.finalUrl },
          };
    },
  };

  const websiteIndexable: ShopHealthCheck = {
    id: 'website.indexable',
    area: 'website',
    title: 'Website visible to Google',
    severity: 'critical',
    kind: 'probe',
    appliesWhen: siteApplies,
    async run(ctx) {
      const target = websiteTarget(ctx)!;
      const r = await probeOnce(ctx, deps, target.url);
      if (!r.ok || r.status !== 200) return { status: 'skip', message: 'Skipped: the website did not load.' };
      const sources = noindexSources(r.body, r.headers);
      if (!sources.length) return { status: 'pass', message: 'The website can be indexed by search engines.' };
      if (target.source === 'preview') {
        return {
          status: 'warn',
          message: 'The live shop’s website is still its preview build (noindex). Customers find it only by link.',
          fix: 'Launch the site on its own domain and record the verified booking destination in ops.',
          evidence: { found: sources },
        };
      }
      return {
        status: 'fail',
        message: 'The live website tells search engines not to index it (noindex), so it will drop out of Google.',
        fix: 'Remove noindex from the production build (meta robots and X-Robots-Tag).',
        evidence: { found: sources },
      };
    },
  };

  const websiteShowsShop: ShopHealthCheck = {
    id: 'website.shows_shop',
    area: 'website',
    title: 'Website shows this shop',
    severity: 'warning',
    kind: 'probe',
    appliesWhen: siteApplies,
    async run(ctx): Promise<ShopHealthOutcome> {
      const target = websiteTarget(ctx)!;
      const r = await probeOnce(ctx, deps, target.url);
      if (!r.ok || r.status !== 200) return { status: 'skip', message: 'Skipped: the website did not load.' };
      const { data } = await loadSiteData(ctx, deps);
      const name = data?.business?.name ?? ctx.shop.name;
      const phone = data?.location?.phone ?? null;
      const postcode = data?.location?.postcode ?? null;
      const missing: string[] = [];
      if (!htmlContainsText(r.body, name)) missing.push(`the name “${name}”`);
      if ((phone || postcode) && !htmlContainsPhone(r.body, phone) && !(postcode && compact(r.body).includes(compact(postcode)))) {
        missing.push('the phone number or postcode');
      }
      return missing.length
        ? {
            status: 'fail',
            message: `The website home page does not show ${missing.join(' or ')}. It may be bound to the wrong shop or use stale data.`,
            fix: 'Check the site’s shop identifier and rebuild it with the latest site data.',
            evidence: { url: r.finalUrl },
          }
        : { status: 'pass', message: 'The website shows this shop’s name and contact details.' };
    },
  };

  const websiteTls: ShopHealthCheck = {
    id: 'website.tls',
    area: 'website',
    title: 'HTTPS certificate',
    severity: 'warning',
    kind: 'probe',
    appliesWhen: (ctx) => liveOnly(ctx, websiteTarget(ctx)?.source === 'verified'),
    async run(ctx) {
      const target = websiteTarget(ctx)!;
      const r = await probeOnce(ctx, deps, target.url);
      if (!r.ok) return { status: 'skip', message: 'Skipped: the website did not load.' };
      if (!r.certValidTo) return { status: 'inconclusive', message: 'Could not read the certificate.' };
      const days = Math.floor((r.certValidTo.getTime() - now()) / 86_400_000);
      return days > TLS_MIN_DAYS
        ? { status: 'pass', message: `The certificate is valid for ${days} more days.`, evidence: { validTo: r.certValidTo.toISOString() } }
        : {
            status: 'fail',
            message: days < 0 ? 'The HTTPS certificate has expired.' : `The HTTPS certificate expires in ${days} days.`,
            fix: 'Check certificate renewal at the hosting provider (DNS must still point there).',
            evidence: { validTo: r.certValidTo.toISOString() },
          };
    },
  };

  const websitePreviewUp: ShopHealthCheck = {
    id: 'website.preview_up',
    area: 'website',
    title: 'Preview website online',
    severity: 'warning',
    kind: 'probe',
    appliesWhen: (ctx) => (ctx.mode === 'PRELAUNCH' && ctx.shop.sitePreviewUrl?.trim() ? 'yes' : 'no'),
    async run(ctx) {
      const url = ctx.shop.sitePreviewUrl!.trim();
      const r = await probeOnce(ctx, deps, url);
      return r.ok && r.status === 200
        ? { status: 'pass', message: `The preview website loads (${r.durationMs} ms). Noindex is expected on a preview.`, evidence: { url } }
        : {
            status: 'fail',
            message: `The preview website did not load (${describeProbeFailure(r)}).`,
            fix: 'Redeploy the preview build or update the preview URL in ops.',
            evidence: { url },
          };
    },
  };

  const retailPage: ShopHealthCheck = {
    id: 'retail.page',
    area: 'retail',
    title: 'Products page online',
    severity: 'critical',
    kind: 'probe',
    appliesWhen: (ctx) => liveOnly(ctx, ctx.shop.retailEnabled),
    async run(ctx) {
      const url = retailPageUrl(ctx);
      const r = await probeOnce(ctx, deps, url);
      if (!r.ok || r.status !== 200) {
        return { status: 'fail', message: `The products page did not load (${describeProbeFailure(r)}).`, evidence: { url } };
      }
      const listed = ctx.products.filter((p) => htmlContainsText(r.body, p.name)).map((p) => p.name);
      return listed.length
        ? { status: 'pass', message: `The products page lists ${listed.length} of ${ctx.products.length} active products.`, evidence: { url } }
        : {
            status: 'fail',
            message: 'The products page loads but lists none of the active products.',
            fix: 'Check retail is enabled and products are active and in stock.',
            evidence: { url },
          };
    },
  };

  const stripeAccount: ShopHealthCheck = {
    id: 'payments.stripe_account',
    area: 'payments',
    title: 'Stripe account status',
    severity: 'critical',
    kind: 'probe',
    appliesWhen: (ctx) => (paymentsApply(ctx) && ctx.shop.stripeConnectAccountId?.trim() ? 'yes' : 'no'),
    async run(ctx) {
      const accountId = ctx.shop.stripeConnectAccountId!.trim();
      const cached = stripeCache.get(accountId);
      let account: ConnectAccountHealth;
      if (cached && now() - cached.at < STRIPE_CACHE_MS) account = cached.value;
      else {
        account = await deps.stripeAccount(accountId);
        stripeCache.set(accountId, { at: now(), value: account });
      }
      const evidence = {
        chargesEnabled: account.chargesEnabled,
        payoutsEnabled: account.payoutsEnabled,
        disabledReason: account.disabledReason,
        currentlyDue: account.currentlyDue,
      };
      if (!account.chargesEnabled || account.disabledReason) {
        return {
          status: 'fail',
          message: `Stripe has disabled payments on this account${account.disabledReason ? ` (${account.disabledReason})` : ''}.`,
          fix: 'Ask the owner to open Stripe and complete what it asks for.',
          evidence,
        };
      }
      if (account.currentlyDue.length || !account.payoutsEnabled) {
        const parts: string[] = [];
        if (account.currentlyDue.length) parts.push(`Stripe needs more information (${account.currentlyDue.length} item${account.currentlyDue.length === 1 ? '' : 's'})`);
        if (!account.payoutsEnabled) parts.push('payouts are paused');
        return {
          status: 'warn',
          message: `Payments work, but ${parts.join(' and ')}.`,
          fix: 'Ask the owner to complete the outstanding items in Stripe before they become blocking.',
          evidence,
        };
      }
      return { status: 'pass', message: 'Stripe can take payments and pay out.', evidence };
    },
  };

  return [bookingPage, siteData, websiteUp, websiteBookingLink, websiteIndexable, websiteShowsShop, websiteTls, websitePreviewUp, retailPage, stripeAccount];
}

export const PROBE_CHECKS = createProbeChecks({
  probe: (url) => probeUrl(url),
  stripeAccount: retrieveConnectAccountHealth,
});
