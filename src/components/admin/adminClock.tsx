import { createContext, useContext } from 'react';
import { BLACKLINE_HERO_SHOWCASE_NOW_MS } from '@/lib/admin/heroShowcase';

/**
 * Explicit clock for admin UI that renders "today", "now" or relative times.
 * Frozen clocks must also disable every tick / poll that exists only to follow real time.
 */
export type AdminClock = {
  frozen: boolean;
  nowMs: () => number;
};

export const REAL_ADMIN_CLOCK: AdminClock = {
  frozen: false,
  nowMs: () => Date.now(),
};

export const HERO_SHOWCASE_ADMIN_CLOCK: AdminClock = {
  frozen: true,
  nowMs: () => BLACKLINE_HERO_SHOWCASE_NOW_MS,
};

export const AdminClockContext = createContext<AdminClock>(REAL_ADMIN_CLOCK);

export function useAdminClock(): AdminClock {
  return useContext(AdminClockContext);
}
