import { PrismaClient, SetupDepositStatus } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
  var __prismaSchemaMarker: string | undefined;
}

/**
 * Bumps when generated models/enums change so a stale singleton is discarded after `prisma generate`.
 * Include a version token whenever a new model is added (e.g. SaasSubscription) — do not rely only on
 * SetupDepositStatus keys, or hot-reload keeps an old client without the new delegate.
 */
const SCHEMA_MARKER = `saas-subscription-v1|sms-reminders-enabled-v1|${Object.keys(SetupDepositStatus).sort().join('|')}`;

function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

function getPrismaClient(): PrismaClient {
  if (globalThis.__prisma && globalThis.__prismaSchemaMarker === SCHEMA_MARKER) {
    return globalThis.__prisma;
  }

  void globalThis.__prisma?.$disconnect().catch(() => undefined);
  const client = createPrismaClient();

  // Always cache on globalThis so serverless warm instances reuse one client
  // and avoid disconnect/reconnect churn mid-request.
  globalThis.__prisma = client;
  globalThis.__prismaSchemaMarker = SCHEMA_MARKER;

  return client;
}

export const prisma = getPrismaClient();
