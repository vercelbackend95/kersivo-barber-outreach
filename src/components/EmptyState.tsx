import React from 'react';

type EmptyStateProps = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  action?: React.ReactNode;
  variant?: 'filtered';
};

export default function EmptyState({ icon: Icon, title, description, action, variant }: EmptyStateProps) {
  return (
    <div className={`empty-state${variant ? ` empty-state--${variant}` : ''}`} role="status" aria-live="polite">
      <span className="empty-state__icon" aria-hidden="true">
        <Icon />
      </span>
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__description">{description}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
