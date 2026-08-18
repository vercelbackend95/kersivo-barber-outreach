import { emptyInvitationFields, type TeamCardDto } from '@/lib/admin/teamCards';
import { minutesToTimeString } from '@/lib/admin/timeStrings';
import { ALL_WEEKDAYS } from '@/lib/booking/weekdays';
import { BOOKING_SERVICE_CATEGORY_ORDER } from '@/lib/booking/groupServicesByCategory';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { DEMO_PRODUCTS } from '@/lib/demo/products';
import { DEMO_SERVICES } from '@/lib/demo/services';
import { DEMO_SHOP_NAME } from '@/lib/demo/site';
import { SATURDAY_CLOSE_MINUTE, WEEKDAY_CLOSE_MINUTE, WEEKDAY_OPEN_MINUTE, blacklineDayKey, londonWeekdayMon1 } from './time';

const STABLE_CREATED_AT = '2026-01-12T09:00:00.000Z';

export const BLACKLINE_SHOP_DISPLAY_NAME = DEMO_SHOP_NAME;

export type BlacklinePerson = {
  id: string;
  fullName: string;
  email: string;
};

/** Diverse fictional clients — not recycled across the whole ledger. */
export const BLACKLINE_PEOPLE: readonly BlacklinePerson[] = [
  { id: 'bl-client-theo', fullName: 'Theo Hartley', email: 'theo.hartley@example.com' },
  { id: 'bl-client-priya', fullName: 'Priya Shah', email: 'priya.shah@example.com' },
  { id: 'bl-client-callum', fullName: 'Callum O\'Neal', email: 'callum.oneal@example.com' },
  { id: 'bl-client-amira', fullName: 'Amira Khan', email: 'amira.khan@example.com' },
  { id: 'bl-client-jonah', fullName: 'Jonah Blake', email: 'jonah.blake@example.com' },
  { id: 'bl-client-elena', fullName: 'Elena Rossi', email: 'elena.rossi@example.com' },
  { id: 'bl-client-malik', fullName: 'Malik Thompson', email: 'malik.thompson@example.com' },
  { id: 'bl-client-sofia', fullName: 'Sofia Nowak', email: 'sofia.nowak@example.com' },
  { id: 'bl-client-rhys', fullName: 'Rhys Patel', email: 'rhys.patel@example.com' },
  { id: 'bl-client-hannah', fullName: 'Hannah Quinn', email: 'hannah.quinn@example.com' },
  { id: 'bl-client-luca', fullName: 'Luca Moretti', email: 'luca.moretti@example.com' },
  { id: 'bl-client-aisha', fullName: 'Aisha Rahman', email: 'aisha.rahman@example.com' },
  { id: 'bl-client-owen', fullName: 'Owen Fraser', email: 'owen.fraser@example.com' },
  { id: 'bl-client-maya', fullName: 'Maya Chen', email: 'maya.chen@example.com' },
  { id: 'bl-client-daniel', fullName: 'Daniel Okonkwo', email: 'daniel.okonkwo@example.com' },
  { id: 'bl-client-isla', fullName: 'Isla McKenzie', email: 'isla.mckenzie@example.com' },
  { id: 'bl-client-yusuf', fullName: 'Yusuf Ali', email: 'yusuf.ali@example.com' },
  { id: 'bl-client-grace', fullName: 'Grace Whitaker', email: 'grace.whitaker@example.com' },
  { id: 'bl-client-felix', fullName: 'Felix Navarro', email: 'felix.navarro@example.com' },
  { id: 'bl-client-chloe', fullName: 'Chloe Adjei', email: 'chloe.adjei@example.com' },
  { id: 'bl-client-sebastian', fullName: 'Sebastian Crowe', email: 'sebastian.crowe@example.com' },
  { id: 'bl-client-leah', fullName: 'Leah Okafor', email: 'leah.okafor@example.com' },
  { id: 'bl-client-nina', fullName: 'Nina Petrov', email: 'nina.petrov@example.com' },
  { id: 'bl-client-arthur', fullName: 'Arthur Bennett', email: 'arthur.bennett@example.com' },
];

