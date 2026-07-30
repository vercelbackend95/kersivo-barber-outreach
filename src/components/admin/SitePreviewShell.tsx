import { useState } from 'react';
import type { SiteLaunchStatus } from '@/lib/setup/siteLaunch';

interface Props {
  status: SiteLaunchStatus;
  previewUrl: string | null;
  siteVersion: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
}

export default function SitePreviewShell(props: Props) {
  const [status, setStatus] = useState<SiteLaunchStatus>(props.status);
  const [approving, setApproving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvedAt, setApprovedAt] = useState(props.approvedAt);
  const [iframeBlocked, setIframeBlocked] = useState(false);

  if (status === 'not_ready' || !props.previewUrl) {
    return (
      <div className="site-preview-empty">
        <h1>Preview not ready yet</h1>
        <p>
          We're building your website. You'll be able to preview and approve it here once it's ready.
        </p>
        <a href="/admin?section=site_launch" className="btn btn--secondary">
          Back to Admin
        </a>
      </div>
    );
  }

  const handleApprove = async () => {
    setApproving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/site-launch/approve', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; alreadyApproved?: boolean };
      if (!res.ok) {
        throw new Error(data.error || 'Unable to approve.');
      }
      setStatus('approved');
      setApprovedAt(new Date().toISOString());
      setShowConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve.');
    } finally {
      setApproving(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="site-preview-shell">
      <div className="site-preview-toolbar" role="region" aria-label="Private site preview">
        <div className="site-preview-toolbar__left">
          <span className="site-preview-toolbar__eyebrow">Private preview</span>
          {props.siteVersion ? (
            <span className="site-preview-toolbar__version">{props.siteVersion}</span>
          ) : null}
        </div>
        <div className="site-preview-toolbar__right">
          <a href="/admin?section=site_launch" className="btn btn--secondary btn--sm">
            Back to Admin
          </a>
          <a
            href={props.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--secondary btn--sm"
          >
            Open in new tab
          </a>
          {status === 'ready_for_review' && !showConfirm ? (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => setShowConfirm(true)}
            >
              Approve &amp; launch
            </button>
          ) : null}
          {status === 'approved' ? (
            <span className="site-preview-toolbar__approved">
              Approved{approvedAt ? ` · ${formatDate(approvedAt)}` : ''} · go-live recorded
            </span>
          ) : null}
        </div>
      </div>

      {showConfirm ? (
        <div className="site-preview-confirm" role="dialog" aria-modal="true" aria-labelledby="site-preview-confirm-title">
          <div className="site-preview-confirm__card">
            <h2 id="site-preview-confirm-title">Approve &amp; launch</h2>
            <p>Please confirm you have reviewed:</p>
            <ul>
              <li>Content and contact details</li>
              <li>Photos and team</li>
              <li>Booking flow, services, and prices</li>
              <li>Opening hours</li>
            </ul>
            <p>
              By approving, you authorise go-live. DNS will be switched to your domain after
              approval.
            </p>
            {error ? <p className="site-preview-confirm__error">{error}</p> : null}
            <div className="site-preview-confirm__actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setShowConfirm(false)}
                disabled={approving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={handleApprove}
                disabled={approving}
              >
                {approving ? 'Approving…' : 'Confirm approval'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {iframeBlocked ? (
        <div className="site-preview-fallback">
          <p>This preview cannot be shown inside the dashboard (site blocks embedding).</p>
          <a
            href={props.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--secondary"
          >
            Open preview in new tab
          </a>
          <p className="site-preview-fallback__hint">
            Use Approve &amp; launch in the toolbar above after you have reviewed the site.
          </p>
        </div>
      ) : (
        <iframe
          className="site-preview-iframe"
          src={props.previewUrl}
          title="Site preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          onLoad={(event) => {
            // Cross-origin embeds often yield null contentDocument; empty about:blank can signal block.
            try {
              const doc = event.currentTarget.contentDocument;
              if (doc && doc.location.href === 'about:blank') {
                setIframeBlocked(true);
              }
            } catch {
              // Cross-origin access denied is expected when embed works — leave iframe visible.
            }
          }}
        />
      )}
    </div>
  );
}
