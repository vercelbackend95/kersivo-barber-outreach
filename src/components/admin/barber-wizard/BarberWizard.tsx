import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ButtonSpinner } from '../../ButtonSpinner';
import { ConfirmationStatusIcon } from '../../ConfirmationStatusIcon';
import EmptyState from '../../EmptyState';
import { Check, ImagePlus, Scissors, Users, X } from '../../lucide-react';
import { getDefaultWorkingHourRows } from '../../../lib/admin/defaultWorkingHourRows';
import { TEAM_SETUP_ONLINE_BOOKINGS_REFRESH_WARNING } from '../../../lib/admin/teamCards';
import { createSubmissionGate } from '../../../lib/admin/teamInviteWizardResults';
import BarberWorkingHoursEditor from '../BarberWorkingHoursEditor';
import type { WorkingHourRow } from '../barbersTypes';
import {
  BARBER_AVATAR_MAX_SIZE_BYTES,
  BARBER_AVATAR_TYPES,
  BARBER_WIZARD_STEPS,
  WEEK_DAY_LABELS,
  getWeeklyHoursSummary,
  validateBarberWizardStep,
  type BarberWizardErrors,
  type BarberWizardMode,
  type BarberWizardService,
  type BarberWizardStep
} from './barberWizardTypes';

export type SetupMemberSavedResult = {
  barberId: string;
  name: string;
  avatarUrl: string | null;
  email: string | null;
  serviceIds: string[];
  active: boolean;
};

type BarberWizardProps = {
  mode?: BarberWizardMode;
  barberId?: string;
  memberId?: string;
  services: BarberWizardService[];
  weekDays?: readonly string[];
  initialName?: string;
  initialServiceIds?: string[];
  initialAvatarUrl?: string | null;
  initialIsActive?: boolean;
  initialWorkingHours?: WorkingHourRow[];
  onCancel: () => void;
  onSaved: (result?: SetupMemberSavedResult) => void | boolean | Promise<void | boolean>;
};

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="field__error" role="alert">
      {children}
    </p>
  );
}

