import React, { forwardRef } from 'react';

type AdminSectionHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  metaBadge?: string;
  metaBadgeVariant?: 'default' | 'success' | 'warning' | 'info';
  metaBadges?: Array<{
    label: string;
    variant?: 'default' | 'success' | 'warning' | 'info';
  }>;
};

const META_BADGE_CLASS_MAP: Record<NonNullable<AdminSectionHeaderProps['metaBadgeVariant']>, string> = {
  default: 'badge--neutral',
  success: 'badge--confirmed',
  warning: 'badge--pending',
  info: 'badge--info',
};

const AdminSectionHeader = forwardRef<HTMLDivElement, AdminSectionHeaderProps>(function AdminSectionHeader(
  { title, description, actions, metaBadge, metaBadgeVariant = 'default', metaBadges },
  ref,
) {
  const badges = metaBadges ?? (metaBadge ? [{ label: metaBadge, variant: metaBadgeVariant }] : []);

  return (
    <div ref={ref} className="admin-section-header">
      <div className="admin-section-header-copy">
        <div className="admin-section-header-title-row">
          <h2 className="admin-section-header-title">{title}</h2>
          {badges.map((badge) => (
            <span key={badge.label} className={`badge badge--sm badge--pill ${META_BADGE_CLASS_MAP[badge.variant ?? 'default']}`}>
              {badge.label}
            </span>
          ))}
        </div>
        {description && (
          <p className="admin-section-header-desc">{description}</p>
        )}
      </div>
      {actions && (
        <div className="admin-section-header-actions">{actions}</div>
      )}
    </div>
  );
});

export default AdminSectionHeader;
