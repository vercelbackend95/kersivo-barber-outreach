import { emptyInvitationFields, type TeamCardDto } from '@/lib/admin/teamCards';
import { minutesToTimeString } from '@/lib/admin/timeStrings';
import { ALL_WEEKDAYS } from '@/lib/booking/weekdays';
import {
  HERITAGE_BARBERS,
  HERITAGE_HOURS,
  HERITAGE_PRODUCTS,
  HERITAGE_SERVICE_CATEGORIES,
  HERITAGE_SERVICES,
  HERITAGE_SHOP_NAME,
  type HeritageBarber,
} from '@/lib/demo/heritage/data';
import { blacklineDayKey, londonWeekdayMon1 } from '@/lib/admin/blacklineDemoFixtures/time';

const STABLE_CREATED_AT = '2026-01-12T09:00:00.000Z';

export const HERITAGE_SHOP_DISPLAY_NAME = HERITAGE_SHOP_NAME;

export type HeritagePerson = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
};

const FIRST_NAMES: readonly string[] = [
  'James', 'Tom', 'Daniel', 'Marcus', 'Ollie', 'Sam', 'Ben', 'Harry', 'Joe', 'Ethan',
  'Rory', 'Kieran', 'Adam', 'George', 'Lewis', 'Isaac', 'Charlie', 'Nathan', 'Matt', 'Zain',
  'Alfie', 'Will', 'Finn', 'Jack', 'Theo', 'Leo', 'Callum', 'Dev', 'Aaron', 'Luke',
  'Max', 'Elliot', 'Hugo', 'Ryan', 'Patrick', 'Toby', 'Henry', 'Oscar', 'Felix', 'Imran',
];

const LAST_NAMES: readonly string[] = [
  'Whitfield', 'Hargreaves', 'Price', 'Osei', 'Bramwell', 'Kaur', 'Mitchell', 'Lowe', 'Atkinson', 'Doyle',
  'Gallagher', 'Walsh', 'Nowicki', 'Pemberton', 'Grant', 'Bell', 'Rhodes', 'Ellis', 'Sullivan', 'Hussain',
  'Turner', 'Dunmore', 'Connolly', 'Barlow', 'Marsh', 'Fenwick', 'Reid', 'Patel', 'Clarke', 'Harding',
  'Wainwright', 'Shaw', 'Lennox', 'Pritchard', 'Moss', 'Byrne', 'Ashworth', 'Calder', 'Lindqvist', 'Okafor',
];

/** Size of the client book: enough that a month of bookings reads like a real shop, not forty men on repeat. */
export const HERITAGE_CLIENT_COUNT = 300;

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
}

/** Deterministic first/last pairings (coprime strides, so no two clients share a full name). */
function clientName(index: number): string {
  const first = FIRST_NAMES[(index * 7) % FIRST_NAMES.length]!;
  const last = LAST_NAMES[(index * 11 + Math.floor(index / LAST_NAMES.length)) % LAST_NAMES.length]!;
  return `${first} ${last}`;
}

/**
 * Fictional clients of the fictional shop. Phone numbers are in Ofcom's drama range (07700 900xxx).
 * The schedule draws earlier rows more often, so the book has regulars as well as occasional visitors.
 */
export const HERITAGE_PEOPLE: readonly HeritagePerson[] = Array.from({ length: HERITAGE_CLIENT_COUNT }, (_, index) => {
  const fullName = clientName(index);
  return {
    id: `hg-client-${slug(fullName).replace(/\./g, '-')}`,
    fullName,
    email: `${slug(fullName)}@example.com`,
    phone: `07700 900${String(index).padStart(3, '0')}`,
  };
});

const ALL_SERVICE_IDS = HERITAGE_SERVICES.map((service) => service.id);

/** Heritage weekday numbering (0 = Sunday) from an ISO Monday-first weekday. */
export function siteWeekday(isoWeekdayMon1: number): number {
  return isoWeekdayMon1 % 7;
}

/** Opening window for a London day, or null when the shop is closed. */
export function heritageTradingWindow(dayKey: string): { openMinute: number; closeMinute: number } | null {
  const hours = HERITAGE_HOURS[siteWeekday(londonWeekdayMon1(dayKey))];
  if (!hours) return null;
  return { openMinute: hours[0] * 60, closeMinute: hours[1] * 60 };
}

