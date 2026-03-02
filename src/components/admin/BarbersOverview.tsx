import React from 'react';
import type { Barber, TimeBlock } from './barbersTypes';

type BarbersOverviewProps = {
  barbers: Barber[];
  showInactive: boolean;
  barberNameDraft: string;
  barberAvatarPreviewUrl: string | null;
  barberSaving: boolean;
  barberReordering: boolean;
  barberSaveMessage: string;
  barberSaveError: string;
  globalBlocks: TimeBlock[];
  getInitials: (name: string) => string;
  onBarberNameChange: (value: string) => void;
  onBarberAvatarChange: (file: File | null) => void;
  onSubmitAddBarber: (event: React.FormEvent<HTMLFormElement>) => void;
  onShowInactiveChange: (value: boolean) => void;
  onOpenBarber: (barberId: string) => void;
  onMoveBarber: (index: number, direction: 'up' | 'down') => void;
  onToggleBarberActive: (barberId: string, nextActive: boolean) => void;
  formatBlockRange: (startAt: string, endAt: string) => string;
};

function normalizeBarberStatus(barber: Barber) {
  if (typeof barber.isActive === 'boolean') return barber.isActive;
  if (typeof barber.active === 'boolean') return barber.active;
  return true;
}

export default function BarbersOverview({
  barbers,
  showInactive,
  barberNameDraft,
  barberAvatarPreviewUrl,
  barberSaving,
  barberReordering,
  barberSaveMessage,
  barberSaveError,
  globalBlocks,
  getInitials,
  onBarberNameChange,
  onBarberAvatarChange,
  onSubmitAddBarber,
  onShowInactiveChange,
  onOpenBarber,
  onMoveBarber,
  onToggleBarberActive,
  formatBlockRange
}: BarbersOverviewProps) {
  return (
    <section className="admin-quick-blocks">
      <h2>Barbers</h2>
      <p className="muted">Manage active barbers and open a barber profile for details.</p>

      <form className="admin-barber-form" onSubmit={onSubmitAddBarber}>
        <h3>Add barber</h3>
        <label htmlFor="barber-name">Barber name</label>
        <input id="barber-name" value={barberNameDraft} onChange={(event) => onBarberNameChange(event.target.value)} placeholder="e.g. Marco" required />
        <label htmlFor="barber-avatar">Avatar (optional)</label>
        <input id="barber-avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onBarberAvatarChange(event.target.files?.[0] ?? null)} />
        {barberAvatarPreviewUrl ? <img src={barberAvatarPreviewUrl} alt="Selected avatar preview" className="admin-avatar-preview" /> : null}
        <button type="submit" className="btn btn--primary" disabled={barberSaving}>Save barber</button>
      </form>

      <div className="admin-barber-toggle">
        <label>
          <input type="checkbox" checked={showInactive} onChange={(event) => onShowInactiveChange(event.target.checked)} />
          Show inactive
        </label>
      </div>

      {barberSaveMessage ? <p className="admin-inline-success">{barberSaveMessage}</p> : null}
      {barberSaveError ? <p className="admin-inline-error">{barberSaveError}</p> : null}

      <h3>Barbers list</h3>
      <ul className="admin-barber-list">
        {barbers.map((barber, index) => {
          const barberIsActive = normalizeBarberStatus(barber);
          const isFirstItem = index === 0;
          const isLastItem = index === barbers.length - 1;

          return (
            <li key={barber.id} className={`admin-barber-list-item ${barberIsActive ? '' : 'is-inactive'}`}>
              <button type="button" className="admin-barber-identity" onClick={() => onOpenBarber(barber.id)}>
                <div className="admin-barber-avatar">
                  {barber.avatarUrl ? <img src={barber.avatarUrl} alt={barber.name} loading="lazy" /> : <span>{getInitials(barber.name)}</span>}
                </div>
                <div>
                  <p className="admin-barber-name">{barber.name}</p>
                  <p className="muted">{barberIsActive ? 'Active' : 'Inactive'} • Sort {barber.sortOrder ?? index}</p>
                </div>
              </button>
              <div className="admin-barber-actions">
                <div className="admin-reorder-controls" role="group" aria-label={`Reorder ${barber.name}`}>
                  <button type="button" className="admin-reorder-btn" onClick={() => onMoveBarber(index, 'up')} disabled={isFirstItem || barberReordering} aria-label={`Move ${barber.name} up`}>↑</button>
                  <button type="button" className="admin-reorder-btn" onClick={() => onMoveBarber(index, 'down')} disabled={isLastItem || barberReordering} aria-label={`Move ${barber.name} down`}>↓</button>
                </div>
                <button type="button" className="btn btn--ghost" onClick={() => onToggleBarberActive(barber.id, !barberIsActive)}>{barberIsActive ? 'Deactivate' : 'Reactivate'}</button>
              </div>
            </li>
          );
        })}
      </ul>

      {globalBlocks.length > 0 ? (
        <>
          <h3>Global blocks</h3>
          <ul className="admin-blocks-list">
            {globalBlocks.map((block) => (
              <li key={block.id}>
                <div>
                  <strong>{block.title}</strong>
                  <p className="muted">All barbers · {formatBlockRange(block.startAt, block.endAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
