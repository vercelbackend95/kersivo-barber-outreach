import type { WorkingHourRow } from '../barbersTypes';

export type BarberWizardMode = 'create' | 'edit' | 'setup-member';

export type BarberWizardStep = 1 | 2 | 3 | 4;

export type BarberWizardService = {
  id: string;
  name: string;
};

export type BarberWizardErrors = Partial<Record<'name' | 'services' | 'schedule', string>>;

export const BARBER_WIZARD_STEPS: Array<{ number: BarberWizardStep; label: string }> = [
  { number: 1, label: 'Basics' },
  { number: 2, label: 'Services' },
  { number: 3, label: 'Schedule' },
  { number: 4, label: 'Review' }
];

export const BARBER_AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const BARBER_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const WEEK_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function getWeeklyHoursSummary(workingHours: WorkingHourRow[]): {
  onShiftDays: number;
  hoursLabel: string;
  totalHours: number;
} {
  const onShiftDays = workingHours.filter((day) => day.active).length;
  const totalMinutes = workingHours.reduce((sum, day) => {
    if (!day.active) return sum;
    const [startHour, startMinute] = day.startTime.split(':').map(Number);
    const [endHour, endMinute] = day.endTime.split(':').map(Number);
    if ([startHour, startMinute, endHour, endMinute].some((part) => Number.isNaN(part))) {
      return sum;
    }
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    return end > start ? sum + (end - start) : sum;
  }, 0);

  const totalHours = totalMinutes / 60;
  const hoursLabel = Number.isInteger(totalHours) ? `${totalHours}h` : `${totalHours.toFixed(1)}h`;

  return { onShiftDays, hoursLabel, totalHours };
}

export function validateBarberWizardStep(
  step: BarberWizardStep,
  name: string,
  serviceIds: string[],
  workingHours: WorkingHourRow[]
): BarberWizardErrors {
  const errors: BarberWizardErrors = {};

  if (step === 1) {
    const trimmed = name.trim();
    if (!trimmed) errors.name = 'Enter a barber name.';
    else if (trimmed.length > 120) errors.name = 'Keep the name to 120 characters or fewer.';
  }

  if (step === 2) {
    if (serviceIds.length === 0) errors.services = 'Select at least one service.';
  }

  if (step === 3) {
    if (workingHours.length !== 7) {
      errors.schedule = 'Working hours must include every day of the week.';
    } else {
      for (const rule of workingHours) {
        if (rule.active && rule.startTime >= rule.endTime) {
          const dayLabel = WEEK_DAY_LABELS[rule.dayOfWeek] ?? `Day ${rule.dayOfWeek}`;
          errors.schedule = `${dayLabel}: start time must be earlier than end time.`;
          break;
        }
      }
    }
  }

  return errors;
}
