// Pure helpers for scripts/ai-bot-visits.mjs (GEO/AEO stage 7): which AI bots fetched which pages.
// The data comes from Vercel Observability, which already names known bots on every request
// (static and prerendered pages included), so the site needs no middleware or storage of its own.

/** Bots that fetch pages to answer a user's question or build an AI search index. */
export const AI_ANSWER_BOTS = [
  'oai-searchbot',
  'chatgpt-user',
  'gpt-actions',
  'perplexitybot',
  'perplexity-user',
  'claude-searchbot',
  'claude-user',
  'exasearchbot',
  'exauser',
  'duckassistbot',
];

/** Bots that collect pages for model training (allowed in robots.txt, see GEO-AEO-PLAN stage 4). */
export const AI_TRAINING_BOTS = ['gptbot', 'claudebot', 'meta-externalagent', 'amazonbot', 'ccbot', 'bytespider'];

/** Classic search crawlers, shown for scale: ChatGPT and Copilot draw on the Bing index. */
export const SEARCH_BOTS = ['googlebot', 'bingbot', 'applebot', 'duckduckbot', 'yandexbot'];

const ASSET_PREFIXES = ['/_astro/', '/_vercel/', '/images/', '/fonts/', '/videos/', '/hero-assets/', '/reel-assets/', '/landing/', '/social/', '/uploads/'];
const ASSET_EXTENSIONS = /\.(?:js|mjs|css|map|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|mp4|webm|webmanifest)$/i;

/** True for page and text-file requests; false for scripts, styles, images and fonts. */
export function isContentPath(path) {
  if (!path || typeof path !== 'string') return false;
  if (ASSET_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
  if (/^\/favicon/.test(path) || path === '/apple-touch-icon.png') return false;
  return !ASSET_EXTENSIONS.test(path);
}

/** Observability query body: request count for one project, summed over the period. */
export function buildQuery({ teamId, projectId, from, to, groupBy, filter, limit }) {
  const body = {
    metric: 'vercel.request.count',
    scope: { type: 'project', ownerId: teamId, projectIds: [projectId] },
    startTime: `${from}T00:00:00Z`,
    endTime: `${to}T00:00:00Z`,
    granularity: { days: 1 },
    groupBy,
    summaryOnly: true,
    limit,
  };
  if (filter) body.filter = filter;
  return body;
}

/** Reads the per-group totals from a query response as [{ key, count }], largest first. */
export function readSummary(response, dimension) {
  const rows = Array.isArray(response?.summary) ? response.summary : [];
  return rows
    .map((row) => ({ key: String(row[dimension] ?? ''), count: Number(row.vercel_request_count_sum ?? 0) }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/**
 * Splits [from, to) into consecutive chunks of at most `days` days. Vercel times out on a month of
 * request-level data in one query, so the script runs one query per chunk and adds them up.
 */
export function splitRange(from, to, days = 7) {
  const chunks = [];
  const end = new Date(`${to}T00:00:00Z`);
  for (let start = new Date(`${from}T00:00:00Z`); start < end; ) {
    const next = new Date(Math.min(start.getTime() + days * 86_400_000, end.getTime()));
    chunks.push({ from: start.toISOString().slice(0, 10), to: next.toISOString().slice(0, 10) });
    start = next;
  }
  return chunks;
}

/** Adds up summaries from several chunks: [{ key, count }][] -> [{ key, count }], largest first. */
export function mergeSummaries(summaries) {
  const totals = new Map();
  for (const rows of summaries) for (const row of rows) totals.set(row.key, (totals.get(row.key) ?? 0) + row.count);
  return [...totals.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function previousMonthRange(today) {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const iso = (date) => date.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end) };
}

const table = (rows, header) =>
  rows.length === 0
    ? ['_None in this period._']
    : [`| ${header[0]} | ${header[1]} |`, '|---|---:|', ...rows.map((row) => `| ${row.key} | ${row.count} |`)];

/**
 * Markdown for the monthly log: AI bot totals, then the pages each answer bot fetched.
 * `botTotals` = readSummary(..., 'bot_name'); `pagesByBot` = { botName: readSummary(..., 'request_path') }.
 */
export function formatReport({ from, to, botTotals, pagesByBot, topPages = 10 }) {
  const pick = (names) => botTotals.filter((row) => names.includes(row.key));
  const sum = (rows) => rows.reduce((total, row) => total + row.count, 0);
  const answer = pick(AI_ANSWER_BOTS);
  const training = pick(AI_TRAINING_BOTS);
  const search = pick(SEARCH_BOTS);
  const lines = [
    `## AI bot visits, ${from} to ${to} (end date excluded)`,
    '',
    'Source: Vercel Observability, requests by bot name (scripts/ai-bot-visits.mjs). Pages only: scripts, styles, images and fonts are left out of the page lists.',
    '',
    `### Answer and AI search bots: ${sum(answer)} requests`,
    '',
    ...table(answer, ['Bot', 'Requests']),
    '',
    `### Training bots: ${sum(training)} requests`,
    '',
    ...table(training, ['Bot', 'Requests']),
    '',
    `### Search crawlers, for scale: ${sum(search)} requests`,
    '',
    ...table(search, ['Bot', 'Requests']),
  ];
  for (const bot of [...answer, ...training]) {
    const pages = (pagesByBot[bot.key] ?? []).filter((row) => isContentPath(row.key)).slice(0, topPages);
    lines.push('', `### Pages fetched by ${bot.key}`, '', ...table(pages, ['Page', 'Requests']));
  }
  const llmsFetches = Object.entries(pagesByBot)
    .flatMap(([bot, rows]) => rows.filter((row) => row.key.startsWith('/llms')).map((row) => `${bot} ${row.key} (${row.count})`));
  lines.push('', `llms.txt / llms-full.txt fetched by: ${llmsFetches.length > 0 ? llmsFetches.join(', ') : 'no AI bot in this period'}.`, '');
  return lines.join('\n');
}
