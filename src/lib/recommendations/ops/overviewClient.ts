/**
 * Browser-safe Smart Retail ops overview DTOs and presentation helpers.
 * No Prisma, auth, or server read-model imports.
 */

export type OpsHealthSeverity = 'OK' | 'INFO' | 'WARNING' | 'CRITICAL';

export type OpsHealthCode =
  | 'NOT_RETAIL_ELIGIBLE'
  | 'INSUFFICIENT_CATALOGUE'
  | 'STATE_MISSING'
  | 'PENDING'
  | 'PENDING_OVERDUE'
  | 'PROCESSING'
  | 'PROCESSING_LOCK_EXPIRED'
  | 'FAILED_RETRYING'
  | 'FAILED_EXHAUSTED'
  | 'STALE'
  | 'PUBLISHED_SET_MISSING'
  | 'PUBLISHED_SET_INVALID'
  | 'READY_NO_RAILS'
  | 'READY_PARTIAL'
  | 'HEALTHY';

export type OpsJobStatus = 'IDLE' | 'PENDING' | 'PROCESSING' | 'FAILED' | string;

export type OpsShopOverview = {
  shop: {
    id: string;
    name: string;
    townCity: string | null;
    createdAt: string;
  };
  retail: {
    paid: boolean;
    retailEnabled: boolean;
    connectAccountPresent: boolean;
    connectChargesEnabled: boolean;
    eligible: boolean;
    reason: string;
  };
  catalogue: {
    activeServiceCount: number;
    activeProductCount: number;
  };
  state: {
    exists: boolean;
    catalogueVersion: number | null;
    publishedCatalogueVersion: number | null;
    pendingCatalogueVersion: number | null;
    rebuildAfter: string | null;
    jobStatus: OpsJobStatus | null;
    processingCatalogueVersion: number | null;
    processingLockExpiresAt: string | null;
    attemptCount: number | null;
    nextAttemptAt: string | null;
    lastErrorCode: string | null;
    lastErrorAt: string | null;
    taxonomyVersion: string | null;
    updatedAt: string | null;
  };
  publishedSet: {
    id: string;
    catalogueVersion: number;
    taxonomyVersion: string;
    schemaVersion: string;
    status: string;
    modelId: string | null;
    rerankModelId: string | null;
    promptVersion: string;
    buildStartedAt: string;
    buildFinishedAt: string | null;
    errorCode: string | null;
  } | null;
  stats: Record<string, unknown> | null;
  coverage: {
    activeServices: number;
    servicesWithStoredItems: number;
    servicesWithReadableRail: number;
    totalStoredItems: number;
    totalReadableActiveItems: number;
  };
  health: {
    code: OpsHealthCode | string;
    severity: OpsHealthSeverity | string;
    reasonCodes: string[];
    facts: Record<string, unknown>;
    generatedAt: string;
  };
};

export type OpsOverviewApiSuccess = {
  ok: true;
  generatedAt: string;
  data: { shops: OpsShopOverview[] };
  nextCursor: string | null;
};

export type OpsOverviewApiError = {
  ok: false;
  error: { code: string };
};

export type OpsClientFilter =
  | 'all'
  | 'needs_attention'
  | 'healthy'
  | 'building'
  | 'no_rails'
  | 'not_eligible';

export const HEALTH_CODE_LABELS: Record<OpsHealthCode, string> = {
  HEALTHY: 'Healthy',
  PENDING: 'Build queued',
  PENDING_OVERDUE: 'Build overdue',
  PROCESSING: 'Building',
  PROCESSING_LOCK_EXPIRED: 'Worker lock expired',
  FAILED_RETRYING: 'Build failed — retry scheduled',
  FAILED_EXHAUSTED: 'Build failed — retries exhausted',
  STALE: 'Published recommendations are outdated',
  READY_NO_RAILS: 'No customer-visible rails',
  READY_PARTIAL: 'Partial service coverage',
  NOT_RETAIL_ELIGIBLE: 'Retail not eligible',
  INSUFFICIENT_CATALOGUE: 'Catalogue too small',
  STATE_MISSING: 'Recommendation state missing',
  PUBLISHED_SET_MISSING: 'Published set missing',
  PUBLISHED_SET_INVALID: 'Published set invalid',
};