export default function BarberWizard({
  mode = 'create',
  barberId,
  memberId,
  services,
  weekDays = WEEK_DAY_LABELS,
  initialName = '',
  initialServiceIds,
  initialAvatarUrl = null,
  initialIsActive = true,
  initialWorkingHours,
  onCancel,
  onSaved
}: BarberWizardProps) {
  const isEdit = mode === 'edit';
  const isSetupMember = mode === 'setup-member';
  const prefillFromInitial = isEdit || isSetupMember;
  const [step, setStep] = useState<BarberWizardStep>(1);
  const [name, setName] = useState(() => (prefillFromInitial ? initialName : ''));
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() => {
    if (prefillFromInitial && initialServiceIds && initialServiceIds.length > 0) {
      return [...initialServiceIds];
    }
    return services.map((service) => service.id);
  });
  const [workingHours, setWorkingHours] = useState<WorkingHourRow[]>(
    () => initialWorkingHours ?? getDefaultWorkingHourRows()
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(() =>
    prefillFromInitial && initialAvatarUrl ? initialAvatarUrl : ''
  );
  const [avatarError, setAvatarError] = useState('');
  const [errors, setErrors] = useState<BarberWizardErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [scheduleWarning, setScheduleWarning] = useState('');
  const [refreshWarning, setRefreshWarning] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const submissionGateRef = useRef(createSubmissionGate());
  /** Sync lock mirrors the gate so double-clicks cannot race before React re-renders. */
  const submissionInFlightRef = useRef(false);

  useEffect(() => {
    if (!finished) stepHeadingRef.current?.focus();
  }, [finished, step]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  useEffect(() => {
    setSelectedServiceIds((current) => {
      if (current.length > 0) {
        const valid = current.filter((id) => services.some((service) => service.id === id));
        if (valid.length === current.length) return current;
        if (valid.length) return valid;
        if (prefillFromInitial && initialServiceIds?.length) {
          const fromInitial = initialServiceIds.filter((id) => services.some((service) => service.id === id));
          if (fromInitial.length) return fromInitial;
        }
        return services.map((service) => service.id);
      }
      if (isEdit) return current;
      return services.map((service) => service.id);
    });
  }, [services, isEdit, prefillFromInitial, initialServiceIds]);

  function clearFieldError(key: keyof BarberWizardErrors) {
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
    if (submitError) setSubmitError('');
  }

  function moveToStep(nextStep: BarberWizardStep) {
    setErrors({});
    setSubmitError('');
    setStep(nextStep);
  }

  function validateAndContinue() {
    const nextErrors = validateBarberWizardStep(step, name, selectedServiceIds, workingHours);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (step < 4) moveToStep((step + 1) as BarberWizardStep);
  }

  function handleAvatarFile(file: File) {
    if (!BARBER_AVATAR_TYPES.has(file.type)) {
      setAvatarError('Choose a JPG, PNG, or WEBP image.');
      return;
    }
    if (file.size > BARBER_AVATAR_MAX_SIZE_BYTES) {
      setAvatarError('Image is too large. Maximum size is 5MB.');
      return;
    }
    const localPreviewUrl = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarPreviewUrl(localPreviewUrl);
    setAvatarError('');
  }

  function clearAvatar() {
    setAvatarFile(null);
    setAvatarPreviewUrl(prefillFromInitial && initialAvatarUrl ? initialAvatarUrl : '');
    setAvatarError('');
  }

  function toggleService(id: string) {
    setSelectedServiceIds((current) =>
      current.includes(id) ? current.filter((serviceId) => serviceId !== id) : [...current, id]
    );
    clearFieldError('services');
  }

  async function saveSetupMember() {
    if (finished || submissionInFlightRef.current) return;
    if (!submissionGateRef.current.tryBegin()) return;
    submissionInFlightRef.current = true;

    for (const validationStep of [1, 2, 3] as BarberWizardStep[]) {
      const nextErrors = validateBarberWizardStep(validationStep, name, selectedServiceIds, workingHours);
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        setStep(validationStep);
        submissionGateRef.current.release();
        submissionInFlightRef.current = false;
        return;
      }
    }

    if (!memberId) {
      submissionGateRef.current.release();
      submissionInFlightRef.current = false;
      setSubmitError('Missing team member id.');
      return;
    }

    const trimmedName = name.trim();
    const uniqueServiceIds = Array.from(new Set(selectedServiceIds));

    setIsSaving(true);
    setSubmitError('');
    setRefreshWarning('');

    try {
      const formData = new FormData();
      formData.set('displayName', trimmedName);
      formData.set('serviceIds', JSON.stringify(uniqueServiceIds));
      formData.set(
        'workingHours',
        JSON.stringify(
          workingHours.map((row) => ({
            dayOfWeek: row.dayOfWeek,
            startMinutes: timeToMinutes(row.startTime),
            endMinutes: timeToMinutes(row.endTime),
            active: row.active
          }))
        )
      );
      if (avatarFile) formData.set('avatar', avatarFile);

      const response = await fetch(`/api/admin/team/members/${memberId}/booking-profile`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        barber?: {
          id?: string;
          name?: string;
          avatarUrl?: string | null;
          email?: string | null;
          serviceIds?: string[];
          active?: boolean;
        };
      };

      if (!response.ok || response.status !== 201) {
        throw new Error(payload.error || 'Could not set up online bookings.');
      }

      const saved = payload.barber;
      if (!saved?.id) {
        throw new Error('Online bookings were set up but the response was missing an id.');
      }

      const result: SetupMemberSavedResult = {
        barberId: saved.id,
        name: saved.name ?? trimmedName,
        avatarUrl: saved.avatarUrl ?? null,
        email: saved.email ?? null,
        serviceIds: Array.isArray(saved.serviceIds) ? saved.serviceIds : uniqueServiceIds,
        active: saved.active ?? true
      };

      setFinished(true);
      submissionGateRef.current.markFinished();

      try {
        const ok = await onSaved(result);
        if (ok === false) {
          setRefreshWarning(TEAM_SETUP_ONLINE_BOOKINGS_REFRESH_WARNING);
        }
      } catch {
        setRefreshWarning(TEAM_SETUP_ONLINE_BOOKINGS_REFRESH_WARNING);
      }
    } catch (error) {
      submissionGateRef.current.release();
      submissionInFlightRef.current = false;
      setSubmitError(
        error instanceof Error ? error.message : 'Could not set up online bookings.'
      );
    } finally {
      submissionInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  async function saveBarber() {
    for (const validationStep of [1, 2, 3] as BarberWizardStep[]) {
      const nextErrors = validateBarberWizardStep(validationStep, name, selectedServiceIds, workingHours);
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        setStep(validationStep);
        return;
      }
    }

    if (isEdit && !barberId) {
      setSubmitError('Missing barber id.');
      return;
    }

    const trimmedName = name.trim();
    const uniqueServiceIds = Array.from(new Set(selectedServiceIds));
    const rulesSorted = [...workingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    setIsSaving(true);
    setSubmitError('');
    setScheduleWarning('');

    try {
      const formData = new FormData();
      if (isEdit && barberId) formData.set('id', barberId);
      formData.set('name', trimmedName);
      formData.set('isActive', String(isEdit ? initialIsActive : true));
      formData.set('serviceIds', JSON.stringify(uniqueServiceIds));
      if (avatarFile) formData.set('avatar', avatarFile);

      const response = await fetch('/api/admin/barbers', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        barber?: { id?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error || (isEdit ? 'Could not update barber.' : 'Could not save barber.'));
      }

      const savedBarberId = isEdit ? barberId : payload.barber?.id;
      if (!savedBarberId) {
        throw new Error('Barber was saved but the response was missing an id.');
      }

      const rulesResponse = await fetch(`/api/admin/barbers/${savedBarberId}/rules`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rules: rulesSorted })
      });
      const rulesPayload = (await rulesResponse.json().catch(() => ({}))) as { error?: string };

      await onSaved();

      if (!rulesResponse.ok) {
        setScheduleWarning(
          rulesPayload.error ??
            (isEdit
              ? 'Working hours could not be saved. Try again from the barber profile.'
              : 'Working hours could not be saved. Open the barber profile to set their schedule.')
        );
      }

      setFinished(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : (isEdit ? 'Could not update barber.' : 'Could not save barber.'));
    } finally {
      setIsSaving(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (finished) {
      onCancel();
      return;
    }
    if (step === 4) {
      if (isSetupMember) {
        if (submissionInFlightRef.current || submissionGateRef.current.isInFlight()) return;
        void saveSetupMember();
      } else {
        void saveBarber();
      }
      return;
    }
    validateAndContinue();
  }

  const weeklySummary = useMemo(() => getWeeklyHoursSummary(workingHours), [workingHours]);
  const selectedServiceNames = services
    .filter((service) => selectedServiceIds.includes(service.id))
    .map((service) => service.name);
  const summaryBits = [
    name.trim(),
    selectedServiceIds.length ? `${selectedServiceIds.length} service${selectedServiceIds.length === 1 ? '' : 's'}` : '',
    weeklySummary.onShiftDays ? `${weeklySummary.hoursLabel}/week` : ''
  ].filter(Boolean);

  return (
    <form
      className={`admin-barber-sheet admin-barber-sheet--add admin-barber-wizard${isEdit ? ' admin-barber-wizard--edit' : ''}${isSetupMember ? ' admin-barber-wizard--setup-member' : ''}`}
      onSubmit={handleSubmit}
      onMouseDown={(event) => event.stopPropagation()}
      noValidate
    >
      <header className="admin-barber-wizard__header">
        <div className="admin-barber-wizard__header-copy">
          <p>{isSetupMember ? 'ONLINE BOOKINGS' : isEdit ? 'EDIT BARBER' : 'ADD BARBER'}</p>
          <h2 id="admin-barber-form-title">
            {finished
              ? isSetupMember
                ? 'Online bookings ready'
                : 'Barber ready'
              : isSetupMember
                ? 'Set up online bookings'
                : isEdit
                  ? 'Update team member'
                  : 'Build a team member'}
          </h2>
          {isSetupMember && !finished ? (
            <p>Add services and working hours so clients can book this team member online.</p>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn--ghost admin-barber-wizard__close"
          onClick={onCancel}
          disabled={isSaving}
          aria-label="Close barber wizard"
        >
          <X width={18} height={18} aria-hidden="true" />
        </button>
      </header>

      {!finished ? (
        <>
          <nav className="admin-barber-wizard__progress" aria-label="Barber setup progress">
            <ol style={{ gridTemplateColumns: `repeat(${BARBER_WIZARD_STEPS.length}, minmax(0, 1fr))` }}>
              {BARBER_WIZARD_STEPS.map((item) => {
                const complete = item.number < step;
                const current = item.number === step;
                return (
                  <li key={item.number} className={`${complete ? 'is-complete' : ''}${current ? ' is-current' : ''}`}>
                    <button
                      type="button"
                      onClick={() => complete && moveToStep(item.number)}
                      disabled={!complete}
                      aria-current={current ? 'step' : undefined}
                      aria-label={`${item.label}${complete ? ', completed' : current ? ', current step' : ''}`}
                    >
                      <span>{complete ? <Check aria-hidden="true" /> : item.number}</span>
                      <small>{item.label}</small>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="admin-barber-wizard__live-summary" aria-live="polite">
            <Users width={16} height={16} aria-hidden="true" />
            <span>{summaryBits.length ? summaryBits.join(' · ') : 'Your barber will take shape here as you go.'}</span>
          </div>
        </>
      ) : null}

      <div className="admin-barber-wizard__content">
        {submitError ? (
          <p className="admin-barber-wizard__error" role="alert">
            {submitError}
          </p>
        ) : null}

        {finished ? (
          <section className="admin-barber-wizard__success" role="status" aria-live="polite">
            <ConfirmationStatusIcon variant="success" />
            <p className="admin-barber-wizard__eyebrow">
              {isSetupMember ? 'Ready' : isEdit ? 'Updated' : 'Created'}
            </p>
            <h3>
              {isSetupMember ? 'Online bookings ready' : `${name.trim()} is ready`}
            </h3>
            <p>
              {isSetupMember
                ? refreshWarning ||
                  'This team member is now available in the client booking flow.'
                : scheduleWarning
                  ? scheduleWarning
                  : isEdit
                    ? 'Their roster profile has been updated.'
                    : 'They are live on the roster and ready to take bookings.'}
            </p>
          </section>
        ) : null}

        {!finished && step === 1 ? (
          <section className="admin-barber-wizard__step" aria-labelledby="barber-wizard-basics-title">
            <div className="admin-barber-wizard__intro">
              <p className="admin-barber-wizard__eyebrow">STEP 1 · BASICS</p>
              <h3 id="barber-wizard-basics-title" ref={stepHeadingRef} tabIndex={-1}>
                Who&apos;s joining the chair?
              </h3>
              <p>Give them a clear name and an optional photo for the roster.</p>
            </div>

            <div className={`field${errors.name ? ' field--error' : ''}`}>
              <label className="field__label" htmlFor="barber-wizard-name">
                Barber name
              </label>
              <input
                id="barber-wizard-name"
                className={`input${errors.name ? ' input--error' : ''}`}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  clearFieldError('name');
                }}
                placeholder="e.g. Marco"
                maxLength={120}
                autoFocus
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'barber-wizard-name-error' : undefined}
              />
              <FieldError id="barber-wizard-name-error">{errors.name}</FieldError>
            </div>

            <div className="field admin-barber-wizard__image-field">
              <span className="field__label">
                Photo <span className="field__hint">(optional)</span>
              </span>
              <span className="field__hint">JPG, PNG or WEBP · max 5MB</span>
              <input
                id="barber-wizard-avatar"
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={isSaving}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) handleAvatarFile(file);
                }}
              />
              <label
                className={`admin-barber-wizard__image-upload${avatarPreviewUrl ? ' has-preview' : ''}`}
                htmlFor="barber-wizard-avatar"
              >
                {avatarPreviewUrl ? (
                  <img src={avatarPreviewUrl} alt="" />
                ) : (
                  <span className="admin-barber-wizard__image-empty">
                    <ImagePlus width={24} height={24} aria-hidden="true" />
                    <strong>Add a photo</strong>
                    <small>Optional — helps clients recognise them</small>
                  </span>
                )}
                {avatarPreviewUrl ? <span className="admin-barber-wizard__image-overlay">Change photo</span> : null}
              </label>
              {avatarPreviewUrl ? (
                <button type="button" className="admin-barber-wizard__image-remove" onClick={clearAvatar}>
                  Remove photo
                </button>
              ) : null}
              {avatarError ? (
                <p className="field__error" role="alert">
                  {avatarError}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {!finished && step === 2 ? (
          <section className="admin-barber-wizard__step" aria-labelledby="barber-wizard-services-title">
            <div className="admin-barber-wizard__intro">
              <p className="admin-barber-wizard__eyebrow">STEP 2 · SERVICES</p>
              <h3 id="barber-wizard-services-title" ref={stepHeadingRef} tabIndex={-1}>
                What can they offer?
              </h3>
              <p>Choose every service this barber can be booked for.</p>
            </div>

            <div className="admin-barber-wizard__assignment">
              <div className="admin-barber-wizard__assignment-head">
                <div>
                  <p className="admin-barber-wizard__field-title">Available services</p>
                  <p className="admin-barber-wizard__field-hint">Select at least one service for the booking flow.</p>
                </div>
                <div className="admin-barber-wizard__assignment-tools" aria-label="Service selection tools">
                  <span>
                    {selectedServiceIds.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServiceIds(services.map((service) => service.id));
                      clearFieldError('services');
                    }}
                    disabled={!services.length || selectedServiceIds.length === services.length}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServiceIds([]);
                      clearFieldError('services');
                    }}
                    disabled={!selectedServiceIds.length}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {!services.length ? (
                <EmptyState
                  icon={Scissors}
                  title="No services available"
                  description="Add services first, then return here to assign them."
                />
              ) : (
                <div className="admin-barber-wizard__services-grid" role="list" aria-label="Available services">
                  {services.map((service) => {
                    const selected = selectedServiceIds.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        role="listitem"
                        className={`admin-barber-wizard__service${selected ? ' is-selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() => toggleService(service.id)}
                      >
                        <span className="admin-barber-wizard__service-check" aria-hidden="true">
                          {selected ? <Check width={12} height={12} strokeWidth={2.5} /> : null}
                        </span>
                        <span>{service.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <FieldError id="barber-wizard-services-error">{errors.services}</FieldError>
            </div>
          </section>
        ) : null}

        {!finished && step === 3 ? (
          <section className="admin-barber-wizard__step" aria-labelledby="barber-wizard-schedule-title">
            <div className="admin-barber-wizard__intro">
              <p className="admin-barber-wizard__eyebrow">STEP 3 · SCHEDULE</p>
              <h3 id="barber-wizard-schedule-title" ref={stepHeadingRef} tabIndex={-1}>
                When are they on shift?
              </h3>
              <p>Set the weekly hours saved with this barber.</p>
            </div>

            <BarberWorkingHoursEditor
              weekDays={[...weekDays]}
              workingHours={workingHours}
              loading={false}
              saving={false}
              saveError=""
              persistToServer={false}
              subtitle={
                isSetupMember
                  ? 'Saved when you set up online bookings.'
                  : isEdit
                    ? 'Saved together with this barber when you update them.'
                    : 'Saved together with this barber when you create them.'
              }
              helperText="Tap any day to change shift status and hours."
              onSetWorkingHours={(rules) => {
                setWorkingHours(rules);
                clearFieldError('schedule');
              }}
              onSave={async () => true}
            />
            <FieldError id="barber-wizard-schedule-error">{errors.schedule}</FieldError>
          </section>
        ) : null}

        {!finished && step === 4 ? (
          <section className="admin-barber-wizard__step" aria-labelledby="barber-wizard-review-title">
            <div className="admin-barber-wizard__intro">
              <p className="admin-barber-wizard__eyebrow">STEP 4 · REVIEW</p>
              <h3 id="barber-wizard-review-title" ref={stepHeadingRef} tabIndex={-1}>
                {isSetupMember ? 'Ready for online bookings' : 'Ready for the roster'}
              </h3>
              <p>
                {isSetupMember
                  ? 'Take one last look before making this team member bookable online.'
                  : 'Take one last look. You can jump back to any section before saving.'}
              </p>
            </div>

            <div className="admin-barber-wizard__review">
              <section>
                <div className="admin-barber-wizard__review-head">
                  <h4>Barber</h4>
                  <button type="button" onClick={() => moveToStep(1)}>
                    Edit
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>Photo</dt>
                    <dd>
                      {avatarPreviewUrl ? (
                        <img className="admin-barber-wizard__review-image" src={avatarPreviewUrl} alt="" />
                      ) : (
                        'No photo'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Name</dt>
                    <dd>{name.trim()}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <div className="admin-barber-wizard__review-head">
                  <h4>Services</h4>
                  <button type="button" onClick={() => moveToStep(2)}>
                    Edit
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>Assigned</dt>
                    <dd>{selectedServiceNames.length ? selectedServiceNames.join(', ') : 'None'}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <div className="admin-barber-wizard__review-head">
                  <h4>Schedule</h4>
                  <button type="button" onClick={() => moveToStep(3)}>
                    Edit
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>On shift</dt>
                    <dd>
                      {weeklySummary.onShiftDays} day{weeklySummary.onShiftDays === 1 ? '' : 's'} ·{' '}
                      {weeklySummary.hoursLabel}/week
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </section>
        ) : null}
      </div>

      <footer className="admin-barber-wizard__footer">
        {finished ? (
          <button type="submit" className="btn btn--primary btn--lg">
            Done
          </button>
        ) : (
          <>
            {step > 1 ? (
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => moveToStep((step - 1) as BarberWizardStep)}
                disabled={isSaving}
              >
                Back
              </button>
            ) : null}
            <button type="submit" className="btn btn--primary" disabled={isSaving}>
              {isSaving ? (
                <>
                  <ButtonSpinner />
                  {isSetupMember ? 'Setting up…' : isEdit ? 'Updating…' : 'Creating…'}
                </>
              ) : step === 4 ? (
                isSetupMember ? 'Set up online bookings' : isEdit ? 'Update barber' : 'Create barber'
              ) : (
                'Continue'
              )}
            </button>
          </>
        )}
      </footer>
    </form>
  );
}
