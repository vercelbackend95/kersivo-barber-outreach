import {
  healthCodeLabel,
  severityClass,
  severityLabel,
  type OpsShopOverview,
} from '@/lib/recommendations/ops/overviewClient';

type Props = {
  shop: OpsShopOverview;
};

export function OpsHealthBadge({ shop }: Props) {
  const code = String(shop.health.code);
  const severity = String(shop.health.severity);
  const label = healthCodeLabel(code);
  const sev = severityLabel(severity);
  return (
    <span
      className={`ops-badge ${severityClass(severity)}`}
      title={`${label} (${code}) · ${sev}`}
    >
      <span className="ops-badge__label">{label}</span>
      <span className="ops-badge__sev">{sev}</span>
    </span>
  );
}
