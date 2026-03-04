import React from 'react';
import BarberServicesEditor from './BarberServicesEditor';
import BarberWorkingHoursEditor from './BarberWorkingHoursEditor';
import BarberBlocksEditor from './BarberBlocksEditor';
import type { Barber, ServiceOption, TimeBlock, WorkingHourRow } from './barbersTypes';

type BarberProfileProps = {
  barber: Barber;
  weekDays: string[];
  isActive: boolean;
  totalBookingsServed: number;
  services: ServiceOption[];
  enabledServiceIds: Set<string>;
  servicesSaving: boolean;
  workingHours: WorkingHourRow[];
  workingHoursLoading: boolean;
  workingHoursSaving: boolean;
  blocks: TimeBlock[];
  blockTitle: string;
  blockStartAt: string;
  blockEndAt: string;
  blockSuccessMessage: string;
  blockErrorMessage: string;
  getInitials: (name: string) => string;
  onBack: () => void;
  onToggleActive: () => void;
  onToggleService: (serviceId: string, enabled: boolean) => void;
  onChangeWorkingHour: (dayOfWeek: number, field: 'active' | 'startTime' | 'endTime', value: string | boolean) => void;
  barberSaveError: string;
  onSetWorkingHours: (rules: WorkingHourRow[]) => void;
  onSaveWorkingHours: (rules?: WorkingHourRow[]) => Promise<boolean>;
  onChangeBlockTitle: (value: string) => void;
  onChangeBlockStartAt: (value: string) => void;
  onChangeBlockEndAt: (value: string) => void;
  onCreateBlock: () => void;
  onDeleteBlock: (blockId: string) => void;
  formatBlockRange: (startAt: string, endAt: string) => string;
};

export default function BarberProfile({
  barber,
  weekDays,
  isActive,
  totalBookingsServed,
  services,
  enabledServiceIds,
  servicesSaving,
  workingHours,
  workingHoursLoading,
  workingHoursSaving,
  blocks,
  blockTitle,
  blockStartAt,
  blockEndAt,
  blockSuccessMessage,
  blockErrorMessage,
  getInitials,
  onBack,
  onToggleActive,
  onToggleService,
  onChangeWorkingHour,
  barberSaveError,
  onSetWorkingHours,
  onSaveWorkingHours,
  onChangeBlockTitle,
  onChangeBlockStartAt,
  onChangeBlockEndAt,
  onCreateBlock,
  onDeleteBlock,
  formatBlockRange
}: BarberProfileProps) {
    const selectedServicesCount = enabledServiceIds.size;
  const totalServicesCount = services.length;
  const workingDaysCount = workingHours.filter((hour) => hour.active).length;

  const nextBlockLabel = React.useMemo(() => {
    const now = Date.now();
    const nextBlock = blocks
      .map((block) => ({ ...block, startMs: new Date(block.startAt).getTime() }))
      .filter((block) => Number.isFinite(block.startMs) && block.startMs >= now)
      .sort((a, b) => a.startMs - b.startMs)[0];

    if (!nextBlock) return 'none';

    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(nextBlock.startAt)).replace(',', '');
  }, [blocks]);


  return (
    <section className="admin-quick-blocks">
      <div className="admin-barber-smart-header">
        <div className="admin-barber-avatar admin-barber-avatar--large">

          {barber.avatarUrl ? <img src={barber.avatarUrl} alt={barber.name} loading="lazy" /> : <span>{getInitials(barber.name)}</span>}
        </div>

        <div className="admin-barber-smart-header__identity">
          <h2 className="admin-barber-smart-header__name">{barber.name}</h2>
          <p className="admin-barber-status-line">
            <span className={`admin-status-dot ${isActive ? 'is-active' : 'is-inactive'}`} aria-hidden="true" />
            {isActive ? 'Active' : 'Inactive'}
          </p>
          <p className="muted admin-barber-meta-line">
            Services: {selectedServicesCount}/{totalServicesCount} • Working days: {workingDaysCount}/7 • Next block: {nextBlockLabel}
          </p>
        </div>
        <div className="admin-barber-profile-actions admin-barber-profile-actions--smart">
          <button type="button" className="btn btn--ghost" onClick={onBack}>Back to list</button>

          <button type="button" className="btn btn--secondary" onClick={onToggleActive}>{isActive ? 'Deactivate' : 'Reactivate'}</button>
        </div>
      </div>

      <section className="admin-settings-panel">
        <h3>Stats</h3>
        <p className="muted">Total bookings served</p>
        <p className="admin-stat-value">{totalBookingsServed}</p>
      </section>

      <BarberServicesEditor
        barberName={barber.name}
        services={services}
        enabledServiceIds={enabledServiceIds}
        servicesSaving={servicesSaving}
        onToggleService={onToggleService}
      />

      <BarberWorkingHoursEditor
        weekDays={weekDays}
        workingHours={workingHours}
        loading={workingHoursLoading}
        saving={workingHoursSaving}
        onChangeHour={onChangeWorkingHour}
        saveError={barberSaveError}
        onSetWorkingHours={onSetWorkingHours}
        onSave={onSaveWorkingHours}
      />

      <BarberBlocksEditor
        barberName={barber.name}
        blocks={blocks}
        blockTitle={blockTitle}
        blockStartAt={blockStartAt}
        blockEndAt={blockEndAt}
        successMessage={blockSuccessMessage}
        errorMessage={blockErrorMessage}
        onChangeTitle={onChangeBlockTitle}
        onChangeStartAt={onChangeBlockStartAt}
        onChangeEndAt={onChangeBlockEndAt}
        onCreate={onCreateBlock}
        onDelete={onDeleteBlock}
        formatRange={formatBlockRange}
      />
    </section>
  );
}
