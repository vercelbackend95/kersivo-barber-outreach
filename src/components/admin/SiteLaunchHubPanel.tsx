import { useEffect, useState } from 'react';
import '@/styles/components/admin-site-launch.css';

type LaunchData = {
  shopId: string;
  status: 'not_ready' | 'ready_for_review' | 'approved';
  previewUrl: string | null;
  siteVersion: string | null;
  previewReadyAt: string | null;
  approvedAt: string | null;
  approvedByEmail: string | null;
  approvedVersion: string | null;
  goLiveAt: string | null;
};

const CHECKLIST = [
  'Content and contact details',
  'Photos',
  'Team',
  'Booking flow',
  'Services and prices',
  'Opening hours',
];

const STATUS_LABELS: Record<LaunchData['status'], string> = {
  not_ready: 'Not ready',
  ready_for_review: 'Ready for review',
  approved: 'Approved',
};

const STATUS_CLASSES: Record<LaunchData['status'], string> = {
  not_ready: 'site-launch-hub__badge--pending',
  ready_for_review: 'site-launch-hub__badge--review',
  approved: 'site-launch-hub__badge--approved',
};

export default function SiteLaunchHubPanel() {
  const [data, setData] = useState<LaunchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/site-launch', { credentials: 'include' });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as LaunchData;
        if (!cancelled) setData(json);
      } catch {
        // leave data null
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="site-launch-hub">
        <p>Loading site launch status…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="site-launch-hub">
        <p>Unable to load site launch status.</p>
        <div className="site-launch-hub__actions">
          <a href="/admin" className="btn btn--secondary btn--sm">
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="site-launch-hub">
      <h2 className="site-launch-hub__title">Site launch</h2>

      <div className="site-launch-hub__status">
        <span className={`site-launch-hub__badge ${STATUS_CLASSES[data.status]}`}>
          {STATUS_LABELS[data.status]}
        </span>
        {data.siteVersion ? (
          <span className="site-launch-hub__version">Version: {data.siteVersion}</span>
        ) : null}
      </div>

      {data.status === 'not_ready' ? (
        <p className="site-launch-hub__note">
          We're building your website. Once it's ready, you'll be able to preview and approve it
          here.
        </p>
      ) : null}

      {data.status !== 'not_ready' ? (
        <>
          <div className="site-launch-hub__checklist">
            <h3>Review checklist</h3>
            <ul>
              {CHECKLIST.map((item, i) => (
                <li key={item}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked[i]}
                      onChange={() => {
                        const next = [...checked];
                        next[i] = !next[i];
                        setChecked(next);
                      }}
                    />
                    {item}
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="site-launch-hub__actions">
            <a href="/admin/site-preview" className="btn btn--primary btn--sm">
              Open preview
            </a>
            {data.shopId ? (
              <a
                href={`/book/${encodeURIComponent(data.shopId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--secondary btn--sm"
              >
                Test online booking
              </a>
            ) : null}
            <a href="/admin" className="btn btn--secondary btn--sm">
              Back to dashboard
            </a>
          </div>
        </>
      ) : (
        <div className="site-launch-hub__actions">
          {data.shopId ? (
            <a
              href={`/book/${encodeURIComponent(data.shopId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--secondary btn--sm"
            >
              Test online booking
            </a>
          ) : null}
          <a href="/admin" className="btn btn--secondary btn--sm">
            Back to dashboard
          </a>
        </div>
      )}

      {data.status === 'approved' ? (
        <div className="site-launch-hub__approval">
          <h3>Approval record</h3>
          <dl>
            <dt>Approved by</dt>
            <dd>{data.approvedByEmail ?? '—'}</dd>
            <dt>Approved at</dt>
            <dd>{formatDate(data.approvedAt)}</dd>
            <dt>Version</dt>
            <dd>{data.approvedVersion ?? '—'}</dd>
            <dt>Go-live date</dt>
            <dd>{formatDate(data.goLiveAt)}</dd>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
