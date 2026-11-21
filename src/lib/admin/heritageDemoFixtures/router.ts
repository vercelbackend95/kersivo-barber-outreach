import {
  getHeritageBarberRulesResponse,
  getHeritageBarbersResponse,
  getHeritageTeamResponse,
  heritageBarberServicesResponse,
  heritageServiceCategoriesResponse,
  heritageServicesResponse,
  heritageSessionResponse,
  heritageShopProductsResponse,
  heritageTimeblocksResponse,
} from './catalog';
import {
  createHeritageClientNoteFromRequest,
  getHeritageClientDetailResponse,
  getHeritageClientNotesResponse,
  getHeritageClientsResponse,
  toggleHeritageClientNoteLike,
} from './clients';
import { getHeritageReportsResponse } from './reports';
import {
  getHeritageBookingsHistoryResponse,
  getHeritageBookingsResponse,
  getHeritageBookingsStatsResponse,
} from './schedule';
import {
  getHeritageShopOrderDetail,
  getHeritageShopOrdersList,
  getHeritageShopProductDetail,
  getHeritageShopSalesResponse,
} from './shop';

/** Same contract as the CUTSTATE fixture router, for the Heritage Grooming demo dashboard. */
type FixtureResult = { status: number; body: unknown };

export type HeritageDemoFixtureOptions = {
  /** Fixed clock for every date-dependent fixture (hero showcase). Defaults to the real time. */
  now?: Date;
};

const API_PREFIX = '/api/demo/heritage/admin';

export async function resolveHeritageDemoFixture(
  pathname: string,
  searchParams: URLSearchParams,
  method = 'GET',
  request?: Request,
  options: HeritageDemoFixtureOptions = {},
): Promise<FixtureResult | null> {
  const { now } = options;
  const normalized = pathname.replace(/\/$/, '');
  if (!normalized.startsWith(API_PREFIX)) return null;
  const subPath = normalized.slice(API_PREFIX.length).replace(/^\//, '');

  if (subPath === 'session' || subPath === '') {
    return { status: 200, body: heritageSessionResponse };
  }
  if (subPath === 'team') {
    return { status: 200, body: getHeritageTeamResponse(now) };
  }
  if (subPath === 'bookings') {
    if (searchParams.get('view') === 'history') {
      return { status: 200, body: getHeritageBookingsHistoryResponse(searchParams, now) };
    }
    if (searchParams.get('view') === 'stats') {
      return { status: 200, body: getHeritageBookingsStatsResponse(searchParams, now) };
    }
    return { status: 200, body: getHeritageBookingsResponse(searchParams, now) };
  }
  if (subPath === 'barbers') {
    return { status: 200, body: getHeritageBarbersResponse(now) };
  }
  const barberRulesMatch = subPath.match(/^barbers\/([^/]+)\/rules$/);
  if (barberRulesMatch) {
    return { status: 200, body: getHeritageBarberRulesResponse(barberRulesMatch[1]!) };
  }
  if (/^barbers\/[^/]+\/services$/.test(subPath)) {
    return { status: 200, body: heritageBarberServicesResponse };
  }
  if (subPath === 'services') {
    return { status: 200, body: heritageServicesResponse };
  }
  if (subPath === 'service-categories') {
    return { status: 200, body: heritageServiceCategoriesResponse };
  }
  if (subPath === 'clients') {
    return { status: 200, body: getHeritageClientsResponse(now) };
  }

  const clientDetailMatch = subPath.match(/^clients\/([^/]+)$/);
  if (clientDetailMatch) {
    const detail = getHeritageClientDetailResponse(clientDetailMatch[1]!, now);
    if (!detail) return { status: 404, body: { error: 'Client not found.' } };
    return { status: 200, body: detail };
  }

  const clientNotesMatch = subPath.match(/^clients\/([^/]+)\/notes$/);
  if (clientNotesMatch && method === 'GET') {
    const detail = getHeritageClientDetailResponse(clientNotesMatch[1]!, now);
    if (!detail) return { status: 404, body: { error: 'Client not found.' } };
    return { status: 200, body: getHeritageClientNotesResponse(clientNotesMatch[1]!) };
  }
  if (clientNotesMatch && method === 'POST' && request) {
    const detail = getHeritageClientDetailResponse(clientNotesMatch[1]!, now);
    if (!detail) return { status: 404, body: { error: 'Client not found.' } };
    try {
      const result = await createHeritageClientNoteFromRequest(clientNotesMatch[1]!, request, now);
      if (!result) return { status: 404, body: { error: 'Client not found.' } };
      return { status: 201, body: result };
    } catch (error) {
      return {
        status: 400,
        body: { error: error instanceof Error ? error.message : 'Could not post note.' },
      };
    }
  }

  const clientNoteLikeMatch = subPath.match(/^clients\/([^/]+)\/notes\/([^/]+)\/like$/);
  if (clientNoteLikeMatch && method === 'POST') {
    const detail = getHeritageClientDetailResponse(clientNoteLikeMatch[1]!, now);
    if (!detail) return { status: 404, body: { error: 'Client not found.' } };
    const result = toggleHeritageClientNoteLike(clientNoteLikeMatch[1]!, clientNoteLikeMatch[2]!);
    if (!result) return { status: 404, body: { error: 'Note not found.' } };
    return { status: 200, body: result };
  }

  if (subPath === 'reports') {
    const rangeParam = searchParams.get('range')?.trim();
    const fromParam = searchParams.get('from')?.trim();
    const toParam = searchParams.get('to')?.trim();
    if (rangeParam === 'custom' || (fromParam && toParam)) {
      if (!fromParam || !toParam) {
        return { status: 400, body: { error: 'Custom range requires from and to (YYYY-MM-DD).' } };
      }
      return { status: 200, body: getHeritageReportsResponse('custom', fromParam, toParam, now) };
    }
    const range =
      rangeParam === '1d'
      || rangeParam === 'week'
      || rangeParam === '7d'
      || rangeParam === '30d'
      || rangeParam === '90d'
      || rangeParam === '1y'
      || rangeParam === 'month'
        ? rangeParam
        : '7d';
    return { status: 200, body: getHeritageReportsResponse(range, undefined, undefined, now) };
  }

  if (subPath === 'timeblocks') {
    return { status: 200, body: heritageTimeblocksResponse };
  }
  if (subPath === 'shop/products') {
    return { status: 200, body: heritageShopProductsResponse };
  }
  const shopProductMatch = subPath.match(/^shop\/products\/([^/]+)$/);
  if (shopProductMatch) {
    const detail = getHeritageShopProductDetail(shopProductMatch[1]!);
    if (!detail) return { status: 404, body: { error: 'Product not found.' } };
    return { status: 200, body: detail };
  }
  if (subPath === 'shop/orders') {
    return { status: 200, body: getHeritageShopOrdersList(now) };
  }
  const shopOrderMatch = subPath.match(/^shop\/orders\/([^/]+)$/);
  if (shopOrderMatch) {
    const detail = getHeritageShopOrderDetail(shopOrderMatch[1]!, now);
    if (!detail) return { status: 404, body: { error: 'Order not found.' } };
    return { status: 200, body: detail };
  }
  if (subPath === 'shop/sales') {
    return { status: 200, body: getHeritageShopSalesResponse(searchParams, now) };
  }

  return null;
}
