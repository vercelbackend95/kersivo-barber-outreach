import {
  demoBarberRulesResponse,
  demoBarberServicesResponse,
  demoBarbersResponse,
  demoClientsResponse,
  demoServiceCategoriesResponse,
  demoServicesResponse,
  demoSessionResponse,
  demoTimeblocksResponse,
  getDemoBookingsHistoryResponse,
  getDemoBookingsResponse,
  getDemoClientDetailResponse,
  getDemoReportsResponse,
  getDemoShopOrderDetail,
  getDemoShopProductDetail,
  demoShopOrdersResponse,
  demoShopProductsResponse,
  getDemoShopSalesResponse,
} from './demoFixtures';

type DemoFixtureResult = { status: number; body: unknown };

export function resolveDemoFixture(pathname: string, searchParams: URLSearchParams): DemoFixtureResult | null {
  const normalized = pathname.replace(/\/$/, '');
  const adminDemoPrefix = '/api/admin-demo';
  if (!normalized.startsWith(adminDemoPrefix)) return null;

  const subPath = normalized.slice(adminDemoPrefix.length).replace(/^\//, '');

  if (subPath === 'session' || subPath === '') {
    return { status: 200, body: demoSessionResponse };
  }

  if (subPath === 'bookings') {
    if (searchParams.get('view') === 'history') {
      return { status: 200, body: getDemoBookingsHistoryResponse() };
    }
    if (searchParams.get('view') === 'stats') {
      return { status: 200, body: { totalBookingsServed: 248 } };
    }
    return { status: 200, body: getDemoBookingsResponse() };
  }

  if (subPath === 'barbers') {
    return { status: 200, body: demoBarbersResponse };
  }

  const barberRulesMatch = subPath.match(/^barbers\/([^/]+)\/rules$/);
  if (barberRulesMatch) {
    return { status: 200, body: demoBarberRulesResponse };
  }

  const barberServicesMatch = subPath.match(/^barbers\/([^/]+)\/services$/);
  if (barberServicesMatch) {
    return { status: 200, body: demoBarberServicesResponse };
  }

  if (subPath === 'services') {
    return { status: 200, body: demoServicesResponse };
  }

  if (subPath === 'service-categories') {
    return { status: 200, body: demoServiceCategoriesResponse };
  }

  if (subPath === 'clients') {
    return { status: 200, body: demoClientsResponse };
  }

  const clientDetailMatch = subPath.match(/^clients\/([^/]+)$/);
  if (clientDetailMatch) {
    const detail = getDemoClientDetailResponse(clientDetailMatch[1]);
    if (!detail) return { status: 404, body: { error: 'Client not found.' } };
    return { status: 200, body: detail };
  }

  if (subPath === 'reports') {
    const rangeParam = searchParams.get('range')?.trim();
    const fromParam = searchParams.get('from')?.trim();
    const toParam = searchParams.get('to')?.trim();

    if (rangeParam === 'custom' || (fromParam && toParam)) {
      if (!fromParam || !toParam) {
        return { status: 400, body: { error: 'Custom range requires from and to (YYYY-MM-DD).' } };
      }
      return { status: 200, body: getDemoReportsResponse('custom', fromParam, toParam) };
    }

    const range =
      rangeParam === 'week'
      || rangeParam === '7d'
      || rangeParam === '30d'
      || rangeParam === '90d'
      || rangeParam === 'month'
        ? rangeParam
        : '7d';
    return { status: 200, body: getDemoReportsResponse(range) };
  }

  if (subPath === 'timeblocks') {
    return { status: 200, body: demoTimeblocksResponse };
  }

  if (subPath === 'shop/products') {
    return { status: 200, body: demoShopProductsResponse };
  }

  const shopProductMatch = subPath.match(/^shop\/products\/([^/]+)$/);
  if (shopProductMatch) {
    const detail = getDemoShopProductDetail(shopProductMatch[1]);
    if (!detail) return { status: 404, body: { error: 'Product not found.' } };
    return { status: 200, body: detail };
  }

  if (subPath === 'shop/orders') {
    return { status: 200, body: demoShopOrdersResponse };
  }

  const shopOrderMatch = subPath.match(/^shop\/orders\/([^/]+)$/);
  if (shopOrderMatch) {
    const detail = getDemoShopOrderDetail(shopOrderMatch[1]);
    if (!detail) return { status: 404, body: { error: 'Order not found.' } };
    return { status: 200, body: detail };
  }

  if (subPath === 'shop/sales') {
    return { status: 200, body: getDemoShopSalesResponse(searchParams) };
  }

  return null;
}
