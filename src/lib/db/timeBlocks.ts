import { prisma } from './client';

type TimeBlockDelegate = {
  findMany: (...args: any[]) => Promise<any>;
  create: (...args: any[]) => Promise<any>;
  delete: (...args: any[]) => Promise<any>;
};

export function getTimeBlockDelegate(): TimeBlockDelegate | null {
  const delegate = (prisma as any).timeBlock;

  if (import.meta.env.DEV) {
    console.info('[timeblocks][dev] prisma keys', Object.keys(prisma));
    console.info('[timeblocks][dev] has timeBlock delegate', Boolean(delegate));
  }

  return delegate ?? null;
}

