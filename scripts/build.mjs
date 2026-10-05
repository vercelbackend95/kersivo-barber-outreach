import { spawnSync } from 'node:child_process';
import { buildSteps, shouldDeployMigrations } from './build-plan.mjs';

const dryRun = process.argv.includes('--dry-run');
const vercelEnv = process.env.VERCEL_ENV || '(unset)';
const steps = buildSteps(process.env);

console.log(
  `[build] VERCEL_ENV=${vercelEnv} -> prisma migrate deploy ${
    shouldDeployMigrations(process.env) ? 'ENABLED (production)' : 'SKIPPED (non-production)'
  }`,
);
console.log(`[build] steps: ${steps.map((step) => step.name).join(' -> ')}`);

if (dryRun) process.exit(0);

for (const step of steps) {
  console.log(`[build] running: ${step.command} ${step.args.join(' ')}`);
  const result = spawnSync(step.command, step.args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`[build] ${step.name} failed`);
    process.exit(result.status ?? 1);
  }
}
