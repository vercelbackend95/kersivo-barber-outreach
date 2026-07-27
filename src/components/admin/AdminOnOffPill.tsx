import React from 'react';
import '@/styles/components/admin-team.css';

type AdminOnOffPillProps = {
  id?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
  onLabel?: string;
  offLabel?: string;
};

/** Off | On pill pair — shared admin boolean control (replaces track/thumb switches). */
export default function AdminOnOffPill({
  id,
  value,
  onChange,
  disabled = false,
  ariaLabel,
  onLabel = 'On',
  offLabel = 'Off',
}: AdminOnOffPillProps) {
  return (
    <div id={id} className="admin-on-off-pill" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className={`admin-on-off-pill__option${value ? '' : ' is-on'}`}
        aria-pressed={!value}
        disabled={disabled}
        onClick={() => onChange(false)}
      >
        {offLabel}
      </button>
      <button
        type="button"
        className={`admin-on-off-pill__option${value ? ' is-on' : ''}`}
        aria-pressed={value}
        disabled={disabled}
        onClick={() => onChange(true)}
      >
        {onLabel}
      </button>
    </div>
  );
}
