import React from 'react';
import { Plus } from '../lucide-react';

type AdminAddButtonProps = {
  label: string;
  onClick: () => void;
  testId?: string;
  disabled?: boolean;
};

export default function AdminAddButton({ label, onClick, testId, disabled }: AdminAddButtonProps) {
  return (
    <button
      type="button"
      className="btn btn--primary btn--sm admin-add-btn"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
    >
      <Plus aria-hidden />
      <span>{label}</span>
    </button>
  );
}
