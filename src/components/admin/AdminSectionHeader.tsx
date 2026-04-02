import React, { forwardRef } from 'react';

type AdminSectionHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  metaBadge?: string;
  metaBadgeVariant?: 'default' | 'success' | 'warning';
};

const META_BADGE_CLASS_MAP: Record<NonNullable<AdminSectionHeaderProps['metaBadgeVariant']>, string> = {
  default: 'badge--neutral',
  success: 'badge--confirmed',
  warning: 'badge--pending',
};

const AdminSectionHeader = forwardRef<HTMLDivElement, AdminSectionHeaderProps>(function AdminSectionHeader(
  { title, description, actions, metaBadge, metaBadgeVariant = 'default' },
  ref,
) {
  return (
    <div ref={ref} className="admin-section-header">
      <div className="admin-section-header-copy">
        <div className="admin-section-header-title-row">
          <h2 className="admin-section-header-title">{title}</h2>
          {metaBadge ? (
            <span className={`badge badge--sm badge--pill ${META_BADGE_CLASS_MAP[metaBadgeVariant]}`}>
              {metaBadge}
            </span>
          ) : null}
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
