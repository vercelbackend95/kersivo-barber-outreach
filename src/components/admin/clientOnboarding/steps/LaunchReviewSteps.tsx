import React from 'react';
import { TextArea, TextInput } from '../fields';
import { PrivateAssetUploader } from '../PrivateAssetUploader';
import {
  DAY_LABELS,
  domainModeLabel,
  formatGbp,
  minutesToTime,
  type ClientOnboardingState,
  type DraftFields,
} from '../types';

type Common = {
  draft: DraftFields;
  state: ClientOnboardingState;
  disabled?: boolean;
  updateDraft: (patch: Partial<DraftFields>) => void;
  reload: () => Promise<void>;
  onEditStep?: (step: number) => void;
};

export function MigrationStep({ draft, state, disabled, updateDraft, reload }: Common) {
  return (
    <section className="client-onboarding__section">
      <h1 className="admin-onboarding__title">Moving from another system</h1>
      <p className="admin-onboarding__description">
        Are you moving from another booking system?
      </p>
      <div className="client-onboarding__choice-stack" role="radiogroup" aria-label="Migration">
        <button
          type="button"
          role="radio"
          aria-checked={draft.migrationRequested === true}
          className={`client-onboarding__choice${draft.migrationRequested === true ? ' is-selected' : ''}`}
          disabled={disabled}
          onClick={() => updateDraft({ migrationRequested: true })}
        >
          <div>
            <p className="client-onboarding__choice-title">Yes</p>
            <p className="client-onboarding__choice-body">
              We’ll review any export you upload before anything is imported.
            </p>
          </div>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={draft.migrationRequested === false}
          className={`client-onboarding__choice${draft.migrationRequested === false ? ' is-selected' : ''}`}
          disabled={disabled}
          onClick={() =>
            updateDraft({
              migrationRequested: false,
              migrationDataConfirmedLawful: false,
            })
          }
        >
          <div>
            <p className="client-onboarding__choice-title">No</p>
            <p className="client-onboarding__choice-body">You’re starting fresh with KERSIVO.</p>
          </div>
        </button>
      </div>

      {draft.migrationRequested === true ? (
        <div className="client-onboarding__section">
          <TextInput
            id="migrationSource"
            label="Current system"
            optional
            hint="e.g. Booksy, Fresha, Timely"
            disabled={disabled}
            value={draft.migrationSource ?? ''}
            onChange={(v) =>
              updateDraft({ migrationSource: v.trim() ? v.trim() : null })
            }
          />
          <TextInput
            id="migrationSourceOther"
            label="Other system name"
            optional
            disabled={disabled}
            value={draft.migrationSourceOther ?? ''}
            onChange={(v) =>
              updateDraft({ migrationSourceOther: v.trim() ? v.trim() : null })
            }
          />
          <TextArea
            id="migrationNotes"
            label="Migration notes"
            optional
            disabled={disabled}
            value={draft.migrationNotes ?? ''}
            onChange={(v) =>
              updateDraft({ migrationNotes: v.trim() ? v.trim() : null })
            }
          />
          <PrivateAssetUploader
            kind="MIGRATION_CSV"
            accept=".csv,text/csv"
            assets={state.assets}
            disabled={disabled}
            hint="Upload an export from your current system if you have one. The file is stored privately and is only used for your setup and migration."
            onChanged={reload}
          />
          <label className="client-onboarding__check-row">
            <input
              type="checkbox"
              checked={draft.migrationDataConfirmedLawful}
              disabled={disabled}
              onChange={(e) =>
                updateDraft({ migrationDataConfirmedLawful: e.target.checked })
              }
            />
            <span>
              I confirm that I’m authorised to provide this customer data to KERSIVO for
              migration.
            </span>
          </label>
        </div>
      ) : null}
    </section>
  );
}

