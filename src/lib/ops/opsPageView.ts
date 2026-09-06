import type { OperatorAuthResult } from '@/lib/ops/operatorAuth';

/** SSR page modes for /ops/* — never includes email or allowlist. */
export type OpsPageView = 'sign_in' | 'denied' | 'unconfigured' | 'dashboard';

export function resolveOpsPageView(result: OperatorAuthResult): OpsPageView {
  if (result.ok) return 'dashboard';
  switch (result.code) {
    case 'UNAUTHORIZED':
      return 'sign_in';
    case 'OPS_ACCESS_NOT_CONFIGURED':
      return 'unconfigured';
    case 'EMAIL_NOT_VERIFIED':
    case 'FORBIDDEN':
    case 'INTERNAL_ERROR':
    default:
      return 'denied';
  }
}
