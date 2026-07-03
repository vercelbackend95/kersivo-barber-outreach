import { DEMO_BARBER_IDS, DEMO_SERVICE_IDS } from './ids';

const now = new Date().toISOString();

export const demoBarbersResponse = {
  barbers: [
    {
      id: DEMO_BARBER_IDS.jamie,
      name: 'Jamie Reed',
      email: 'jamie@example.com',
      avatarUrl: null,
      active: true,
      sortOrder: 0,
      createdAt: now,
      serviceIds: [DEMO_SERVICE_IDS.skinFade, DEMO_SERVICE_IDS.classicCut],
      isActive: true,
      todayLabel: 'On shift · 09:00–18:00',
      todayIsOnShift: true,
      todayShiftWindow: { startMinutes: 540, endMinutes: 1080 },
    },
    {
      id: DEMO_BARBER_IDS.alex,
      name: 'Alex Morgan',
      email: 'alex@example.com',
      avatarUrl: null,
      active: true,
      sortOrder: 1,
      createdAt: now,
      serviceIds: [DEMO_SERVICE_IDS.skinFade, DEMO_SERVICE_IDS.beardTrim],
      isActive: true,
      todayLabel: 'On shift · 10:00–19:00',
      todayIsOnShift: true,
      todayShiftWindow: { startMinutes: 600, endMinutes: 1140 },
    },
    {
      id: DEMO_BARBER_IDS.sam,
      name: 'Sam Brooks',
      email: 'sam@example.com',
      avatarUrl: null,
      active: true,
      sortOrder: 2,
      createdAt: now,
      serviceIds: [DEMO_SERVICE_IDS.classicCut, DEMO_SERVICE_IDS.beardTrim],
      isActive: true,
      todayLabel: 'Day off',
      todayIsOnShift: false,
      todayShiftWindow: null,
    },
  ],
};

export const demoBarberRulesResponse = {
  rules: Array.from({ length: 7 }, (_, dayOfWeek) => ({
    id: `demo-rule-${dayOfWeek}`,
    dayOfWeek,
    startMinutes: dayOfWeek === 0 ? 0 : 540,
    endMinutes: dayOfWeek === 0 ? 0 : 1080,
    breakStartMin: null,
    breakEndMin: null,
    active: dayOfWeek !== 0,
  })),
};

export const demoBarberServicesResponse = {
  serviceIds: [DEMO_SERVICE_IDS.skinFade, DEMO_SERVICE_IDS.classicCut],
};