export function LaunchPreferencesStep({ draft, state, disabled, updateDraft }: Common) {
  return (
    <section className="client-onboarding__section">
      <h1 className="admin-onboarding__title">Retail & deposits</h1>
      <p className="admin-onboarding__description">
        Choose what you’d like available when you launch.
      </p>

      <h2 className="client-onboarding__section-title">Retail</h2>
      <p className="admin-onboarding__description">
        Would you like your retail products available from launch?
      </p>
      <div className="client-onboarding__choice-stack" role="radiogroup" aria-label="Retail launch">
        <button
          type="button"
          role="radio"
          aria-checked={draft.launchRetail === true}
          className={`client-onboarding__choice${draft.launchRetail === true ? ' is-selected' : ''}`}
          disabled={disabled}
          onClick={() => updateDraft({ launchRetail: true })}
        >
          <p className="client-onboarding__choice-title">Yes</p>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={draft.launchRetail === false}
          className={`client-onboarding__choice${draft.launchRetail === false ? ' is-selected' : ''}`}
          disabled={disabled}
          onClick={() =>
            updateDraft({ launchRetail: false, retailProductsDeferred: false })
          }
        >
          <p className="client-onboarding__choice-title">No</p>
        </button>
      </div>

      {draft.launchRetail === true ? (
        <div className="client-onboarding__banner" role="status">
          <h2>Products in your catalogue</h2>
          <p>
            {state.workspace.productCount === 0
              ? 'No products yet.'
              : `${state.workspace.productCount} product${state.workspace.productCount === 1 ? '' : 's'} ready.`}
          </p>
          {state.workspace.productCount === 0 ? (
            <label className="client-onboarding__check-row" style={{ marginTop: '0.75rem' }}>
              <input
                type="checkbox"
                checked={draft.retailProductsDeferred}
                disabled={disabled}
                onChange={(e) =>
                  updateDraft({ retailProductsDeferred: e.target.checked })
                }
              />
              <span>Add products later</span>
            </label>
          ) : null}
        </div>
      ) : null}

      <h2 className="client-onboarding__section-title">Deposits</h2>
      <p className="admin-onboarding__description">
        Would you like deposits enabled from launch?
      </p>
      <div
        className="client-onboarding__choice-stack"
        role="radiogroup"
        aria-label="Deposits launch"
      >
        <button
          type="button"
          role="radio"
          aria-checked={draft.launchDeposits === true}
          className={`client-onboarding__choice${draft.launchDeposits === true ? ' is-selected' : ''}`}
          disabled={disabled}
          onClick={() => updateDraft({ launchDeposits: true })}
        >
          <p className="client-onboarding__choice-title">Yes</p>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={draft.launchDeposits === false}
          className={`client-onboarding__choice${draft.launchDeposits === false ? ' is-selected' : ''}`}
          disabled={disabled}
          onClick={() => updateDraft({ launchDeposits: false })}
        >
          <p className="client-onboarding__choice-title">No</p>
        </button>
      </div>
    </section>
  );
}

export function FinalDetailsStep({ draft, disabled, updateDraft }: Common) {
  return (
    <section className="client-onboarding__section">
      <h1 className="admin-onboarding__title">Final details</h1>
      <p className="admin-onboarding__description">
        Optional extras for notifications and how we may feature your business.
      </p>
      <TextInput
        id="notificationReplyToEmail"
        label="Notification reply-to email"
        type="email"
        optional
        disabled={disabled}
        value={draft.notificationReplyToEmail ?? ''}
        onChange={(v) =>
          updateDraft({ notificationReplyToEmail: v.trim() ? v.trim() : null })
        }
      />
      <TextArea
        id="additionalNotes"
        label="Anything else we should know"
        optional
        disabled={disabled}
        value={draft.additionalNotes ?? ''}
        onChange={(v) =>
          updateDraft({ additionalNotes: v.trim() ? v.trim() : null })
        }
      />

      <h2 className="client-onboarding__section-title">Optional permissions</h2>
      <p className="admin-onboarding__description">
        These permissions are optional and won’t affect your KERSIVO service.
      </p>
      {(
        [
          ['portfolioConsent', 'Allow KERSIVO to feature my business in its portfolio.'],
          ['socialMediaConsent', 'Allow KERSIVO to feature my business on social media.'],
          ['advertisingConsent', 'Allow KERSIVO to use my business in advertising.'],
          ['caseStudyConsent', 'Allow KERSIVO to use my business as a case study.'],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="client-onboarding__check-row">
          <input
            type="checkbox"
            checked={Boolean(draft[key])}
            disabled={disabled}
            onChange={(e) => updateDraft({ [key]: e.target.checked })}
          />
          <span>{label}</span>
        </label>
      ))}
    </section>
  );
}

function yesNo(value: boolean | null | undefined) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Not answered';
}

