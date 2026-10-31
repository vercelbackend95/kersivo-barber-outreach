import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const PORT = process.env.PREVIEW_HUB_REAL_PORT || '4397';
const PG_PORT = Number(process.env.PREVIEW_HUB_PG_PORT || 55432);
const DATABASE_URL =
  process.env.PREVIEW_HUB_DATABASE_URL ||
  `postgresql://kersivo:kersivo@127.0.0.1:${PG_PORT}/kersivo_hub_qa`;

function assertLocal(url) {
  const host = new URL(url.replace(/^postgres(ql)?:/i, 'http:')).hostname.toLowerCase();
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
    throw new Error(`Shop Hub real QA aborted: DATABASE_URL host must be localhost (got ${host}).`);
  }
}

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function waitForPort(port, host = '127.0.0.1', timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = async () => {
      if (await isPortOpen(port, host)) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) reject(new Error(`Timed out waiting for ${host}:${port}`));
      else setTimeout(tryOnce, 400);
    };
    void tryOnce();
  });
}

async function waitForPortClosed(port, host = '127.0.0.1', timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!(await isPortOpen(port, host))) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${host}:${port} to close`);
}

async function stopAstro() {
  try {
    await run('npx', ['astro', 'dev', 'stop']);
  } catch {
    /* nothing to stop */
  }
  try {
    await waitForPortClosed(Number(PORT));
  } catch {
    /* port may already be free or owned by a non-astro process */
  }
}

function startAstro(env, port = PORT) {
  return spawn('npx', ['astro', 'dev', '--host', '127.0.0.1', '--port', String(port), '--force'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });
}

async function waitForHealth(origin, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let hits = 0;
  while (Date.now() < deadline) {
    try {
      const health = await fetch(`${origin}/preview-hub-qa/health`);
      hits = health.ok ? hits + 1 : 0;
      if (hits >= 2) return;
    } catch {
      hits = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Timed out waiting for QA health at ${origin}`);
}

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, ...extraEnv },
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited ${code}`));
    });
  });
}

async function ensurePostgres() {
  assertLocal(DATABASE_URL);
  try {
    await waitForPort(PG_PORT, '127.0.0.1', 800);
    console.log(`[preview-hub qa] Postgres already listening on ${PG_PORT}`);
    return;
  } catch {
    /* start one */
  }

  try {
    await run('docker', [
      'compose',
      '-f',
      'docker-compose.preview-hub.yml',
      'up',
      '-d',
      '--wait',
    ]);
    await waitForPort(PG_PORT);
    return;
  } catch (error) {
    console.warn('[preview-hub qa] Docker compose unavailable:', error instanceof Error ? error.message : error);
  }

  try {
    const { existsSync } = await import('node:fs');
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    const databaseDir = join(root, '.preview-hub-pgdata');
    const pg = new EmbeddedPostgres({
      databaseDir,
      user: 'kersivo',
      password: 'kersivo',
      port: PG_PORT,
      persistent: true,
      autoRehydrateSymlinks: true,
      initdbFlags: ['--encoding=UTF8', '--locale=C', '--lc-collate=C', '--lc-ctype=C'],
    });
    if (!existsSync(join(databaseDir, 'PG_VERSION'))) {
      await pg.initialise();
    }
    await pg.start();
    try {
      await pg.createDatabase('kersivo_hub_qa');
    } catch {
      /* already exists */
    }
    await waitForPort(PG_PORT);
    return;
  } catch (error) {
    throw new Error(
      `Could not start local Postgres on ${PG_PORT}. Install Docker Desktop or PostgreSQL, then retry. ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
}

