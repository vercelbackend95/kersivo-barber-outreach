import { spawnSync } from 'node:child_process';

process.env.PRISMA_HIDE_UPDATE_MESSAGE = '1';

const result = spawnSync(
  'prisma',
  ['generate', '--schema', 'prisma/schema.prisma'],
  { stdio: 'inherit', shell: true },
);

process.exit(result.status ?? 1);