export const SEVERITY_LABELS: Record<OpsHealthSeverity, string> = {
  OK: 'Healthy',
  INFO: 'Info',
  WARNING: 'Warning',
  CRITICAL: 'Critical',
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  IDLE: 'Idle',
  PENDING: 'Queued',
  PROCESSING: 'Building',
  FAILED: 'Failed',
};

const REASON_LABELS: Record<string, string> = {
  PENDING_OVERDUE: 'Build overdue',
  pending_missing_rebuild_after: 'Missing rebuild schedule',
  retry_overdue: 'Retry overdue',
  retry_scheduled: 'Retry scheduled',
  retry_exhausted: 'Retries exhausted',
  no_service_rail: 'No service rails',
  partial_service_rails: 'Partial rails',
  all_service_rails_ok: 'All rails OK',
  published_behind_catalogue: 'Published behind catalogue',
  taxonomy_mismatch: 'Taxonomy mismatch',
  schema_mismatch: 'Schema mismatch',
  prompt_mismatch: 'Prompt mismatch',
  model_mismatch: 'Model mismatch',
  STATE_MISSING: 'State missing',
  lock_expired: 'Lock expired',
  lock_missing: 'Lock missing',
  retail_unpaid_shop: 'Shop unpaid',
  retail_connect_missing: 'Connect missing',
  retail_connect_not_ready: 'Connect not ready',
  retail_retail_disabled: 'Retail disabled',
  retail_demo_shop: 'Demo shop',
  catalogue_no_active_services: 'No active services',
  catalogue_lt_two_active_products: 'Fewer than two products',
};

export function healthCodeLabel(code: string): string {
  if (code in HEALTH_CODE_LABELS) {
    return HEALTH_CODE_LABELS[code as OpsHealthCode];
  }
  return code.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function severityLabel(severity: string): string {
  if (severity in SEVERITY_LABELS) {
    return SEVERITY_LABELS[severity as OpsHealthSeverity];
  }
  return severity;
}

export function severityClass(severity: string): string {
  switch (severity) {
    case 'OK':
      return 'ops-sev--ok';
    case 'INFO':
      return 'ops-sev--info';
    case 'WARNING':
      return 'ops-sev--warning';
    case 'CRITICAL':
      return 'ops-sev--critical';
    default:
      return 'ops-sev--info';
  }
}

export function jobStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return JOB_STATUS_LABELS[status] ?? status;
}

export function reasonShortLabel(reasonCodes: string[], healthCode?: string): string {
  const primary = healthCode ?? reasonCodes[0];
  const secondary = reasonCodes.find((code) => code !== primary);
  const pick = secondary ?? primary;
  if (!pick) return '—';
  if (pick in REASON_LABELS) return REASON_LABELS[pick];
  if (pick in HEALTH_CODE_LABELS) return HEALTH_CODE_LABELS[pick as OpsHealthCode];
  return pick.replace(/_/g, ' ');
}

export function reasonListLabels(reasonCodes: string[], healthCode?: string): string[] {
  return reasonCodes.map((code, index) => {
    if (index === 0 && healthCode && code === healthCode) {
      return healthCodeLabel(code);
    }
    if (code in REASON_LABELS) return REASON_LABELS[code];
    if (code in HEALTH_CODE_LABELS) return HEALTH_CODE_LABELS[code as OpsHealthCode];
    return code.replace(/_/g, ' ');
  });
}

export function retailEligibilityLabel(shop: OpsShopOverview): string {
  if (shop.retail.eligible) return 'Eligible';
  return 'Not eligible';
}

export type OpsPageSummary = {
  shopsOnPage: number;
  healthy: number;
  needsAttention: number;
  railsVisibleServices: number;
  activeServicesOnPage: number;
};

export function computePageSummary(shops: OpsShopOverview[]): OpsPageSummary {
  let healthy = 0;
  let needsAttention = 0;
  let railsVisibleServices = 0;
  let activeServicesOnPage = 0;
  for (const s of shops) {
    const sev = s.health.severity;
    if (sev === 'OK') healthy += 1;
    if (sev === 'WARNING' || sev === 'CRITICAL') needsAttention += 1;
    railsVisibleServices += s.coverage.servicesWithReadableRail;
    activeServicesOnPage += s.coverage.activeServices;
  }
  return {
    shopsOnPage: shops.length,
    healthy,
    needsAttention,
    railsVisibleServices,
    activeServicesOnPage,
  };
}

