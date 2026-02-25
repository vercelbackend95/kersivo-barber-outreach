import { p as prisma } from './client_C4jvTHHS.mjs';

function getTimeBlockDelegate() {
  const delegate = prisma.timeBlock;
  return delegate ?? null;
}

export { getTimeBlockDelegate as g };
