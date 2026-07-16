import React, { useEffect, useRef, useState } from 'react';
import { ButtonSpinner } from '../../ButtonSpinner';
import { ConfirmationStatusIcon } from '../../ConfirmationStatusIcon';
import EmptyState from '../../EmptyState';
import { Check, Clock, ImagePlus, Scissors, Users, X } from '../../lucide-react';
import { adminFetchJson } from '../adminAuth';
import ServiceCategoryPicker from '../ServiceCategoryPicker';
import {
  EMPTY_SERVICE_FORM,
  SERVICE_WIZARD_STEPS,
  formatGbp,
  parseGbpToPence,
  validateServiceWizardStep,
  type ServiceForm,
  type ServiceWizardBarber,
  type ServiceWizardErrors,
  type ServiceWizardMode,
  type ServiceWizardStep
} from './serviceWizardTypes';

const SERVICE_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const SERVICE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type ServiceWizardProps = {
  mode: ServiceWizardMode;
  serviceId?: string;
  initialForm?: ServiceForm;
  initialBarberIds?: string[];
  categories: string[];
  barbers: ServiceWizardBarber[];
  isLoadingBarbers: boolean;
  onAddCategory: (name: string) => Promise<void>;
  onCancel: () => void;
  onSaved: (result: { mode: ServiceWizardMode; categories?: string[] }) => void | Promise<void>;
};

type AssignmentProps = {
  barbers: ServiceWizardBarber[];
  selectedIds: string[];
  isLoading: boolean;
  onChange: (ids: string[]) => void;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.length ? parts.map((part) => part.charAt(0).toUpperCase()).join('') : 'B';
}

