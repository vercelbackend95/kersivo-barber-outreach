import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

function collectProductionSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectProductionSourceFiles(full, out);
      continue;
    }
    if (/\.test\.(ts|tsx)$/.test(entry)) continue;
    if (/\.(ts|tsx|js|mjs|astro)$/.test(entry)) out.push(full);
  }
  return out;
}

const BOOKING_CREATE_CALL = /\.booking\.create\s*\(/;

describe('booking write surface', () => {
  it('allows booking.create only in createInstantBooking (service.ts)', () => {
    const root = resolve(process.cwd(), 'src');
    const allowedRel = join('lib', 'booking', 'service.ts');
    const offenders: string[] = [];

    for (const file of collectProductionSourceFiles(root)) {
      const rel = relative(root, file);
      if (rel === allowedRel) continue;
      const src = readFileSync(file, 'utf8');
      if (BOOKING_CREATE_CALL.test(src)) offenders.push(rel.replace(/\\/g, '/'));
    }

    expect(offenders, 'booking.create must not appear outside service.ts').toEqual([]);

    const serviceSrc = readFileSync(resolve(root, allowedRel), 'utf8');
    expect(serviceSrc).toMatch(BOOKING_CREATE_CALL);
  });

  it('does not call booking.create from any API route', () => {
    const apiRoot = resolve(process.cwd(), 'src', 'pages', 'api');
    const offenders: string[] = [];

    for (const file of collectProductionSourceFiles(apiRoot)) {
      const src = readFileSync(file, 'utf8');
      if (BOOKING_CREATE_CALL.test(src)) {
        offenders.push(relative(apiRoot, file).replace(/\\/g, '/'));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('does not ship the unvalidated admin manual booking route', () => {
    const manualRoute = resolve(
      process.cwd(),
      'src',
      'pages',
      'api',
      'admin',
      'bookings',
      'manual.ts',
    );
    expect(existsSync(manualRoute), 'src/pages/api/admin/bookings/manual.ts must not exist').toBe(
      false,
    );
  });
});
