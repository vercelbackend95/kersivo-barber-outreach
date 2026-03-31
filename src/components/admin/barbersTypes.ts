/**
 * Canonical types for barber-related data.
 *
 * ACTIVITY FIELD CONVENTION
 * ─────────────────────────
 * The database schema stores the activity flag as `active: boolean`.
 * The API at /api/admin/barbers maps it to `isActive` before sending the
 * response, so every API response contains BOTH fields:
 *   - `isActive` — canonical, always present, use this everywhere in the UI
 *   - `active`   — raw DB field, also returned by the API, kept for compat
 *
 * Always read activity through `barber.isActive` (or the normalizeBarberStatus()
 * helper exported by the component that needs it, which now simply returns
 * `barber.isActive` as a single source of truth).
 */

export type Barber = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** Canonical activity field — always present in /api/admin/barbers responses. */
  isActive: boolean;
  /** Raw DB field, also present in API responses. Prefer `isActive`. */
  active?: boolean;
  sortOrder?: number;
  serviceIds?: string[];
  todayLabel?: string;
  todayIsOnShift?: boolean | null;
};

export type ServiceOption = {
  id: string;
  name: string;
  /** Canonical activity field. */
  isActive?: boolean;
  /** Raw DB field. Prefer `isActive`. */
  active?: boolean;
};

export type WorkingHourRow = {
  dayOfWeek: number;
  active: boolean;
  startTime: string;
  endTime: string;
};

export type TimeBlock = {
  id: string;
  title: string;
  barberId?: string | null;
  startAt: string;
  endAt: string;
  barber?: { id: string; name: string } | null;
};