export function barberWorksOn(barber: HeritageBarber, dayKey: string): boolean {
  return barber.days.includes(siteWeekday(londonWeekdayMon1(dayKey)));
}

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function shiftFor(barber: HeritageBarber, dayKey: string) {
  const window = heritageTradingWindow(dayKey);
  if (!window || !barberWorksOn(barber, dayKey)) {
    return {
      todayLabel: 'Off today',
      todayIsOnShift: false,
      todayShiftWindow: {
        startMinutes: 9 * 60,
        endMinutes: 19 * 60,
        breakStartMin: null,
        breakEndMin: null,
      },
    };
  }
  return {
    todayLabel: `On shift · ${hhmm(window.openMinute)}–${hhmm(window.closeMinute)}`,
    todayIsOnShift: true,
    todayShiftWindow: {
      startMinutes: window.openMinute,
      endMinutes: window.closeMinute,
      breakStartMin: null,
      breakEndMin: null,
    },
  };
}

export function getHeritageBarbersResponse(now = new Date()) {
  const todayKey = blacklineDayKey(now);
  return {
    barbers: HERITAGE_BARBERS.map((barber, index) => ({
      id: barber.id,
      name: barber.name,
      email: `${barber.first.toLowerCase()}@heritagegrooming.example`,
      avatarUrl: barber.avatarSrc,
      active: true,
      sortOrder: index,
      createdAt: STABLE_CREATED_AT,
      serviceIds: [...ALL_SERVICE_IDS],
      isActive: true,
      ...shiftFor(barber, todayKey),
    })),
  };
}

/** Weekly rules for one barber (ISO weekday 1 = Monday), from the days on the site and the shop hours. */
export function getHeritageBarberRulesResponse(barberId: string) {
  const barber = HERITAGE_BARBERS.find((row) => row.id === barberId) ?? HERITAGE_BARBERS[0]!;
  return {
    rules: ALL_WEEKDAYS.map((dayOfWeek) => {
      const hours = HERITAGE_HOURS[siteWeekday(dayOfWeek)];
      const active = Boolean(hours) && barber.days.includes(siteWeekday(dayOfWeek));
      return {
        dayOfWeek,
        active,
        startTime: minutesToTimeString((hours?.[0] ?? 9) * 60),
        endTime: minutesToTimeString((hours?.[1] ?? 19) * 60),
      };
    }),
  };
}

export const heritageBarberServicesResponse = {
  serviceIds: [...ALL_SERVICE_IDS],
};

export function getHeritageTeamResponse(now = new Date()) {
  const barbers = getHeritageBarbersResponse(now).barbers;
  const cards: TeamCardDto[] = barbers.map((barber, index) => {
    // Arthur opened the shop; Rafi runs the floor with him.
    const role = index === 0 ? 'OWNER' : index === 2 ? 'MANAGER' : 'BARBER';
    return {
      kind: 'member',
      id: `hg-member-${barber.id}`,
      role,
      name: barber.name,
      email: barber.email,
      cardStatus: 'active',
      bookable: true,
      barberId: barber.id,
      avatarUrl: barber.avatarUrl,
      createdAt: STABLE_CREATED_AT,
      barber: {
        id: barber.id,
        name: barber.name,
        isActive: Boolean(barber.isActive),
        avatarUrl: barber.avatarUrl,
        sortOrder: barber.sortOrder,
        serviceIds: barber.serviceIds,
        todayLabel: barber.todayLabel,
        todayIsOnShift: barber.todayIsOnShift,
        todayShiftWindow: barber.todayShiftWindow,
      },
      canManageOnlineBookings: true,
      canSetUpOnlineBookings: false,
      ...emptyInvitationFields(),
    };
  });

  return {
    ok: true as const,
    actorRole: 'OWNER' as const,
    cards,
  };
}

const CATEGORY_ORDER = HERITAGE_SERVICE_CATEGORIES.map((category) => category.name);

export const heritageServicesResponse = {
  services: HERITAGE_SERVICES.map((service) => ({
    id: service.id,
    name: service.name,
    description: service.desc,
    pricePence: service.pricePence,
    durationMinutes: service.mins,
    bufferMinutes: 0,
    displayOrder: service.displayOrder,
    category: service.category,
    featured: service.featured,
    isActive: true,
    barberServices: HERITAGE_BARBERS.map((barber) => ({
      barber: { id: barber.id, name: barber.name, active: true },
    })),
  })),
  categories: [...CATEGORY_ORDER],
};

export const heritageServiceCategoriesResponse = {
  categories: [...CATEGORY_ORDER],
};

export const heritageShopProductsResponse = {
  products: HERITAGE_PRODUCTS.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    pricePence: product.pricePence,
    imageUrl: product.imageSrc,
    active: true,
    featured: product.featured,
    category: product.category,
    sortOrder: product.sortOrder,
    updatedAt: STABLE_CREATED_AT,
  })),
};

export const heritageSessionResponse = { ok: true };
export const heritageTimeblocksResponse = { timeBlocks: [] };
