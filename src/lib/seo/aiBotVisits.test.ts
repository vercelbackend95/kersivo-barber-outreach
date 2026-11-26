import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AI_ANSWER_BOTS,
  AI_TRAINING_BOTS,
  SEARCH_BOTS,
  buildQuery,
  formatReport,
  isContentPath,
  mergeSummaries,
  previousMonthRange,
  readSummary,
  splitRange,
} from '../../../scripts/ai-bot-visits-lib.mjs';

describe('AI bot visit report (GEO/AEO stage 7)', () => {
  it('keeps the three bot groups apart and covers the bots robots.txt lets in', () => {
    const all = [...AI_ANSWER_BOTS, ...AI_TRAINING_BOTS, ...SEARCH_BOTS];
    expect(new Set(all).size).toBe(all.length);
    for (const bot of ['oai-searchbot', 'chatgpt-user', 'perplexitybot', 'perplexity-user', 'claude-searchbot', 'claude-user']) {
      expect(AI_ANSWER_BOTS).toContain(bot);
    }
    expect(AI_TRAINING_BOTS).toContain('gptbot');
    const robots = readFileSync('src/pages/robots.txt.ts', 'utf8');
    for (const agent of ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User']) {
      expect(robots).toContain(agent);
      expect(AI_ANSWER_BOTS).toContain(agent.toLowerCase());
    }
  });

  it('lists pages and text files but not scripts, styles, images or fonts', () => {
    for (const path of ['/', '/compare', '/llms.txt', '/llms-full.txt', '/robots.txt', '/sitemap.xml', '/insights/barbershop-gift-vouchers-uk', '/barber-booking-fees-uk/fees.csv']) {
      expect(isContentPath(path), path).toBe(true);
    }
    for (const path of ['/_astro/client.CsSeGegG.js', '/images/brand/kersivo-mark.svg', '/favicon.ico', '/favicon-32x32.png', '/fonts/inter.woff2', '/x.css', '', undefined]) {
      expect(isContentPath(path as string), String(path)).toBe(false);
    }
  });

  it('builds a project-scoped request-count query', () => {
    const body = buildQuery({ teamId: 't', projectId: 'p', from: '2026-11-01', to: '2026-11-02', groupBy: ['bot_name'], filter: "bot_name eq 'gptbot'", limit: 5 });
    expect(body).toMatchObject({
      metric: 'vercel.request.count',
      scope: { type: 'project', ownerId: 't', projectIds: ['p'] },
      startTime: '2026-11-01T00:00:00Z',
      endTime: '2026-11-02T00:00:00Z',
      groupBy: ['bot_name'],
      filter: "bot_name eq 'gptbot'",
      limit: 5,
    });
  });

  it('splits a range into whole-day chunks and adds the chunks up', () => {
    expect(splitRange('2026-11-01', '2026-11-04', 1)).toEqual([
      { from: '2026-11-01', to: '2026-11-02' },
      { from: '2026-11-02', to: '2026-11-03' },
      { from: '2026-11-03', to: '2026-11-04' },
    ]);
    expect(splitRange('2026-11-01', '2026-11-08', 3).at(-1)).toEqual({ from: '2026-11-07', to: '2026-11-08' });
    expect(splitRange('2026-11-01', '2026-11-01')).toEqual([]);
    expect(previousMonthRange(new Date('2026-12-01T09:00:00Z'))).toEqual({ from: '2026-11-01', to: '2026-12-01' });
    expect(previousMonthRange(new Date('2027-01-15T09:00:00Z'))).toEqual({ from: '2026-12-01', to: '2027-01-01' });

    const day = (rows: [string, number][]) =>
      readSummary({ summary: rows.map(([bot_name, n]) => ({ bot_name, vercel_request_count_sum: n })) }, 'bot_name');
    expect(mergeSummaries([day([['gptbot', 2], ['oai-searchbot', 1]]), day([['oai-searchbot', 4], ['bingbot', 0]])])).toEqual([
      { key: 'oai-searchbot', count: 5 },
      { key: 'gptbot', count: 2 },
    ]);
    expect(readSummary(undefined, 'bot_name')).toEqual([]);
  });

  it('formats a report with group totals, page lists without assets, and llms.txt fetches', () => {
    const report = formatReport({
      from: '2026-11-01',
      to: '2026-12-01',
      botTotals: [
        { key: 'oai-searchbot', count: 10 },
        { key: 'gptbot', count: 4 },
        { key: 'googlebot', count: 100 },
      ],
      pagesByBot: {
        'oai-searchbot': [
          { key: '/_astro/client.js', count: 9 },
          { key: '/compare', count: 3 },
          { key: '/llms.txt', count: 1 },
        ],
        gptbot: [],
      },
    });
    expect(report).toContain('## AI bot visits, 2026-11-01 to 2026-12-01');
    expect(report).toContain('### Answer and AI search bots: 10 requests');
    expect(report).toContain('### Training bots: 4 requests');
    expect(report).toContain('### Search crawlers, for scale: 100 requests');
    expect(report).toContain('| /compare | 3 |');
    expect(report).not.toContain('/_astro/');
    expect(report).toContain('### Pages fetched by gptbot\n\n_None in this period._');
    expect(report).toContain('llms.txt / llms-full.txt fetched by: oai-searchbot /llms.txt (1).');
    expect(report).not.toContain('Pages fetched by googlebot');
  });
});
