import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type QaEmailLogEntry = {
  to: string;
  subject: string;
  html: string;
  provider: 'dev-log';
  recordedAt: string;
};

/** Repo-root file so the production NFT trace never walks scripts/preview-hub. */
export function qaEmailLogPath(): string {
  return join(process.cwd(), '.preview-hub-qa-emails.json');
}

function readEntries(): QaEmailLogEntry[] {
  try {
    const logPath = qaEmailLogPath();
    if (!existsSync(logPath)) return [];
    const parsed = JSON.parse(readFileSync(logPath, 'utf8')) as QaEmailLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: QaEmailLogEntry[]): void {
  const logPath = qaEmailLogPath();
  mkdirSync(dirname(logPath), { recursive: true });
  writeFileSync(logPath, JSON.stringify(entries.slice(0, 80), null, 2));
}

export function recordQaEmail(input: { to: string; subject: string; html: string }): void {
  const entries = readEntries();
  entries.unshift({
    to: input.to.trim().toLowerCase(),
    subject: input.subject,
    html: input.html,
    provider: 'dev-log',
    recordedAt: new Date().toISOString(),
  });
  writeEntries(entries);
}

export function listQaEmails(to?: string): QaEmailLogEntry[] {
  const entries = readEntries();
  const needle = to?.trim().toLowerCase();
  return needle ? entries.filter((row) => row.to === needle) : entries;
}