function BarberAssignment({ barbers, selectedIds, isLoading, onChange }: AssignmentProps) {
  const selectedSet = new Set(selectedIds);
  const sortedBarbers = [...barbers].sort((left, right) => {
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
    return left.name.localeCompare(right.name, 'en', { sensitivity: 'base' });
  });
  const availableIds = sortedBarbers.map((barber) => barber.id);
  const selectedCount = selectedIds.filter((id) => availableIds.includes(id)).length;

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id]);
  }

  return (
    <div className="admin-service-wizard__assignment">
      <div className="admin-service-wizard__assignment-head">
        <div>
          <p className="admin-service-wizard__field-title">Available barbers</p>
          <p className="admin-service-wizard__field-hint">Choose everyone who can be booked for this service.</p>
        </div>
        <div className="admin-service-wizard__assignment-tools" aria-label="Barber selection tools">
          <span>{selectedCount} selected</span>
          <button
            type="button"
            onClick={() => onChange(availableIds)}
            disabled={!availableIds.length || selectedCount === availableIds.length}
          >
            Select all
          </button>
          <button type="button" onClick={() => onChange([])} disabled={!selectedCount}>
            Clear
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="admin-service-wizard__barber-loading" aria-label="Loading barbers">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="skeleton skeleton--row" key={index} />
          ))}
        </div>
      ) : null}

      {!isLoading && !sortedBarbers.length ? (
        <EmptyState
          icon={Users}
          title="No barbers available"
          description="Add barbers first, then return here to assign this service."
        />
      ) : null}

      {!isLoading && sortedBarbers.length ? (
        <div className="admin-service-wizard__barber-list" role="list" aria-label="Available barbers">
          {sortedBarbers.map((barber) => {
            const selected = selectedSet.has(barber.id);
            return (
              <button
                key={barber.id}
                type="button"
                role="listitem"
                className={`admin-service-wizard__barber${selected ? ' is-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => toggle(barber.id)}
              >
                <span className="admin-service-wizard__barber-main">
                  <span className="admin-service-wizard__avatar" aria-hidden="true">
                    {barber.avatarUrl ? <img src={barber.avatarUrl} alt="" /> : getInitials(barber.name)}
                  </span>
                  <span>
                    <strong>{barber.name}</strong>
                    <small>{barber.isActive ? 'Available for bookings' : 'Currently inactive'}</small>
                  </span>
                </span>
                <span className="admin-service-wizard__barber-check" aria-hidden="true">
                  {selected ? <Check /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="field__error" role="alert">
      {children}
    </p>
  );
}

export default function ServiceWizard({
  mode,
  serviceId,
  initialForm = EMPTY_SERVICE_FORM,
  initialBarberIds = [],
  categories,
  barbers,
  isLoadingBarbers,
  onAddCategory,
  onCancel,
  onSaved
}: ServiceWizardProps) {
  const [step, setStep] = useState<ServiceWizardStep>(1);
  const [form, setForm] = useState<ServiceForm>(() => ({ ...initialForm }));
  const [selectedBarberIds, setSelectedBarberIds] = useState<string[]>(() => [...initialBarberIds]);
  const [errors, setErrors] = useState<ServiceWizardErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState(initialForm.imageUrl);
  const [finished, setFinished] = useState(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const isBusy = isSaving || isUploadingImage;

  useEffect(() => {
    if (!finished) stepHeadingRef.current?.focus();
  }, [finished, step]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl.startsWith('blob:')) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  function updateField<Key extends keyof ServiceForm>(key: Key, value: ServiceForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key in errors) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
    if (submitError) setSubmitError('');
  }

  function moveToStep(nextStep: ServiceWizardStep) {
    setErrors({});
    setSubmitError('');
    setStep(nextStep);
  }

  function validateAndContinue() {
    const nextErrors = validateServiceWizardStep(step, form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (step < 4) moveToStep((step + 1) as ServiceWizardStep);
  }

  async function uploadServiceImage(file: File) {
    if (!SERVICE_IMAGE_TYPES.has(file.type)) {
      setImageError('Choose a JPG, PNG, WEBP, or GIF image.');
      return;
    }
    if (file.size > SERVICE_IMAGE_MAX_SIZE_BYTES) {
      setImageError('Image is too large. Maximum size is 5MB.');
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(localPreviewUrl);
    setImageError('');
    setIsUploadingImage(true);

    const body = new FormData();
    body.set('file', file);

    try {
      const data = await adminFetchJson<{ url?: string }>('/api/admin/services/upload-image', {
        method: 'POST',
        body,
        errorMessage: 'Could not upload service image.'
      });
      if (!data.url) throw new Error('Upload failed. Invalid response.');
      updateField('imageUrl', data.url);
      setImagePreviewUrl(data.url);
    } catch (error) {
      setImagePreviewUrl(form.imageUrl);
      setImageError(error instanceof Error ? error.message : 'Could not upload service image.');
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function saveService() {
    if (isUploadingImage) return;

    for (const validationStep of [1, 2] as ServiceWizardStep[]) {
      const nextErrors = validateServiceWizardStep(validationStep, form);
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        setStep(validationStep);
        return;
      }
    }

    const endpoint = mode === 'edit' && serviceId ? `/api/admin/services/${serviceId}` : '/api/admin/services';
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      category: form.category.trim(),
      pricePence: parseGbpToPence(form.priceGbp),
      durationMinutes: Number(form.durationMinutes),
      bufferMinutes: Number(form.bufferMinutes),
      displayOrder: Number(form.displayOrder),
      isActive: form.isActive,
      featured: form.featured,
      barberIds: selectedBarberIds
    };

    setIsSaving(true);
    setSubmitError('');
    try {
      const data = await adminFetchJson<{ categories?: string[] }>(endpoint, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        errorMessage: 'Unable to save service.'
      });
      await onSaved({ mode, categories: data.categories });
      setFinished(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save service.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUploadingImage) return;
    if (finished) {
      onCancel();
      return;
    }
    if (step === 4) {
      void saveService();
      return;
    }
    validateAndContinue();
  }

  const pricePence = parseGbpToPence(form.priceGbp);
  const summaryBits = [
    form.name.trim(),
    form.category.trim(),
    pricePence >= 0 && form.priceGbp.trim() ? formatGbp(pricePence) : '',
    form.durationMinutes ? `${form.durationMinutes} min` : ''
  ].filter(Boolean);
  const selectedBarberNames = barbers
    .filter((barber) => selectedBarberIds.includes(barber.id))
    .map((barber) => barber.name);

  return (
    <form
      className="admin-barber-sheet admin-service-sheet admin-service-wizard"
      onSubmit={handleSubmit}
      onMouseDown={(event) => event.stopPropagation()}
      noValidate
    >
      <header className="admin-service-wizard__header">
        <div className="admin-service-wizard__header-copy">
          <p>{mode === 'edit' ? 'EDIT SERVICE' : 'ADD SERVICE'}</p>
          <h2 id="admin-service-form-title">{finished ? 'Service ready' : 'Build a bookable service'}</h2>
        </div>
        <button
          type="button"
          className="btn btn--ghost admin-service-wizard__close"
          onClick={onCancel}
          disabled={isBusy}
          aria-label="Close service wizard"
        >
          <X width={18} height={18} aria-hidden="true" />
        </button>
      </header>

      {!finished ? (
        <>
          <nav className="admin-service-wizard__progress" aria-label="Service setup progress">
            <ol>
              {SERVICE_WIZARD_STEPS.map((item) => {
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

          <div className="admin-service-wizard__live-summary" aria-live="polite">
            <Scissors width={16} height={16} aria-hidden="true" />
            <span>{summaryBits.length ? summaryBits.join(' · ') : 'Your service will take shape here as you go.'}</span>
          </div>
        </>
      ) : null}

      <div className="admin-service-wizard__content">
        {submitError ? (
          <p className="admin-service-wizard__error" role="alert">
            {submitError}
          </p>
        ) : null}

        {finished ? (
          <section className="admin-service-wizard__success" role="status" aria-live="polite">
            <ConfirmationStatusIcon variant="success" />
            <p className="admin-service-wizard__eyebrow">{mode === 'edit' ? 'Updated' : 'Created'}</p>
            <h3>{form.name.trim()} is ready</h3>
            <p>
              {form.isActive
                ? 'It is live and ready to appear in the booking flow.'
                : 'It has been saved as inactive and can be published whenever you are ready.'}
            </p>
          </section>
        ) : null}

        {!finished && step === 1 ? (
          <section className="admin-service-wizard__step" aria-labelledby="service-wizard-basics-title">
            <div className="admin-service-wizard__intro">
              <p className="admin-service-wizard__eyebrow">STEP 1 · BASICS</p>
              <h3 id="service-wizard-basics-title" ref={stepHeadingRef} tabIndex={-1}>
                What will clients book?
              </h3>
              <p>Give the service a clear identity clients can understand at a glance.</p>
            </div>

            <div className={`field${errors.name ? ' field--error' : ''}`}>
              <label className="field__label" htmlFor="service-wizard-name">
                Service name
              </label>
              <input
                id="service-wizard-name"
                className={`input${errors.name ? ' input--error' : ''}`}
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="e.g. Signature haircut"
                maxLength={120}
                autoFocus
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'service-wizard-name-error' : undefined}
              />
              <FieldError id="service-wizard-name-error">{errors.name}</FieldError>
            </div>

            <div className="field admin-service-wizard__image-field">
              <span className="field__label">
                Service image <span className="field__hint">(optional)</span>
              </span>
              <span className="field__hint">JPG, PNG, WEBP or GIF · max 5MB</span>
              <input
                id="service-wizard-image"
                className="sr-only"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.gif"
                disabled={isBusy}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void uploadServiceImage(file);
                }}
              />
              <label
                className={`admin-service-wizard__image-upload${imagePreviewUrl ? ' has-preview' : ''}`}
                htmlFor="service-wizard-image"
                aria-busy={isUploadingImage}
              >
                {imagePreviewUrl ? (
                  <img src={imagePreviewUrl} alt="" />
                ) : (
                  <span className="admin-service-wizard__image-empty">
                    <ImagePlus width={24} height={24} aria-hidden="true" />
                    <strong>Add a service image</strong>
                    <small>Choose a clear photo clients will recognise</small>
                  </span>
                )}
                {isUploadingImage ? (
                  <span className="admin-service-wizard__image-overlay">
                    <ButtonSpinner />
                    Uploading…
                  </span>
                ) : imagePreviewUrl ? (
                  <span className="admin-service-wizard__image-overlay">Change image</span>
                ) : null}
              </label>
              {imagePreviewUrl && !isUploadingImage ? (
                <button
                  type="button"
                  className="admin-service-wizard__image-remove"
                  onClick={() => {
                    updateField('imageUrl', '');
                    setImagePreviewUrl('');
                    setImageError('');
                  }}
                >
                  Remove image
                </button>
              ) : null}
              {imageError ? (
                <p className="field__error" role="alert">
                  {imageError}
                </p>
              ) : null}
            </div>

            <div className={`field${errors.description ? ' field--error' : ''}`}>
              <div className="admin-service-wizard__label-row">
                <label className="field__label" htmlFor="service-wizard-description">
                  Description <span className="field__hint">(optional)</span>
                </label>
                <span>{form.description.length}/280</span>
              </div>
              <textarea
                id="service-wizard-description"
                className={`input admin-service-wizard__textarea${errors.description ? ' input--error' : ''}`}
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="What makes this service worth booking?"
                maxLength={280}
                rows={3}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? 'service-wizard-description-error' : undefined}
              />
              <FieldError id="service-wizard-description-error">{errors.description}</FieldError>
            </div>

            <div className={`field${errors.category ? ' field--error' : ''}`}>
              <span className="field__label">Category</span>
              <span className="field__hint">Choose the best fit or create your own.</span>
              <ServiceCategoryPicker
                value={form.category}
                onChange={(category) => updateField('category', category)}
                categories={categories}
                onAddCategory={onAddCategory}
                hasError={Boolean(errors.category)}
                disabled={isBusy}
              />
              <FieldError id="service-wizard-category-error">{errors.category}</FieldError>
            </div>
          </section>
        ) : null}

        {!finished && step === 2 ? (
          <section className="admin-service-wizard__step" aria-labelledby="service-wizard-pricing-title">
            <div className="admin-service-wizard__intro">
              <p className="admin-service-wizard__eyebrow">STEP 2 · PRICING</p>
              <h3 id="service-wizard-pricing-title" ref={stepHeadingRef} tabIndex={-1}>
                Set the value and pace
              </h3>
              <p>Define what clients pay and how much diary time the appointment needs.</p>
            </div>

            <div className={`field${errors.priceGbp ? ' field--error' : ''}`}>
              <label className="field__label" htmlFor="service-wizard-price">
                Price
              </label>
              <div className={`admin-price-input-wrap admin-service-wizard__price${errors.priceGbp ? ' admin-price-input-wrap--error' : ''}`}>
                <span>£</span>
                <input
                  id="service-wizard-price"
                  inputMode="decimal"
                  value={form.priceGbp}
                  onChange={(event) => updateField('priceGbp', event.target.value)}
                  placeholder="0.00"
                  autoFocus
                  aria-invalid={Boolean(errors.priceGbp)}
                />
              </div>
              <FieldError id="service-wizard-price-error">{errors.priceGbp}</FieldError>
            </div>

            <div className={`field${errors.durationMinutes ? ' field--error' : ''}`}>
              <span className="field__label">Appointment duration</span>
              <div className="admin-service-wizard__duration-options" role="group" aria-label="Appointment duration">
                {[15, 30, 45, 60].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={`admin-service-wizard__duration${form.durationMinutes === String(minutes) ? ' is-selected' : ''}`}
                    aria-pressed={form.durationMinutes === String(minutes)}
                    onClick={() => updateField('durationMinutes', String(minutes))}
                  >
                    <Clock width={16} height={16} aria-hidden="true" />
                    {minutes} min
                  </button>
                ))}
              </div>
              <label className="field__hint" htmlFor="service-wizard-duration">
                Or enter a custom duration
              </label>
              <div className="admin-service-wizard__number-with-unit">
                <input
                  id="service-wizard-duration"
                  className={`input${errors.durationMinutes ? ' input--error' : ''}`}
                  type="number"
                  min={5}
                  max={480}
                  value={form.durationMinutes}
                  onChange={(event) => updateField('durationMinutes', event.target.value)}
                  aria-invalid={Boolean(errors.durationMinutes)}
                />
                <span>minutes</span>
              </div>
              <FieldError id="service-wizard-duration-error">{errors.durationMinutes}</FieldError>
            </div>
          </section>
        ) : null}

        {!finished && step === 3 ? (
          <section className="admin-service-wizard__step" aria-labelledby="service-wizard-team-title">
            <div className="admin-service-wizard__intro">
              <p className="admin-service-wizard__eyebrow">STEP 3 · TEAM</p>
              <h3 id="service-wizard-team-title" ref={stepHeadingRef} tabIndex={-1}>
                Decide who can offer it
              </h3>
              <p>Assign the right team members and choose whether clients can see it now.</p>
            </div>

            <BarberAssignment
              barbers={barbers}
              selectedIds={selectedBarberIds}
              isLoading={isLoadingBarbers}
              onChange={setSelectedBarberIds}
            />

            <div className="admin-service-wizard__visibility">
              <div>
                <p className="admin-service-wizard__field-title">Featured in category</p>
                <p className="admin-service-wizard__field-hint">
                  {form.featured
                    ? 'This service appears first in its category during booking.'
                    : 'Pin one service per category to the top of the booking list.'}
                </p>
              </div>
              <label className="admin-service-switch-wrap" htmlFor="service-wizard-featured">
                <input
                  id="service-wizard-featured"
                  type="checkbox"
                  className="admin-service-switch-input"
                  checked={form.featured}
                  onChange={(event) => updateField('featured', event.target.checked)}
                />
                <span className="admin-service-switch-track" aria-hidden="true">
                  <span className="admin-service-switch-thumb" />
                </span>
                <span className="admin-service-switch-label">{form.featured ? 'Featured' : 'Standard'}</span>
              </label>
            </div>

            <div className="admin-service-wizard__visibility">
              <div>
                <p className="admin-service-wizard__field-title">Publish in bookings</p>
                <p className="admin-service-wizard__field-hint">
                  {form.isActive ? 'Clients can find and book this service.' : 'Saved privately until you publish it.'}
                </p>
              </div>
              <label className="admin-service-switch-wrap" htmlFor="service-wizard-active">
                <input
                  id="service-wizard-active"
                  type="checkbox"
                  className="admin-service-switch-input"
                  checked={form.isActive}
                  onChange={(event) => updateField('isActive', event.target.checked)}
                />
                <span className="admin-service-switch-track" aria-hidden="true">
                  <span className="admin-service-switch-thumb" />
                </span>
                <span className="admin-service-switch-label">{form.isActive ? 'Live' : 'Hidden'}</span>
              </label>
            </div>
          </section>
        ) : null}

        {!finished && step === 4 ? (
          <section className="admin-service-wizard__step" aria-labelledby="service-wizard-review-title">
            <div className="admin-service-wizard__intro">
              <p className="admin-service-wizard__eyebrow">STEP 4 · REVIEW</p>
              <h3 id="service-wizard-review-title" ref={stepHeadingRef} tabIndex={-1}>
                Ready for the chair
              </h3>
              <p>Take one last look. You can jump back to any section before saving.</p>
            </div>

            <div className="admin-service-wizard__review">
              <section>
                <div className="admin-service-wizard__review-head">
                  <h4>Service</h4>
                  <button type="button" onClick={() => moveToStep(1)}>Edit</button>
                </div>
                <dl>
                  <div>
                    <dt>Image</dt>
                    <dd>
                      {form.imageUrl ? (
                        <img className="admin-service-wizard__review-image" src={form.imageUrl} alt="" />
                      ) : (
                        'No image'
                      )}
                    </dd>
                  </div>
                  <div><dt>Name</dt><dd>{form.name.trim()}</dd></div>
                  <div><dt>Category</dt><dd>{form.category.trim()}</dd></div>
                  {form.description.trim() ? <div><dt>Description</dt><dd>{form.description.trim()}</dd></div> : null}
                </dl>
              </section>

              <section>
                <div className="admin-service-wizard__review-head">
                  <h4>Price &amp; time</h4>
                  <button type="button" onClick={() => moveToStep(2)}>Edit</button>
                </div>
                <dl>
                  <div><dt>Price</dt><dd>{formatGbp(pricePence)}</dd></div>
                  <div><dt>Appointment</dt><dd>{form.durationMinutes} min</dd></div>
                </dl>
              </section>

              <section>
                <div className="admin-service-wizard__review-head">
                  <h4>Team &amp; visibility</h4>
                  <button type="button" onClick={() => moveToStep(3)}>Edit</button>
                </div>
                <dl>
                  <div>
                    <dt>Barbers</dt>
                    <dd>{selectedBarberNames.length ? selectedBarberNames.join(', ') : 'Not assigned'}</dd>
                  </div>
                  <div><dt>Status</dt><dd>{form.isActive ? 'Live' : 'Hidden'}</dd></div>
                  <div><dt>Featured</dt><dd>{form.featured ? 'Yes' : 'No'}</dd></div>
                </dl>
              </section>
            </div>
          </section>
        ) : null}
      </div>

      <footer className="admin-service-wizard__footer">
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
                onClick={() => moveToStep((step - 1) as ServiceWizardStep)}
                disabled={isBusy}
              >
                Back
              </button>
            ) : null}
            <button type="submit" className="btn btn--primary" disabled={isBusy}>
              {isSaving ? (
                <>
                  <ButtonSpinner />
                  {mode === 'edit' ? 'Updating…' : 'Creating…'}
                </>
              ) : step === 4 ? (
                mode === 'edit' ? 'Update service' : 'Create service'
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
