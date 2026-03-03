import React from 'react';
import type { Barber, ServiceOption, TimeBlock } from './barbersTypes';

type BarbersOverviewProps = {
  barbers: Barber[];
  services: ServiceOption[];
  showInactive: boolean;
  barberNameDraft: string;
  barberAvatarPreviewUrl: string | null;
  selectedServiceIds: string[];
  barberSaving: boolean;
  barberReordering: boolean;
  barberSaveMessage: string;
  barberSaveError: string;
  isAddBarberSheetOpen: boolean;
  globalBlocks: TimeBlock[];
  getInitials: (name: string) => string;
  onBarberNameChange: (value: string) => void;
  onBarberAvatarChange: (file: File | null) => void;
  onSelectedServiceIdsChange: (serviceIds: string[]) => void;
  onSubmitAddBarber: (event: React.FormEvent<HTMLFormElement>) => void;
  onShowInactiveChange: (value: boolean) => void;
  onOpenBarber: (barberId: string) => void;
  onMoveBarber: (index: number, direction: 'up' | 'down') => void;
  onOpenAddBarberSheet: () => void;
  onCloseAddBarberSheet: () => void;

  formatBlockRange: (startAt: string, endAt: string) => string;
};
const DEFAULT_SERVICE_OPTIONS: ServiceOption[] = [
  { id: 'svc-haircut', name: 'Haircut' },
  { id: 'svc-skin-fade', name: 'Skin Fade' },
  { id: 'svc-beard-trim', name: 'Beard Trim' },
  { id: 'svc-haircut-beard', name: 'Haircut + Beard' },
];


function normalizeBarberStatus(barber: Barber) {
  if (typeof barber.isActive === 'boolean') return barber.isActive;
  if (typeof barber.active === 'boolean') return barber.active;
  return true;
}

export default function BarbersOverview({
  barbers,
    services,
  showInactive,
  barberNameDraft,
  barberAvatarPreviewUrl,
    selectedServiceIds,
  barberSaving,
  barberReordering,
  barberSaveMessage,
  barberSaveError,
    isAddBarberSheetOpen,
  globalBlocks,
  getInitials,
  onBarberNameChange,
  onBarberAvatarChange,
  onSelectedServiceIdsChange,
  onSubmitAddBarber,
  onShowInactiveChange,
  onOpenBarber,
  onMoveBarber,
  onOpenAddBarberSheet,
  onCloseAddBarberSheet,

  formatBlockRange,
}: BarbersOverviewProps) {
  const availableServices = services.length > 0 ? services : DEFAULT_SERVICE_OPTIONS;

  React.useEffect(() => {
    if (!isAddBarberSheetOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseAddBarberSheet();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isAddBarberSheetOpen, onCloseAddBarberSheet]);

  return (
    <section className="admin-quick-blocks">
      <h2>Barbers</h2>
      <p className="muted">Manage active barbers and open a barber profile for details.</p>

      <div className="admin-barber-toggle">
        <label>
          <input type="checkbox" checked={showInactive} onChange={(event) => onShowInactiveChange(event.target.checked)} />
          Show inactive
        </label>
      </div>

      {barberSaveMessage ? <p className="admin-inline-success">{barberSaveMessage}</p> : null}
      {barberSaveError ? <p className="admin-inline-error">{barberSaveError}</p> : null}

      <ul className="admin-barber-grid" aria-label="Barbers list">
        {barbers.map((barber, index) => {
          const barberIsActive = normalizeBarberStatus(barber);
          const isFirstItem = index === 0;
          const isLastItem = index === barbers.length - 1;

          return (
            <li key={barber.id} className={`admin-barber-card ${barberIsActive ? '' : 'is-inactive'}`}>
              <button type="button" className="admin-barber-identity" onClick={() => onOpenBarber(barber.id)}>
                <div className="admin-barber-avatar">
                  {barber.avatarUrl ? <img src={barber.avatarUrl} alt={barber.name} loading="lazy" /> : <span>{getInitials(barber.name)}</span>}
                </div>
                <div>
                  <p className="admin-barber-name">{barber.name}</p>
                  <p className="muted">{barberIsActive ? 'Active' : 'Inactive'}</p>
                </div>
              </button>
              <div className="admin-barber-actions">
                <div className="admin-reorder-controls" role="group" aria-label={`Reorder ${barber.name}`}>
                  <button type="button" className="admin-reorder-btn" onClick={() => onMoveBarber(index, 'up')} disabled={isFirstItem || barberReordering} aria-label={`Move ${barber.name} up`}>↑</button>
                  <button type="button" className="admin-reorder-btn" onClick={() => onMoveBarber(index, 'down')} disabled={isLastItem || barberReordering} aria-label={`Move ${barber.name} down`}>↓</button>
                </div>
                <button type="button" className="admin-barber-settings-btn" onClick={() => onOpenBarber(barber.id)} aria-label={`Open ${barber.name} settings`}>
                  ⚙
                </button>
              </div>
            </li>
          );
        })}
        <li className="admin-barber-card admin-barber-card--add">
          <button type="button" className="admin-barber-add-btn" onClick={onOpenAddBarberSheet}>
            <span className="admin-barber-add-icon" aria-hidden="true">+</span>
            <span>Add barber</span>
          </button>
        </li>
      </ul>
      {isAddBarberSheetOpen ? (
        <div
          className="admin-barber-sheet-layer"
          role="dialog"
          aria-modal="true"
          aria-label="Add barber"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onCloseAddBarberSheet();
            }
          }}
        >
          <form
            className="admin-barber-sheet"
            onSubmit={onSubmitAddBarber}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-barber-sheet-head">
              <h3>Add barber</h3>
              <button type="button" className="btn btn--ghost" onClick={onCloseAddBarberSheet} aria-label="Close add barber form">✕</button>
            </div>

            <div className="admin-barber-sheet-content">
              <label htmlFor="barber-name">Barber name</label>
              <input
                id="barber-name"
                value={barberNameDraft}
                onChange={(event) => onBarberNameChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                  }
                }}
                placeholder="e.g. Marco"
                required
              />


              <label htmlFor="barber-avatar">Avatar (optional)</label>
              <div className="admin-barber-file-input-wrap">
                <input id="barber-avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onBarberAvatarChange(event.target.files?.[0] ?? null)} />
              </div>

              {barberAvatarPreviewUrl ? <img src={barberAvatarPreviewUrl} alt="Selected avatar preview" className="admin-avatar-preview" /> : null}

              <fieldset className="admin-service-select-group">
                <legend>Services</legend>
                <div className="admin-services-grid">
                  {availableServices.map((service) => {
                    const checked = selectedServiceIds.includes(service.id);
                    return (
                      <label key={service.id} className="admin-service-checkbox">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            if (event.target.checked) {
                              onSelectedServiceIdsChange([...selectedServiceIds, service.id]);
                              return;
                            }
                            onSelectedServiceIdsChange(selectedServiceIds.filter((serviceId) => serviceId !== service.id));
                          }}
                        />
                        <span>{service.name}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className="admin-barber-sheet-footer">
              <button type="submit" className="btn btn--primary" disabled={barberSaving}>{barberSaving ? 'Saving...' : 'Save barber'}</button>
            </div>
          </form>
        </div>
      ) : null}


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
