/**
 * One-off cleanup: mark QUEUED/FAILED EmailOutbound rows addressed to reserved recipient domains
 * (example.com/.org/.net and subdomains, *.test, *.invalid, *.example, *.localhost) as SUPPRESSED, so they are
 * never retried and never re-alerted by ops-health.
 *
 * Dry run (default, read-only):  npx tsx scripts/ops/suppress-test-outbox.ts
 * Write:                          npx tsx scripts/ops/suppress-test-outbox.ts --apply
 *
 * Uses DATABASE_URL from the environment. Check the printed host before passing --apply.
 */
import { EmailOutboundStatus, Prisma, PrismaClient } from '@prisma/client';
import { isReservedRecipient, recipientDomain } from '../../src/lib/email/reservedRecipients';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const RESERVED_SUFFIXES = [
  '@example.com',
  '@example.org',
  '@example.net',
  '.example.com',
  '.example.org',
  '.example.net',
  '.test',
  '.invalid',
  '.example',
  '.localhost',
  '@localhost',
];

function databaseHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? '').host || '(unknown)';
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

async function main() {
  console.log(`[suppress-test-outbox] database host: ${databaseHost()}`);
  console.log(`[suppress-test-outbox] mode: ${apply ? 'APPLY (writes)' : 'dry run (no writes)'}`);

  const candidates = await prisma.emailOutbound.findMany({
    where: {
      status: { in: [EmailOutboundStatus.QUEUED, EmailOutboundStatus.FAILED] },
      OR: RESERVED_SUFFIXES.map((suffix) => ({
        toEmail: { endsWith: suffix, mode: Prisma.QueryMode.insensitive },
      })),
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, toEmail: true, purpose: true, status: true, attempts: true, createdAt: true },
  });
  // Re-check with the same rule the send path uses (the DB filter is only a narrowing pass).
  const rows = candidates.filter((row) => isReservedRecipient(row.toEmail));

  if (rows.length === 0) {
    console.log('[suppress-test-outbox] nothing to suppress.');
    return;
  }

  for (const row of rows) {
    console.log(
      `  ${row.id}  ${row.status.padEnd(6)}  attempts=${row.attempts}  ${row.purpose}  @${recipientDomain(row.toEmail)}  ${row.createdAt.toISOString()}`,
    );
  }
  console.log(`[suppress-test-outbox] ${rows.length} row(s) match.`);

  if (!apply) {
    console.log('[suppress-test-outbox] dry run: re-run with --apply to mark them SUPPRESSED.');
    return;
  }

  const result = await prisma.emailOutbound.updateMany({
    where: {
      id: { in: rows.map((row) => row.id) },
      // Never touch a row that was claimed or sent since the read above.
      status: { in: [EmailOutboundStatus.QUEUED, EmailOutboundStatus.FAILED] },
    },
    data: {
      status: EmailOutboundStatus.SUPPRESSED,
      provider: 'suppressed',
      payload: Prisma.DbNull,
      nextAttemptAt: null,
    },
  });
  console.log(`[suppress-test-outbox] marked ${result.count} row(s) SUPPRESSED.`);
}

main()
  .catch((error) => {
    console.error('[suppress-test-outbox] failed', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
