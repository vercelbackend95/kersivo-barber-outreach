import React from 'react';
import { Plus } from '../lucide-react';

type AdminAddButtonProps = {
  label: string;
  onClick: () => void;
  testId?: string;
  disabled?: boolean;
  /** desktop = hidden under admin mobile chrome (default). always = keep the labelled control. */
  visibility?: 'desktop' | 'always';
};

export default function AdminAddButton({
  label,
  onClick,
  testId,
  disabled,
  visibility = 'desktop',
}: AdminAddButtonProps) {
  const className = [
    'btn btn--primary btn--sm admin-add-btn',
    visibility === 'desktop' ? 'admin-add-btn--desktop' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
    >
      <Plus aria-hidden />
      <span>{label}</span>
    </button>
  );
}
