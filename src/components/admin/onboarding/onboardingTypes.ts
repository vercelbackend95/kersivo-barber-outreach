export type OnboardingBarber = {
  id?: string;
  name: string;
  avatarUrl?: string | null;
  avatarFile?: File | null;
  /** When false, seat is calendar-off. Solo / single card is always forced on by the API. */
  onlineBookings?: boolean;
  /** Roster intent for extra seats (index > 0). Ignored for Owner card. */
  intendedRole?: 'MANAGER' | 'BARBER';
};

export type OnboardingService = {
  id?: string;
  key: string;
  name: string;
  pricePence: number;
  durationMinutes: number;
  selected: boolean;
  isCustom?: boolean;
};

export type OnboardingHoursRow = {
  dayOfWeek: number;
  active: boolean;
  startTime: string;
  endTime: string;
};

export type OnboardingState = {
  shop: {
    id: string;
    name: string;
    townCity: string | null;
    logoUrl: string | null;
  };
  onboardingCompleted: boolean;
  onboardingCurrentStep: number;
  onboardingCompletedAt: string | null;
  barbers: Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
    isActive: boolean;
    sortOrder: number;
    intendedRole?: 'MANAGER' | 'BARBER';
  }>;
  services: Array<{
    id: string;
    name: string;
    pricePence: number;
    durationMinutes: number;
    isActive: boolean;
    displayOrder: number;
    category: string | null;
  }>;
  hours: OnboardingHoursRow[];
  shopHours?: OnboardingHoursRow[];
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
};

export const SERVICE_PRESETS: Array<{
  key: string;
  name: string;
  pricePence: number;
  durationMinutes: number;
}> = [
  { key: 'haircut', name: 'Haircut', pricePence: 2500, durationMinutes: 30 },
  { key: 'skin-fade', name: 'Skin Fade', pricePence: 3000, durationMinutes: 45 },
  { key: 'beard-trim', name: 'Beard Trim', pricePence: 1500, durationMinutes: 20 },
  { key: 'haircut-beard', name: 'Haircut & Beard', pricePence: 3500, durationMinutes: 45 },
  { key: 'kids-haircut', name: "Kids' Haircut", pricePence: 1800, durationMinutes: 30 },
];

export const DAY_LABELS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DEFAULT_HOURS: OnboardingHoursRow[] = [
  { dayOfWeek: 1, active: true, startTime: '09:00', endTime: '18:00' }, // Monday
  { dayOfWeek: 2, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 3, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 4, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 5, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 6, active: true, startTime: '09:00', endTime: '16:00' }, // Saturday
  { dayOfWeek: 7, active: false, startTime: '09:00', endTime: '18:00' }, // Sunday
];

export function formatGbp(pricePence: number) {
  return `£${(pricePence / 100).toFixed(pricePence % 100 === 0 ? 0 : 2)}`;
}

export function parseGbpToPence(value: string) {
  const cleaned = value.replace(/[£,\s]/g, '').trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return NaN;
  return Math.round(parsed * 100);
}

export function orderedHoursForDisplay(hours: OnboardingHoursRow[]) {
  const dayOrder = [1, 2, 3, 4, 5, 6, 7];
  return dayOrder.map((dayOfWeek) => {
    const row = hours.find((item) => item.dayOfWeek === dayOfWeek);
    return {
      dayOfWeek,
      label: DAY_LABELS[dayOfWeek] ?? `Day ${dayOfWeek}`,
      active: row?.active ?? false,
      startTime: row?.startTime ?? '09:00',
      endTime: row?.endTime ?? '18:00',
    };
  });
}

export async function readJsonError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === 'string') return payload.error;
    return 'Something went wrong. Please try again.';
  } catch {
    return 'Something went wrong. Please try again.';
  }
}
