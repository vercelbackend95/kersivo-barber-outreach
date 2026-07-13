import { getSharedDemoDayBookings } from './daySchedule';

export function getDemoBookingsResponse() {
  return {
    bookings: getSharedDemoDayBookings(),
  };
}

export const demoTimeblocksResponse = {
  timeBlocks: [],
};

export function getDemoBookingsHistoryResponse() {
  const bookings = getDemoBookingsResponse().bookings.map((b) => ({
    ...b,
    startAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    endAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
  }));
  return {
    bookings,
    hasMore: false,
    cursor: null,
  };
}