const ALL_SERVICE_IDS = DEMO_SERVICES.map((service) => service.id);

function shiftForWeekday(weekday: number) {
  if (weekday === 7) {
    return {
      todayLabel: 'Off today',
      todayIsOnShift: false,
      todayShiftWindow: {
        startMinutes: WEEKDAY_OPEN_MINUTE,
        endMinutes: WEEKDAY_CLOSE_MINUTE,
        breakStartMin: null,
        breakEndMin: null,
      },
    };
  }
  const end = weekday === 6 ? SATURDAY_CLOSE_MINUTE : WEEKDAY_CLOSE_MINUTE;
  return {
    todayLabel: `On shift · 09:00–${end === SATURDAY_CLOSE_MINUTE ? '17:00' : '19:00'}`,
    todayIsOnShift: true,
    todayShiftWindow: {
      startMinutes: WEEKDAY_OPEN_MINUTE,
      endMinutes: end,
      breakStartMin: null,
      breakEndMin: null,
    },
  };
}

export function getBlacklineBarbersResponse(now = new Date()) {
  const weekday = londonWeekdayMon1(blacklineDayKey(now));
  const shift = shiftForWeekday(weekday);
  return {
    barbers: DEMO_BARBERS.map((barber, index) => ({
      id: barber.id,
      name: barber.name,
      email: `${barber.slug.replace('-', '.')}@example.com`,
      avatarUrl: barber.image.src,
      active: true,
      sortOrder: index,
      createdAt: STABLE_CREATED_AT,
      serviceIds: [...ALL_SERVICE_IDS],
      isActive: true,
      ...shift,
    })),
  };
}

export function getBlacklineBarberRulesResponse() {
  return {
    rules: ALL_WEEKDAYS.map((dayOfWeek) => {
      const active = dayOfWeek !== 7;
      const endMin = dayOfWeek === 6 ? SATURDAY_CLOSE_MINUTE : WEEKDAY_CLOSE_MINUTE;
      return {
        dayOfWeek,
        active,
        startTime: minutesToTimeString(active ? WEEKDAY_OPEN_MINUTE : 10 * 60),
        endTime: minutesToTimeString(active ? endMin : 18 * 60),
      };
    }),
  };
}

export const blacklineBarberServicesResponse = {
  serviceIds: [...ALL_SERVICE_IDS],
};

export function getBlacklineTeamResponse(now = new Date()) {
  const barbers = getBlacklineBarbersResponse(now).barbers;
  const cards: TeamCardDto[] = barbers.map((barber, index) => {
    const role = index === 0 ? 'OWNER' : index === 1 ? 'MANAGER' : 'BARBER';
    return {
      kind: 'member',
      id: `bl-member-${barber.id}`,
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

export const blacklineServicesResponse = {
  services: DEMO_SERVICES.map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    pricePence: service.pricePence,
    durationMinutes: service.durationMinutes,
    bufferMinutes: 5,
    displayOrder: service.displayOrder,
    category: service.category,
    isActive: true,
    barberServices: DEMO_BARBERS.map((barber) => ({
      barber: { id: barber.id, name: barber.name, active: true },
    })),
  })),
  categories: [...BOOKING_SERVICE_CATEGORY_ORDER],
};

export const blacklineServiceCategoriesResponse = {
  categories: [...BOOKING_SERVICE_CATEGORY_ORDER],
};

export const blacklineShopProductsResponse = {
  products: DEMO_PRODUCTS.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    pricePence: product.pricePence,
    imageUrl: product.image.src,
    active: product.active,
    featured: product.featured,
    category: product.category,
    sortOrder: product.sortOrder,
    updatedAt: STABLE_CREATED_AT,
  })),
};

export const blacklineSessionResponse = { ok: true };
export const blacklineTimeblocksResponse = { timeBlocks: [] };
