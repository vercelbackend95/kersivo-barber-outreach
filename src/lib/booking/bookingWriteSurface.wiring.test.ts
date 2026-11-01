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
const BOOKING_UPDATE_CALL = /\.booking\.update\s*\(/;

/** Known surfaces that call booking.update (occupancy-affecting ones must validate). */
const BOOKING_UPDATE_ALLOWED = new Set([
  'lib/booking/service.ts',
  'lib/booking/depositMoney.ts',
  'lib/sms/reminders.ts',
  'lib/email/reminders.ts',
  'lib/admin/clientErasure.ts',
  'pages/api/admin/bookings/[id]/service.ts',
  'pages/api/admin/bookings/[id]/force-reschedule.ts',
  'pages/api/admin/bookings/[id]/status.ts',
  'pages/api/admin/bookings/[id]/notes.ts',
  'pages/api/public/bookings/[shopId]/create.ts',
]);

describe('booking write surface', () => {
  it('allows booking.create only in createInstantBooking (service.ts)', () => {
    const root = resolve(process.cwd(), 'src');
    const allowedRel = join('lib', 'booking', 'service.ts');
    const offenders: string[] = [];

    for (const file of collectProductionSourceFiles(root)) {
      const rel = relative(root, file).replace(/\\/g, '/');
      if (rel === allowedRel.replace(/\\/g, '/')) continue;
      // QA-only route: 404 unless PREVIEW_HUB_REAL_QA (local stack). Not a production write surface.
      if (rel.startsWith('pages/api/preview-hub-qa/')) continue;
      const src = readFileSync(file, 'utf8');
      if (BOOKING_CREATE_CALL.test(src)) offenders.push(rel);
    }

    expect(offenders, 'booking.create must not appear outside service.ts').toEqual([]);

    const serviceSrc = readFileSync(resolve(root, allowedRel), 'utf8');
    expect(serviceSrc).toMatch(BOOKING_CREATE_CALL);
  });

  it('does not call booking.create from any API route', () => {
    const apiRoot = resolve(process.cwd(), 'src', 'pages', 'api');
    const offenders: string[] = [];

    for (const file of collectProductionSourceFiles(apiRoot)) {
      const rel = relative(apiRoot, file).replace(/\\/g, '/');
      if (rel.startsWith('preview-hub-qa/')) continue;
      const src = readFileSync(file, 'utf8');
      if (BOOKING_CREATE_CALL.test(src)) {
        offenders.push(rel);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('restricts booking.update call sites to known validated surfaces', () => {
    const root = resolve(process.cwd(), 'src');
    const offenders: string[] = [];

    for (const file of collectProductionSourceFiles(root)) {
      const rel = relative(root, file).replace(/\\/g, '/');
      if (BOOKING_UPDATE_ALLOWED.has(rel)) continue;
      const src = readFileSync(file, 'utf8');
      if (BOOKING_UPDATE_CALL.test(src)) offenders.push(rel);
    }

    expect(
      offenders,
      'unexpected booking.update outside allowlisted validated surfaces',
    ).toEqual([]);
  });

  it('ships manual booking only as a validated delegate to createInstantBooking', () => {
    const manualRoute = resolve(
      process.cwd(),
      'src',
      'pages',
      'api',
      'admin',
      'bookings',
      'manual.ts',
    );
    expect(existsSync(manualRoute), 'validated manual booking route should exist').toBe(true);
    const src = readFileSync(manualRoute, 'utf8');
    expect(src).toContain('createInstantBooking');
    expect(src).toContain('allowDepositCollection: false');
    expect(src).not.toMatch(BOOKING_CREATE_CALL);
  });
});
