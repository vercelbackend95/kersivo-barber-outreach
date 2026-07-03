import { DEMO_BANNER_LABEL, DEMO_BANNER_LEAD } from '@/lib/admin/demoConfig';

export default function AdminDemoBanner() {
  return (
    <section className="admin-demo-banner" aria-label="Admin demo information">
      <p className="admin-demo-banner__label">{DEMO_BANNER_LABEL}</p>
      <p className="admin-demo-banner__lead">{DEMO_BANNER_LEAD}</p>
    </section>
  );
}
