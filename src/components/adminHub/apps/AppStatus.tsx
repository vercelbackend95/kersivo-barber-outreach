import { ADMIN_HUB_APP_ERROR, ADMIN_HUB_APP_LOADING, ADMIN_HUB_APP_RETRY } from '@/lib/adminHub/copy';
import type { ReactNode } from 'react';

export function AppStatus(props: {
  state: 'loading' | 'empty' | 'error' | 'ready';
  empty?: string;
  error?: string | null;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  if (props.state === 'loading') {
    return (
      <div className="admin-hub-app-status" aria-busy="true">
        <div className="hub-skel hub-skel--card" />
        <div className="hub-skel hub-skel--bar" />
        <p className="admin-hub-sr-only">{ADMIN_HUB_APP_LOADING}</p>
      </div>
    );
  }
  if (props.state === 'error') {
    return (
      <div className="admin-hub-app-status" role="alert">
        <p>{props.error || ADMIN_HUB_APP_ERROR}</p>
        {props.onRetry ? (
          <button type="button" className="btn btn--secondary btn--sm" onClick={props.onRetry}>
            {ADMIN_HUB_APP_RETRY}
          </button>
        ) : null}
      </div>
    );
  }
  if (props.state === 'empty') {
    return (
      <div className="admin-hub-app-status">
        <p>{props.empty}</p>
        {props.children}
      </div>
    );
  }
  return <>{props.children}</>;
}
