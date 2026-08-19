import React from 'react';
import { Store } from '../lucide-react';
import '@/styles/components/admin-sidebar-launch-cta.css';

type AdminLaunchCtaButtonProps = {
  title: string;
  ariaLabel: string;
  status?: string;
  children?: React.ReactNode;
  conversion?: boolean;
  className?: string;
  href?: string;
  onClick?: () => void;
  dataTrack?: string;
};

export default function AdminLaunchCtaButton({
  title,
  ariaLabel,
  status,
  children,
  conversion = false,
  className,
  href,
  onClick,
  dataTrack,
}: AdminLaunchCtaButtonProps) {
  const classes = [
    'admin-sidebar-launch-cta',
    conversion ? 'admin-sidebar-launch-cta--conversion' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      <span className="admin-sidebar-launch-cta__icon" aria-hidden="true">
        <Store width={18} height={18} />
      </span>
      <span className="admin-sidebar-launch-cta__body">
        {status ? <span className="admin-sidebar-launch-cta__status">{status}</span> : null}
        <span className="admin-sidebar-launch-cta__title">{title}</span>
        {children}
      </span>
    </>
  );

  if (href) {
    return (
      <a
        className={classes}
        href={href}
        aria-label={ariaLabel}
        data-track={dataTrack}
        data-astro-reload=""
        onClick={onClick}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      aria-label={ariaLabel}
      data-track={dataTrack}
    >
      {inner}
    </button>
  );
}
