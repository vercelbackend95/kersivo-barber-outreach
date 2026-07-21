import {
  LANDING_DEMO_BARBER_AVATARS,
} from '../../landing/landingDemoAssets';
import { minutesToTimeString } from '../timeStrings';
import { DEMO_BARBER_IDS, DEMO_SERVICE_IDS } from './ids';

const now = new Date().toISOString();
/** Match demo barber cards: on shift 09:00–19:00 (London), Sunday off. */
const DEMO_SHIFT_START_MIN = 9 * 60;
const DEMO_SHIFT_END_MIN = 19 * 60;

export const demoBarbersResponse = {
  barbers: [
    {
      id: DEMO_BARBER_IDS.jamie,
      name: 'Jamie Reed',
      email: 'jamie@example.com',
      avatarUrl: LANDING_DEMO_BARBER_AVATARS.jamie,
      active: true,
      sortOrder: 0,
      createdAt: now,
      serviceIds: [
        DEMO_SERVICE_IDS.qualityHaircut,
        DEMO_SERVICE_IDS.premiumHaircut,
        DEMO_SERVICE_IDS.skinFadeWithHaircut,
        DEMO_SERVICE_IDS.shortBackAndSides,
        DEMO_SERVICE_IDS.skinFadeBackSides,
        DEMO_SERVICE_IDS.expressShave,
        DEMO_SERVICE_IDS.friction10Min,
      ],
      isActive: true,
      todayLabel: 'On shift · 09:00–19:00',
      todayIsOnShift: true,
      todayShiftWindow: {
        startMinutes: 540,
        endMinutes: 1140,
        breakStartMin: null,
        breakEndMin: null,
      },
    },
    {
      id: DEMO_BARBER_IDS.alex,
      name: 'Alex Morgan',
      email: 'alex@example.com',
      avatarUrl: LANDING_DEMO_BARBER_AVATARS.alex,
      active: true,
      sortOrder: 1,
      createdAt: now,
      serviceIds: [
        DEMO_SERVICE_IDS.premiumHaircut,
        DEMO_SERVICE_IDS.qualityBeardTrim,
        DEMO_SERVICE_IDS.skinFadeWithHaircut,
        DEMO_SERVICE_IDS.skinFadeBackSides,
        DEMO_SERVICE_IDS.headShave,
        DEMO_SERVICE_IDS.premiumBeardTrim,
        DEMO_SERVICE_IDS.longerBeardTrim,
        DEMO_SERVICE_IDS.luxuryWetShave,
      ],
      isActive: true,
      todayLabel: 'On shift · 09:00–19:00',
      todayIsOnShift: true,
      todayShiftWindow: {
        startMinutes: 540,
        endMinutes: 1140,
        breakStartMin: null,
        breakEndMin: null,
      },
    },
    {
      id: DEMO_BARBER_IDS.sam,
      name: 'Sam Brooks',
      email: 'sam@example.com',
      avatarUrl: LANDING_DEMO_BARBER_AVATARS.sam,
      active: true,
      sortOrder: 2,
      createdAt: now,
      serviceIds: [
        DEMO_SERVICE_IDS.qualityHaircut,
        DEMO_SERVICE_IDS.clippersOnly,
        DEMO_SERVICE_IDS.longerHaircut,
        DEMO_SERVICE_IDS.premiumBeardTrim,
        DEMO_SERVICE_IDS.friction,
        DEMO_SERVICE_IDS.friction10Min,
      ],
      isActive: true,
      todayLabel: 'On shift · 09:00–19:00',
      todayIsOnShift: true,
      todayShiftWindow: {
        startMinutes: 540,
        endMinutes: 1140,
        breakStartMin: null,
        breakEndMin: null,
      },
    },
    {
      id: DEMO_BARBER_IDS.marcus,
      name: 'Marcus Bell',
      email: 'marcus@example.com',
      avatarUrl: LANDING_DEMO_BARBER_AVATARS.marcus,
      active: true,
      sortOrder: 3,
      createdAt: now,
      serviceIds: [
        DEMO_SERVICE_IDS.qualityBeardTrim,
        DEMO_SERVICE_IDS.clippersOnly,
        DEMO_SERVICE_IDS.shortBackAndSides,
        DEMO_SERVICE_IDS.longerHaircut,
        DEMO_SERVICE_IDS.headShave,
        DEMO_SERVICE_IDS.longerBeardTrim,
        DEMO_SERVICE_IDS.luxuryWetShave,
        DEMO_SERVICE_IDS.expressShave,
        DEMO_SERVICE_IDS.friction,
      ],
      isActive: true,
      todayLabel: 'On shift · 09:00–19:00',
      todayIsOnShift: true,
      todayShiftWindow: {
        startMinutes: 540,
        endMinutes: 1140,
        breakStartMin: null,
        breakEndMin: null,
      },
    },
  ],
};

/** Same shape as GET /api/admin/barbers/:id/rules (`startTime`/`endTime` HH:mm). */
export const demoBarberRulesResponse = {
  rules: Array.from({ length: 7 }, (_, dayOfWeek) => {
    const active = dayOfWeek !== 0;
    return {
      dayOfWeek,
      active,
      startTime: minutesToTimeString(active ? DEMO_SHIFT_START_MIN : 10 * 60),
      endTime: minutesToTimeString(active ? DEMO_SHIFT_END_MIN : 18 * 60),
    };
  }),
};

export const demoBarberServicesResponse = {
  serviceIds: [DEMO_SERVICE_IDS.skinFadeWithHaircut, DEMO_SERVICE_IDS.qualityHaircut],
};
