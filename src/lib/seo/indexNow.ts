import { MARKETING_SITEMAP_ENTRIES, type MarketingSitemapEntry } from './marketingSitemap';
import { buildAbsoluteUrl } from './meta';

/**
 * IndexNow (https://www.indexnow.org): tells Bing, Yandex, Seznam, Naver and Yep that a URL changed.
 * Bing feeds ChatGPT search and Copilot, so fresh URLs there matter for AI answers.
 *
 * The key file is public/<key>.txt and must contain exactly the key. It is served at the site root,
 * so `keyLocation` is optional, but we send it anyway to make verification explicit.
 */
export const INDEXNOW_KEY = 'b9e8bc2d05fa4b4d87a03a8d0dd7f646';
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const INDEXNOW_HOST = 'kersivo.co.uk';

/**
 * The daily cron submits every sitemap URL whose lastmod falls in this window (today and the day before).
 * lastmod comes from src/lib/seo/pageDates.ts and Insights dates — never from build time — so an
 * unchanged page is never resubmitted, and a changed page is submitted at most twice.
 */
export const INDEXNOW_LOOKBACK_DAYS = 1;

/** IndexNow accepts up to 10,000 URLs per request; we never get close, but cap it anyway. */
export const INDEXNOW_MAX_URLS = 500;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function selectRecentlyChangedPaths(
  now: Date,
  entries: readonly MarketingSitemapEntry[] = MARKETING_SITEMAP_ENTRIES,
  lookbackDays = INDEXNOW_LOOKBACK_DAYS,
): string[] {
  const from = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const fromDay = isoDay(from);
  const today = isoDay(now);
  return entries
    .filter((entry) => entry.lastmod >= fromDay && entry.lastmod <= today)
    .map((entry) => entry.path)
    .slice(0, INDEXNOW_MAX_URLS);
}

export type IndexNowPayload = {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
};

export function buildIndexNowPayload(paths: readonly string[]): IndexNowPayload {
  return {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
    urlList: paths.map((path) => buildAbsoluteUrl(path)),
  };
}

export type IndexNowResult =
  | { status: 'skipped'; reason: string; urls: string[] }
  | { status: 'submitted'; httpStatus: number; urls: string[] }
  | { status: 'failed'; httpStatus?: number; error: string; urls: string[] };

/**
 * Submits the URLs changed in the lookback window. Never throws: a failed ping must not
 * break the cron or anything else, and the next day's run simply tries again.
 */
export async function submitRecentlyChangedUrls(options: {
  now: Date;
  enabled: boolean;
  fetchImpl?: typeof fetch;
  entries?: readonly MarketingSitemapEntry[];
}): Promise<IndexNowResult> {
  const paths = selectRecentlyChangedPaths(options.now, options.entries);
  const payload = buildIndexNowPayload(paths);
  if (!options.enabled) return { status: 'skipped', reason: 'not production', urls: payload.urlList };
  if (payload.urlList.length === 0) return { status: 'skipped', reason: 'no changed URLs', urls: [] };
  if (payload.urlList.some((url) => new URL(url).host !== INDEXNOW_HOST)) {
    return { status: 'skipped', reason: 'URLs are not on the production host', urls: payload.urlList };
  }

  const doFetch = options.fetchImpl ?? fetch;
  try {
    const response = await doFetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    // 200 = accepted, 202 = accepted while the key is being verified.
    if (response.status === 200 || response.status === 202) {
      return { status: 'submitted', httpStatus: response.status, urls: payload.urlList };
    }
    return { status: 'failed', httpStatus: response.status, error: `IndexNow returned ${response.status}`, urls: payload.urlList };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : String(error), urls: payload.urlList };
  }
}
