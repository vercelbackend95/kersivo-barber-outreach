/**
 * Booking deep links: `/book/{slug}?service=<id>&barber=<id>` (docs/site-data-contract.md).
 *
 * The single rule for which preselection a booking flow accepts. Used by BookingFlow itself and by
 * the server pages that read the query string, so an id is validated the same way everywhere.
 * Anything that does not match is dropped silently: no error, and no hint whether the id exists.
 */

/** The only query parameters a booking deep link supports. */
export const BOOKING_SERVICE_PARAM = 'service';
export const BOOKING_BARBER_PARAM = 'barber';

/** Ids are cuid-like; anything longer or with other characters is never a real id. */
const ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

type ServiceLike = { id: string };
type BarberLike = { id: string; serviceIds?: string[] };

export function barberOffersService(barber: BarberLike, serviceId: string): boolean {
  if (!barber.serviceIds || barber.serviceIds.length === 0) return true;
  return barber.serviceIds.includes(serviceId);
}

export function resolveInitialServiceId(services: ServiceLike[], initialServiceId?: string | null): string {
  if (!initialServiceId) return '';
  return services.some((service) => service.id === initialServiceId) ? initialServiceId : '';
}

export function resolveInitialBarberId(
  barbers: BarberLike[],
  initialBarberId?: string | null,
  serviceId = '',
): string {
  if (!initialBarberId) return '';
  const barber = barbers.find((item) => item.id === initialBarberId);
  if (!barber) return '';
  if (serviceId && !barberOffersService(barber, serviceId)) return '';
  return barber.id;
}

function readIdParam(params: URLSearchParams, name: string): string | null {
  const value = params.get(name)?.trim() ?? '';
  return ID_SHAPE.test(value) ? value : null;
}

/**
 * Preselection for a public booking page from its query string.
 *
 * - `services`: the shop's bookable (active) services.
 * - `barbers`: the shop's active barbers; only those shown on the website (`showOnWebsite`) can be
 *   preselected, matching `SiteData.team`.
 * A barber who does not perform the preselected service is dropped (the service stays).
 */
export function resolveBookingPreselection(
  search: URLSearchParams | string,
  catalogue: {
    services: ServiceLike[];
    barbers: Array<BarberLike & { showOnWebsite?: boolean }>;
  },
): { initialServiceId?: string; initialBarberId?: string } {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const serviceId = resolveInitialServiceId(catalogue.services, readIdParam(params, BOOKING_SERVICE_PARAM));
  const websiteBarbers = catalogue.barbers.filter((barber) => barber.showOnWebsite !== false);
  const barberId = resolveInitialBarberId(websiteBarbers, readIdParam(params, BOOKING_BARBER_PARAM), serviceId);
  return {
    ...(serviceId ? { initialServiceId: serviceId } : {}),
    ...(barberId ? { initialBarberId: barberId } : {}),
  };
}

/**
 * `baseUrl` with a booking deep-link parameter, built with URLSearchParams (keeps any existing
 * query). Null in, null out.
 */
export function bookingDeepLink(
  baseUrl: string | null,
  params: { service?: string; barber?: string },
): string | null {
  if (!baseUrl) return null;
  const url = new URL(baseUrl);
  if (params.service) url.searchParams.set(BOOKING_SERVICE_PARAM, params.service);
  if (params.barber) url.searchParams.set(BOOKING_BARBER_PARAM, params.barber);
  return url.toString();
}