function qaEnv(overrides = {}) {
  return {
    DATABASE_URL,
    PREVIEW_HUB_ENABLED: 'true',
    FREE_PREVIEW_FLOW_ENABLED: 'true',
    PRIVATE_BLOB_DRIVER: 'memory',
    PREVIEW_HUB_STRIPE_STUB: 'true',
    PREVIEW_HUB_REAL_QA: 'true',
    KERSIVO_OPS_EMAILS: 'ops.hubqa@kersivo.test',
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'hub-qa-better-auth-secret-32chars!!',
    BETTER_AUTH_URL: `http://127.0.0.1:${PORT}`,
    PUBLIC_SITE_URL: `http://127.0.0.1:${PORT}`,
    FREE_PREVIEW_DAILY_CAP: '50',
    NODE_ENV: 'development',
    // Never send real mail or hit production Stripe from this harness.
    RESEND_API_KEY: '',
    ...overrides,
  };
}

async function applySchema(env) {
  // Production uses `prisma migrate deploy`. A brand-new local cluster cannot replay
  // the historical chain (e.g. SaasSubscriptionStatus is ALTERed before it is created).
  // db push applies the current schema only — correct for this disposable QA database.
  await run(
    'npx',
    ['prisma', 'db', 'push', '--schema', 'prisma/schema.prisma', '--accept-data-loss', '--skip-generate'],
    env,
  );
}

async function prepare() {
  await ensurePostgres();
  const env = qaEnv();
  await applySchema(env);
  await run('npx', ['tsx', 'scripts/preview-hub/seed-real.ts'], env);
}

async function flagOffCheck() {
  const seed = JSON.parse(readFileSync(join(root, '.preview-hub-seed.json'), 'utf8'));
  const origin = `http://127.0.0.1:${PORT}`;
  const env = qaEnv({
    PREVIEW_HUB_ENABLED: '',
    BETTER_AUTH_URL: origin,
    PUBLIC_SITE_URL: origin,
  });
  await stopAstro();
  const child = startAstro(env, PORT);
  try {
    await waitForPort(Number(PORT), '127.0.0.1', 180000);
    await waitForHealth(origin);
    const preview = await fetch(`${origin}/preview/${seed.requested.token}`);
    if (preview.status !== 404) {
      throw new Error(`flag-off REQUESTED hub expected 404, got ${preview.status}`);
    }
    const submit = await fetch(`${origin}/api/free-preview`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: 'Hub QA Flag Off',
        townCity: 'Leeds',
        email: 'flagoff.hubqa@hubqa.test',
      }),
    });
    if (!submit.ok) throw new Error(`flag-off intake failed ${submit.status}`);
    await new Promise((resolve) => setTimeout(resolve, 800));
    const mail = await fetch(`${origin}/api/preview-hub-qa/emails?to=flagoff.hubqa@hubqa.test`);
    const json = await mail.json();
    const html = JSON.stringify(json.emails ?? []);
    if (html.includes('Open your shop hub')) {
      throw new Error('flag-off ack email still contains the hub CTA');
    }
    if (!html.toLowerCase().includes('preview') && !html.toLowerCase().includes('designing')) {
      throw new Error('flag-off ack email missing the previous-flow copy');
    }
    console.log('[preview-hub qa] flag-off 404 + old ack email confirmed');
  } finally {
    child.kill();
    await stopAstro();
  }
}

const mode = process.argv.includes('--serve')
  ? 'serve'
  : process.argv.includes('--test')
    ? 'test'
    : 'prepare';

if (mode === 'prepare' || mode === 'serve' || mode === 'test') {
  await prepare();
}

if (mode === 'prepare') {
  // Leave the cluster running; process.exit skips embedded-postgres stop hooks.
  process.exit(0);
}

if (mode === 'serve') {
  await stopAstro();
  const child = startAstro(qaEnv(), PORT);
  child.on('exit', (code) => process.exit(code ?? 1));
} else if (mode === 'test') {
  const origin = `http://127.0.0.1:${PORT}`;
  await stopAstro();
  const child = startAstro(qaEnv(), PORT);
  try {
    await waitForPort(Number(PORT), '127.0.0.1', 180000);
    await waitForHealth(origin);
    await run('npx', ['playwright', 'test', '--config=scripts/preview-hub-real.playwright.config.mjs'], qaEnv());
  } finally {
    child.kill();
  }
  await flagOffCheck();
  process.exit(0);
}
