/**
 * Build steps for `npm run build`.
 *
 * Migrations are applied only on Vercel production deployments. Preview, development and local
 * builds share databases we must not mutate, so they generate the client and build the app only.
 */

export const PRISMA_SCHEMA = 'prisma/schema.prisma';

/** @param {Record<string, string | undefined>} env */
export function shouldDeployMigrations(env) {
  return env.VERCEL_ENV === 'production';
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ name: string; command: string; args: string[] }[]}
 */
export function buildSteps(env) {
  return [
    { name: 'prisma generate', command: 'npm', args: ['run', 'prisma:generate'] },
    ...(shouldDeployMigrations(env)
      ? [{ name: 'prisma migrate deploy', command: 'prisma', args: ['migrate', 'deploy', '--schema', PRISMA_SCHEMA] }]
      : []),
    { name: 'brand icons', command: 'node', args: ['scripts/generate-favicons.mjs'] },
    { name: 'astro build', command: 'astro', args: ['build'] },
  ];
}
