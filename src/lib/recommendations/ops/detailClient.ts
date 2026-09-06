/**
 * Browser-safe Smart Retail ops shop detail DTOs and helpers.
 * No Prisma, auth, readModel, or OpenAI imports.
 */

import {
  classifyOpsFetchError,
  formatExactTime,
  formatRelativeTime,
  healthCodeLabel,
  jobStatusLabel,
  reasonListLabels,
  reasonShortLabel,
  severityClass,
  severityLabel,
  userMessageForFetchError,
  type OpsFetchErrorKind,
  type OpsShopOverview,
} from './overviewClient';

export type OpsDetailRecommendation = {
  productId: string;
  productName: string;
  productCategory: string;
  productActive: boolean;
  rank: number;
  deterministicScore: number;
  rerankPosition: number | null;
  reasonCodes: string[];
  confidenceGate: number | boolean | null;
  retainedByPublicReader: boolean;
};

export type OpsDetailService = {
  id: string;
  name: string;
  category: string;
  profilePresent: boolean;
  profileConfidence: number | null;
  taxonomyVersion: string | null;
  schemaVersion: string | null;
  promptVersion: string | null;
  modelId: string | null;
  classifiedAt: string | null;
  profileMetadataCurrent: boolean;
  storedRecommendationCount: number;
  readableActiveRecommendationCount: number;
  railWillRender: boolean;
  recommendations: OpsDetailRecommendation[];
};

export type OpsDetailProduct = {
  id: string;
  name: string;
  category: string;
  active: boolean;
  profilePresent: boolean;
  profileConfidence: number | null;
  taxonomyVersion: string | null;
  schemaVersion: string | null;
  promptVersion: string | null;
  modelId: string | null;
  classifiedAt: string | null;
  profileMetadataCurrent: boolean;
};

export type OpsDetailRecentSet = {
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
  stats: OpsDetailStats | null;
};

export type OpsDetailStats = {
  serviceCount: number;
  productCount: number;
  itemCount: number;
  rerankEligibleServiceCount: number;
  rerankAttemptedServiceCount: number;
  rerankAppliedServiceCount: number;
  rerankFallbackServiceCount: number;
  rerankSkippedInsufficientCandidatesCount: number;
  rerankFallbackReasonCounts: Record<string, number>;
};

export type OpsShopDetail = {
  overview: OpsShopOverview;
  recentSets: OpsDetailRecentSet[];
  services: OpsDetailService[];
  products: OpsDetailProduct[];
  profileSummary: {
    activeServicesTotal: number;
    activeServicesWithCurrentProfile: number;
    activeProductsTotal: number;
    activeProductsWithCurrentProfile: number;
  };
  returned: { services: number; products: number };
  truncation: { services: boolean; products: boolean };
};

export type OpsDetailApiSuccess = {
  ok: true;
  generatedAt: string;
  data: OpsShopDetail;
  nextCursor: null;
};

export type OpsDetailApiError = {
  ok: false;
  error: { code: string };
};

export type OpsDetailTab = 'overview' | 'services' | 'products' | 'builds';

export type OpsServiceFilter = 'all' | 'rail_visible' | 'no_rail' | 'profile_issue';
export type OpsProductFilter = 'all' | 'current' | 'missing' | 'outdated';

export {
  classifyOpsFetchError,
  formatExactTime,
  formatRelativeTime,
  healthCodeLabel,
  jobStatusLabel,
  reasonListLabels,
  reasonShortLabel,
  severityClass,
  severityLabel,
  userMessageForFetchError,
};
export type { OpsFetchErrorKind };

export function buildDetailUrl(shopId: string): string {
  return `/api/ops/recommendations/${encodeURIComponent(shopId)}`;
}

export function isOpsDetailPayload(value: unknown): value is OpsDetailApiSuccess {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.ok !== true) return false;
  if (!v.data || typeof v.data !== 'object' || Array.isArray(v.data)) return false;
  const data = v.data as Record<string, unknown>;
  if (!data.overview || typeof data.overview !== 'object') return false;
  if (!Array.isArray(data.services) || !Array.isArray(data.products) || !Array.isArray(data.recentSets)) {
    return false;
  }
  return true;
}

export function formatScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
}

export function formatConfidence(value: number | boolean | null | undefined): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Pass' : 'Fail';
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

export function formatDurationMs(startedAt: string, finishedAt: string | null): string {
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return '—';
  const end = finishedAt ? Date.parse(finishedAt) : Date.now();
  if (!Number.isFinite(end) || end < start) return '—';
  const sec = Math.round((end - start) / 1000);
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins}m ${rem}s`;
}

export function setStatusLabel(status: string): string {
  switch (status) {
    case 'READY':
      return 'Ready';
    case 'BUILDING':
      return 'Building';
    case 'FAILED':
      return 'Failed';
    case 'SUPERSEDED':
      return 'Superseded';
    default:
      return status;
  }
}

export function profileStatusLabel(entity: {
  profilePresent: boolean;
  profileMetadataCurrent: boolean;
}): string {
  if (!entity.profilePresent) return 'Missing';
  if (!entity.profileMetadataCurrent) return 'Outdated';
  return 'Current';
}

export function filterServices(
  services: OpsDetailService[],
  filter: OpsServiceFilter,
  search: string,
): OpsDetailService[] {
  const q = search.trim().toLowerCase();
  return services.filter((s) => {
    if (q && !s.name.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q)) {
      return false;
    }
    switch (filter) {
      case 'rail_visible':
        return s.railWillRender;
      case 'no_rail':
        return !s.railWillRender;
      case 'profile_issue':
        return !s.profilePresent || !s.profileMetadataCurrent;
      default:
        return true;
    }
  });
}

export function filterProducts(
  products: OpsDetailProduct[],
  filter: OpsProductFilter,
  search: string,
): OpsDetailProduct[] {
  const q = search.trim().toLowerCase();
  return products.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) {
      return false;
    }
    switch (filter) {
      case 'current':
        return p.profilePresent && p.profileMetadataCurrent;
      case 'missing':
        return !p.profilePresent;
      case 'outdated':
        return p.profilePresent && !p.profileMetadataCurrent;
      default:
        return true;
    }
  });
}

const STAT_LABELS: Array<{ key: keyof OpsDetailStats; label: string }> = [
  { key: 'serviceCount', label: 'Services' },
  { key: 'productCount', label: 'Products' },
  { key: 'itemCount', label: 'Items' },
  { key: 'rerankAttemptedServiceCount', label: 'Rerank attempted' },
  { key: 'rerankAppliedServiceCount', label: 'Rerank applied' },
  { key: 'rerankFallbackServiceCount', label: 'Rerank fallback' },
];

export function statsDisplayRows(
  stats: OpsDetailStats | null,
): Array<{ label: string; value: string }> {
  if (!stats) return [];
  return STAT_LABELS.map(({ key, label }) => ({
    label,
    value: String(stats[key] ?? 0),
  }));
}

export function recommendationVisibilityLabel(rec: OpsDetailRecommendation): string {
  if (rec.retainedByPublicReader) return 'Customer-visible';
  if (!rec.productActive || rec.productName === '(missing)') return 'Stored only (not customer-visible)';
  return 'Stored only (not customer-visible)';
}
