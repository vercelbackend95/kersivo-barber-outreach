import { describe, expect, it } from 'vitest';
import { buildSteps, shouldDeployMigrations } from '../../../scripts/build-plan.mjs';

const stepNames = (env: Record<string, string | undefined>) => buildSteps(env).map((step) => step.name);

describe('build plan - migrations only on Vercel production', () => {
  it('production: generate -> migrate deploy -> brand icons -> astro build', () => {
    expect(shouldDeployMigrations({ VERCEL_ENV: 'production' })).toBe(true);
    expect(stepNames({ VERCEL_ENV: 'production' })).toEqual(['prisma generate', 'prisma migrate deploy', 'brand icons', 'astro build']);
    expect(buildSteps({ VERCEL_ENV: 'production' })[1]).toEqual({
      name: 'prisma migrate deploy',
      command: 'prisma',
      args: ['migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
    });
  });

  it.each([
    ['preview', { VERCEL_ENV: 'preview' }],
    ['development', { VERCEL_ENV: 'development' }],
    ['local (unset)', {}],
    ['empty', { VERCEL_ENV: '' }],
    ['near-miss casing', { VERCEL_ENV: 'Production' }],
  ])('%s: generate -> brand icons -> astro build, never migrate deploy', (_label, env: Record<string, string | undefined>) => {
    expect(shouldDeployMigrations(env)).toBe(false);
    expect(stepNames(env)).toEqual(['prisma generate', 'brand icons', 'astro build']);
  });

  it('a production DATABASE_URL alone does not enable migrations outside Vercel production', () => {
    expect(shouldDeployMigrations({ DATABASE_URL: 'postgresql://prod', NODE_ENV: 'production' })).toBe(false);
  });
});
