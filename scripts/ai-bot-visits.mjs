#!/usr/bin/env node
// Monthly AI bot visit report (GEO/AEO stage 7, docs/seo/ai-visibility-log/README.md).
//
// Usage:
//   node scripts/ai-bot-visits.mjs                          # last calendar month
//   node scripts/ai-bot-visits.mjs --from 2026-11-01 --to 2026-12-01
//
// Needs the Vercel CLI logged in to the team that owns kersivo-barber-outreach. Run it from this
// repository (linked to that project); never from an unlinked folder.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AI_ANSWER_BOTS,
  AI_TRAINING_BOTS,
  SEARCH_BOTS,
  buildQuery,
  formatReport,
  mergeSummaries,
  previousMonthRange,
  readSummary,
  splitRange,
} from './ai-bot-visits-lib.mjs';

const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
if (project.projectName !== 'kersivo-barber-outreach') {
  throw new Error(`.vercel/project.json is linked to ${project.projectName}, not kersivo-barber-outreach`);
}
const teamId = project.orgId;
const projectId = project.projectId;

const arg = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const range = previousMonthRange(new Date());
const from = arg('--from') ?? range.from;
const to = arg('--to') ?? range.to;
if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
  throw new Error('--from and --to must be YYYY-MM-DD');
}

const workDir = mkdtempSync(join(tmpdir(), 'ai-bot-visits-'));
const log = (line) => process.stderr.write(`${line}\n`);

function runQuery(body) {
  const file = join(workDir, 'query.json');
  writeFileSync(file, JSON.stringify(body));
  const isWindows = process.platform === 'win32';
  const output = execFileSync(
    isWindows ? 'vercel.cmd' : 'vercel',
    ['api', `/v2/observability/query?teamId=${teamId}`, '--method', 'POST', '--input', file],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: isWindows, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return JSON.parse(output.slice(output.indexOf('{')));
}

/** Vercel sometimes answers 408 on request-level queries; retry before giving up. */
function query(body, attempts = 3) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return runQuery(body);
    } catch (error) {
      if (attempt >= attempts) throw error;
      const reason = String(error.stderr ?? error.message).trim().split(/\r?\n/).pop();
      log(`  retry ${attempt}: ${reason}`);
    }
  }
}

try {
  const chunks = splitRange(from, to, 1);
  const named = [...AI_ANSWER_BOTS, ...AI_TRAINING_BOTS, ...SEARCH_BOTS];
  const inList = (names) => `bot_name in (${names.map((name) => `'${name}'`).join(',')})`;

  // One query per day, added up: a month of request-level data in one query times out.
  const perChunk = (groupBy, filter, limit) =>
    chunks.map((chunk) => {
      log(`  ${groupBy.join('+')} ${chunk.from}`);
      return query(buildQuery({ teamId, projectId, ...chunk, groupBy, filter, limit }));
    });

  const botTotals = mergeSummaries(
    perChunk(['bot_name'], inList(named), named.length).map((response) => readSummary(response, 'bot_name')),
  );

  const aiBots = [...AI_ANSWER_BOTS, ...AI_TRAINING_BOTS].filter((bot) => botTotals.some((row) => row.key === bot));
  const pagesByBot = {};
  if (aiBots.length > 0) {
    const responses = perChunk(['bot_name', 'request_path'], inList(aiBots), 400);
    for (const bot of aiBots) {
      pagesByBot[bot] = mergeSummaries(
        responses.map((response) =>
          readSummary({ summary: (response.summary ?? []).filter((row) => row.bot_name === bot) }, 'request_path'),
        ),
      );
    }
  }

  process.stdout.write(formatReport({ from, to, botTotals, pagesByBot }));
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