export function shopMatchesFilter(shop: OpsShopOverview, filter: OpsClientFilter): boolean {
  const code = shop.health.code;
  const sev = shop.health.severity;
  switch (filter) {
    case 'all':
      return true;
    case 'needs_attention':
      return sev === 'WARNING' || sev === 'CRITICAL';
    case 'healthy':
      return code === 'HEALTHY' || sev === 'OK';
    case 'building':
      return code === 'PENDING' || code === 'PENDING_OVERDUE' || code === 'PROCESSING';
    case 'no_rails':
      return code === 'READY_NO_RAILS' || shop.coverage.servicesWithReadableRail === 0;
    case 'not_eligible':
      return code === 'NOT_RETAIL_ELIGIBLE' || code === 'INSUFFICIENT_CATALOGUE';
    default:
      return true;
  }
}

export function filterShops(shops: OpsShopOverview[], filter: OpsClientFilter): OpsShopOverview[] {
  return shops.filter((s) => shopMatchesFilter(s, filter));
}

const FILTER_LABELS: Record<OpsClientFilter, string> = {
  all: 'All',
  needs_attention: 'Needs attention',
  healthy: 'Healthy',
  building: 'Building',
  no_rails: 'No rails',
  not_eligible: 'Not eligible',
};

export function filterLabel(filter: OpsClientFilter): string {
  return FILTER_LABELS[filter];
}

export const OPS_CLIENT_FILTERS: OpsClientFilter[] = [
  'all',
  'needs_attention',
  'healthy',
  'building',
  'no_rails',
  'not_eligible',
];

export function formatRelativeTime(iso: string | null | undefined, nowMs = Date.now()): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const deltaSec = Math.round((t - nowMs) / 1000);
  const abs = Math.abs(deltaSec);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 60) return rtf.format(deltaSec, 'second');
  const mins = Math.round(deltaSec / 60);
  if (Math.abs(mins) < 60) return rtf.format(mins, 'minute');
  const hours = Math.round(deltaSec / 3600);
  if (Math.abs(hours) < 48) return rtf.format(hours, 'hour');
  const days = Math.round(deltaSec / 86400);
  return rtf.format(days, 'day');
}

export function formatExactTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toISOString();
}

export function buildOverviewUrl(input: {
  q?: string;
  cursor?: string | null;
  limit?: number;
}): string {
  const params = new URLSearchParams();
  params.set('limit', String(input.limit ?? 100));
  const q = input.q?.trim();
  if (q) params.set('q', q);
  if (input.cursor) params.set('cursor', input.cursor);
  return `/api/ops/recommendations?${params.toString()}`;
}

export type OpsFetchErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'unconfigured'
  | 'invalid_query'
  | 'server'
  | 'network'
  | 'unknown';

export function classifyOpsFetchError(status: number | null, code?: string): OpsFetchErrorKind {
  if (status === null) return 'network';
  if (status === 401 || code === 'UNAUTHORIZED') return 'unauthorized';
  if (status === 403 || code === 'FORBIDDEN' || code === 'EMAIL_NOT_VERIFIED') return 'forbidden';
  if (status === 503 || code === 'OPS_ACCESS_NOT_CONFIGURED') return 'unconfigured';
  if (status === 400 || code === 'INVALID_QUERY') return 'invalid_query';
  if (status >= 500 || code === 'INTERNAL_ERROR') return 'server';
  return 'unknown';
}

export function userMessageForFetchError(kind: OpsFetchErrorKind): string {
  switch (kind) {
    case 'unauthorized':
      return 'Your session has expired. Sign in again to continue.';
    case 'forbidden':
      return 'You do not have access to the Smart Retail Control Room.';
    case 'unconfigured':
      return 'Operator access is not configured. Contact platform engineering.';
    case 'invalid_query':
      return 'That search could not be applied. Try a shorter query.';
    case 'server':
      return 'Something went wrong loading shops. Try refreshing.';
    case 'network':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Unable to load shops right now.';
  }
}
