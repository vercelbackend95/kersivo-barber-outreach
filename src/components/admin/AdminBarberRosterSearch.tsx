import React, { type RefObject } from 'react';
import AdminPremiumSearchBar from './AdminPremiumSearchBar';

type AdminBarberRosterSearchProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  onClear: () => void;
  resultsLabel?: string;
  showKbdHint: boolean;
  searchShortcutHint: string;
};

export default function AdminBarberRosterSearch({
  searchInputRef,
  query,
  onQueryChange,
  onClear,
  resultsLabel,
  showKbdHint,
  searchShortcutHint,
}: AdminBarberRosterSearchProps) {
  return (
    <AdminPremiumSearchBar
      inputRef={searchInputRef}
      value={query}
      onChange={onQueryChange}
      onClear={onClear}
      placeholder="Search barbers by name or service…"
      aria-label="Search barbers by name or service"
      resultsLabel={resultsLabel}
      showKbdHint={showKbdHint}
      searchShortcutHint={searchShortcutHint}
    />
  );
}