export function ReviewStep({
  draft,
  state,
  disabled,
  updateDraft,
  onEditStep,
}: Common) {
  const csvCount = state.assets.filter((a) => a.kind === 'MIGRATION_CSV').length;
  const openDays = state.openingHours.filter((h) => h.active);

  return (
    <section className="client-onboarding__section">
      <h1 className="admin-onboarding__title">Review & submit</h1>
      <p className="admin-onboarding__description">
        Check everything looks right, then submit your setup details.
      </p>

      <ReviewBlock title="Business" step={1} onEditStep={onEditStep} disabled={disabled}>
        <li>
          <strong>Contact:</strong> {draft.primaryContactName || '—'} ({draft.primaryContactEmail || '—'})
        </li>
        <li>
          <strong>Address:</strong>{' '}
          {[draft.addressLine1, draft.townCity, draft.postcode].filter(Boolean).join(', ') || '—'}
        </li>
        <li>
          <strong>Public contact:</strong>{' '}
          {draft.publicEmail || draft.publicPhone || '—'}
        </li>
      </ReviewBlock>

      <ReviewBlock title="Brand" step={2} onEditStep={onEditStep} disabled={disabled}>
        <li>
          <strong>Tagline:</strong> {draft.tagline || '—'}
        </li>
        <li>
          <strong>Files:</strong>{' '}
          {state.assets.filter((a) => a.kind !== 'MIGRATION_CSV').length} uploaded
        </li>
      </ReviewBlock>

      <ReviewBlock title="Domain" step={3} onEditStep={onEditStep} disabled={disabled}>
        <li>
          <strong>Choice:</strong> {domainModeLabel(draft.domainMode)}
        </li>
        {draft.domainMode === 'EXISTING' ? (
          <li>
            <strong>Domain:</strong> {draft.existingDomain || '—'}
          </li>
        ) : null}
        {draft.domainMode === 'KERSIVO_REGISTER' ? (
          <li>
            <strong>Preferred:</strong>{' '}
            {[draft.preferredDomain1, draft.preferredDomain2, draft.preferredDomain3]
              .filter(Boolean)
              .join(', ') || '—'}
          </li>
        ) : null}
      </ReviewBlock>

      <ReviewBlock title="Team" step={4} onEditStep={onEditStep} disabled={disabled}>
        <li>
          {state.barbers.filter((b) => b.active).map((b) => b.name).join(', ') || '—'}
        </li>
      </ReviewBlock>

      <ReviewBlock title="Services" step={5} onEditStep={onEditStep} disabled={disabled}>
        {state.services.filter((s) => s.isActive).map((s) => (
          <li key={s.id}>
            {s.name} — {formatGbp(s.pricePence)} / {s.durationMinutes}m
          </li>
        ))}
        {state.services.filter((s) => s.isActive).length === 0 ? <li>—</li> : null}
      </ReviewBlock>

      <ReviewBlock title="Opening hours" step={6} onEditStep={onEditStep} disabled={disabled}>
        {openDays.map((h) => (
          <li key={h.dayOfWeek}>
            {DAY_LABELS[h.dayOfWeek]}: {minutesToTime(h.startMinutes)}–{minutesToTime(h.endMinutes)}
          </li>
        ))}
        {openDays.length === 0 ? <li>—</li> : null}
      </ReviewBlock>

      <ReviewBlock title="Availability" step={7} onEditStep={onEditStep} disabled={disabled}>
        <li>
          {state.workspace.activeBarberAvailabilityDayCount} barber availability day
          {state.workspace.activeBarberAvailabilityDayCount === 1 ? '' : 's'} set
        </li>
      </ReviewBlock>

      <ReviewBlock title="Migration" step={8} onEditStep={onEditStep} disabled={disabled}>
        <li>
          <strong>Moving systems:</strong> {yesNo(draft.migrationRequested)}
          {draft.migrationSource ? ` — ${draft.migrationSource}` : ''}
        </li>
        {draft.migrationRequested ? (
          <li>
            <strong>Export:</strong> {csvCount > 0 ? 'CSV uploaded' : 'No file uploaded'}
          </li>
        ) : null}
      </ReviewBlock>

      <ReviewBlock title="Retail & deposits" step={9} onEditStep={onEditStep} disabled={disabled}>
        <li>
          <strong>Retail at launch:</strong> {yesNo(draft.launchRetail)}
          {draft.launchRetail && draft.retailProductsDeferred ? ' (products later)' : ''}
        </li>
        <li>
          <strong>Deposits at launch:</strong> {yesNo(draft.launchDeposits)}
        </li>
      </ReviewBlock>

      <ReviewBlock title="Optional permissions" step={10} onEditStep={onEditStep} disabled={disabled}>
        <li>Portfolio: {yesNo(draft.portfolioConsent)}</li>
        <li>Social media: {yesNo(draft.socialMediaConsent)}</li>
        <li>Advertising: {yesNo(draft.advertisingConsent)}</li>
        <li>Case study: {yesNo(draft.caseStudyConsent)}</li>
      </ReviewBlock>

      <ReviewBlock title="Additional details" step={10} onEditStep={onEditStep} disabled={disabled}>
        <li>
          <strong>Reply-to:</strong> {draft.notificationReplyToEmail || '—'}
        </li>
        <li>
          <strong>Notes:</strong> {draft.additionalNotes || '—'}
        </li>
      </ReviewBlock>

      <div className="client-onboarding__section">
        <h2 className="client-onboarding__section-title">Confirmations</h2>
        <label className="client-onboarding__check-row">
          <input
            type="checkbox"
            checked={draft.contentRightsConfirmed}
            disabled={disabled}
            onChange={(e) => updateDraft({ contentRightsConfirmed: e.target.checked })}
          />
          <span>
            I confirm that I have the right to use the information, images and brand assets I’ve
            provided.
          </span>
        </label>
        <label className="client-onboarding__check-row">
          <input
            type="checkbox"
            checked={draft.informationAccuracyConfirmed}
            disabled={disabled}
            onChange={(e) =>
              updateDraft({ informationAccuracyConfirmed: e.target.checked })
            }
          />
          <span>
            I confirm that the information I’ve provided is accurate to the best of my knowledge.
          </span>
        </label>
      </div>
    </section>
  );
}

function ReviewBlock({
  title,
  step,
  onEditStep,
  disabled,
  children,
}: {
  title: string;
  step: number;
  onEditStep?: (step: number) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="client-onboarding__review-block">
      <div className="client-onboarding__review-head">
        <h3>{title}</h3>
        {onEditStep && !disabled ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onEditStep(step)}
          >
            Edit
          </button>
        ) : null}
      </div>
      <ul className="client-onboarding__review-lines">{children}</ul>
    </div>
  );
}
