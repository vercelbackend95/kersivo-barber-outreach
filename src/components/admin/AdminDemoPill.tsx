import { DEMO_PILL_LABEL_FULL, DEMO_PILL_LABEL_SHORT, DEMO_PILL_TOOLTIP } from '@/lib/admin/demoConfig';

export default function AdminDemoPill() {
  return (
    <span
      className="admin-demo-pill"
      title={DEMO_PILL_TOOLTIP}
      aria-label={`${DEMO_PILL_LABEL_FULL}. ${DEMO_PILL_TOOLTIP}`}
    >
      <span className="admin-demo-pill__full">{DEMO_PILL_LABEL_FULL}</span>
      <span className="admin-demo-pill__short" aria-hidden="true">{DEMO_PILL_LABEL_SHORT}</span>
    </span>
  );
}
