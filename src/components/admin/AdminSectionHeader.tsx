import React from 'react';

type AdminSectionHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export default function AdminSectionHeader({ title, description, actions }: AdminSectionHeaderProps) {
  return (
    <div className="admin-section-header">
      <div className="admin-section-header-copy">
        <h2 className="admin-section-header-title">{title}</h2>
        {description && (
          <p className="admin-section-header-desc">{description}</p>
        )}
      </div>
      {actions && (
        <div className="admin-section-header-actions">{actions}</div>
      )}
    </div>
  );
}
