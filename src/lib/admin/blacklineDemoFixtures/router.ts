import {
  blacklineBarberServicesResponse,
  blacklineServiceCategoriesResponse,
  blacklineServicesResponse,
  blacklineSessionResponse,
  blacklineShopProductsResponse,
  blacklineTimeblocksResponse,
  getBlacklineBarberRulesResponse,
  getBlacklineBarbersResponse,
  getBlacklineTeamResponse,
} from './catalog';
import {
  createBlacklineClientNoteFromRequest,
  getBlacklineClientDetailResponse,
  getBlacklineClientNotesResponse,
  getBlacklineClientsResponse,
  toggleBlacklineClientNoteLike,
} from './clients';
import { getBlacklineReportsResponse } from './reports';
import {
  getBlacklineBookingsHistoryResponse,
  getBlacklineBookingsResponse,
  getBlacklineBookingsStatsResponse,
} from './schedule';
import {
  getBlacklineShopOrderDetail,
  getBlacklineShopOrdersList,
  getBlacklineShopProductDetail,
  getBlacklineShopSalesResponse,
} from './shop';

type FixtureResult = { status: number; body: unknown };

const API_PREFIX = '/api/demo/admin';

export async function resolveBlacklineDemoFixture(
  pathname: string,
  searchParams: URLSearchParams,
  method = 'GET',
  request?: Request,
): Promise<FixtureResult | null> {
  const normalized = pathname.replace(/\/$/, '');
  if (!normalized.startsWith(API_PREFIX)) return null;
  const subPath = normalized.slice(API_PREFIX.length).replace(/^\//, '');

  if (subPath === 'session' || subPath === '') {
    return { status: 200, body: blacklineSessionResponse };
  }
  if (subPath === 'team') {
    return { status: 200, body: getBlacklineTeamResponse() };
  }
  if (subPath === 'bookings') {
    if (searchParams.get('view') === 'history') {
      return { status: 200, body: getBlacklineBookingsHistoryResponse(searchParams) };
    }
    if (searchParams.get('view') === 'stats') {
      return { status: 200, body: getBlacklineBookingsStatsResponse(searchParams) };
    }
    return { status: 200, body: getBlacklineBookingsResponse(searchParams) };
  }
  if (subPath === 'barbers') {
    return { status: 200, body: getBlacklineBarbersResponse() };
  }
  if (/^barbers\/[^/]+\/rules$/.test(subPath)) {
    return { status: 200, body: getBlacklineBarberRulesResponse() };
  }
  if (/^barbers\/[^/]+\/services$/.test(subPath)) {
    return { status: 200, body: blacklineBarberServicesResponse };
  }
  if (subPath === 'services') {
    return { status: 200, body: blacklineServicesResponse };
  }
  if (subPath === 'service-categories') {
    return { status: 200, body: blacklineServiceCategoriesResponse };
  }
  if (subPath === 'clients') {
    return { status: 200, body: getBlacklineClientsResponse() };
  }

  const clientDetailMatch = subPath.match(/^clients\/([^/]+)$/);
  if (clientDetailMatch) {
    const detail = getBlacklineClientDetailResponse(clientDetailMatch[1]!);
    if (!detail) return { status: 404, body: { error: 'Client not found.' } };
    return { status: 200, body: detail };
  }

  const clientNotesMatch = subPath.match(/^clients\/([^/]+)\/notes$/);
  if (clientNotesMatch && method === 'GET') {
    const detail = getBlacklineClientDetailResponse(clientNotesMatch[1]!);
    if (!detail) return { status: 404, body: { error: 'Client not found.' } };
    return { status: 200, body: getBlacklineClientNotesResponse(clientNotesMatch[1]!) };
  }
  if (clientNotesMatch && method === 'POST' && request) {
    const detail = getBlacklineClientDetailResponse(clientNotesMatch[1]!);
    if (!detail) return { status: 404, body: { error: 'Client not found.' } };
    try {
      const result = await createBlacklineClientNoteFromRequest(clientNotesMatch[1]!, request);
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
    const detail = getBlacklineClientDetailResponse(clientNoteLikeMatch[1]!);
    if (!detail) return { status: 404, body: { error: 'Client not found.' } };
    const result = toggleBlacklineClientNoteLike(clientNoteLikeMatch[1]!, clientNoteLikeMatch[2]!);
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
      return { status: 200, body: getBlacklineReportsResponse('custom', fromParam, toParam) };
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
    return { status: 200, body: getBlacklineReportsResponse(range) };
  }

  if (subPath === 'timeblocks') {
    return { status: 200, body: blacklineTimeblocksResponse };
  }
  if (subPath === 'shop/products') {
    return { status: 200, body: blacklineShopProductsResponse };
  }
  const shopProductMatch = subPath.match(/^shop\/products\/([^/]+)$/);
  if (shopProductMatch) {
    const detail = getBlacklineShopProductDetail(shopProductMatch[1]!);
    if (!detail) return { status: 404, body: { error: 'Product not found.' } };
    return { status: 200, body: detail };
  }
  if (subPath === 'shop/orders') {
    return { status: 200, body: getBlacklineShopOrdersList() };
  }
  const shopOrderMatch = subPath.match(/^shop\/orders\/([^/]+)$/);
  if (shopOrderMatch) {
    const detail = getBlacklineShopOrderDetail(shopOrderMatch[1]!);
    if (!detail) return { status: 404, body: { error: 'Order not found.' } };
    return { status: 200, body: detail };
  }
  if (subPath === 'shop/sales') {
    return { status: 200, body: getBlacklineShopSalesResponse(searchParams) };
  }

  return null;
}
