const DEMO_SERVICE_PRICE_MAP_GBP: Record<string, number> = {
  'svc-haircut': 24,
  'svc-skin-fade': 27,
  'svc-beard-trim': 16,
  'svc-haircut-beard': 34,
  haircut: 24,
  'skin fade': 27,
  'beard trim': 16,
  'haircut + beard': 34,
  'haircut & beard': 34,
  'kids haircut': 18,
  'buzz cut': 15
};

export function normalizeServiceLookupKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function parsePriceTextToGbp(value?: string | null): number | null {
  if (!value) return null;
  const normalized = value.replace(',', '.');
  const match = normalized.match(/\d+(?:\.\d{1,2})?/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function getDemoServicePriceGbp(serviceId?: string | null, serviceName?: string | null): number | null {
  const idKey = normalizeServiceLookupKey(serviceId ?? '');
  if (idKey && Number.isFinite(DEMO_SERVICE_PRICE_MAP_GBP[idKey])) {
    return DEMO_SERVICE_PRICE_MAP_GBP[idKey] ?? null;
  }

  const nameKey = normalizeServiceLookupKey(serviceName ?? '');
  if (nameKey && Number.isFinite(DEMO_SERVICE_PRICE_MAP_GBP[nameKey])) {
    return DEMO_SERVICE_PRICE_MAP_GBP[nameKey] ?? null;
  }

  return null;
}
