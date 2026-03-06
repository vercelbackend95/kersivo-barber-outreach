import React, { useEffect, useMemo, useState } from 'react';

type BarberChipBarber = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

type BarberChipProps = {
  barber: BarberChipBarber;
  isSelected: boolean;
  onClick: () => void;
  toneIndex?: number;
  ariaLabel: string;
};

function getInitials(name: string): string {
  const normalized = name.trim();
  if (!normalized) return '?';
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export default function BarberChip({ barber, isSelected, onClick, toneIndex = 0, ariaLabel }: BarberChipProps) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [barber.id, barber.avatarUrl]);

  const initials = useMemo(() => getInitials(barber.name), [barber.name]);

  const renderAvatar = (targetBarber: BarberChipBarber) => {
    if (targetBarber.avatarUrl && !hasImageError) {
      return (
        <img
          src={targetBarber.avatarUrl}
          alt={`${targetBarber.name} avatar`}
          className="barber-chip-avatar"
          loading="lazy"
          onError={() => setHasImageError(true)}
        />
      );
    }

    return (
      <span className="barber-chip-avatar barber-chip-avatar--initials" aria-label={targetBarber.name}>
        {initials}
      </span>
    );
  };

  return (
    <button
      type="button"
      className={`admin-history-avatar admin-history-avatar--tone-${toneIndex} ${isSelected ? 'is-active' : ''}`}
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={ariaLabel}
      title={barber.name}
    >
      {renderAvatar(barber)}
    </button>
  );
}
