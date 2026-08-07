import React from 'react';
import { ClientOnboardingDomainMode } from '@prisma/client';
import { TextArea, TextInput } from '../fields';
import { PrivateAssetUploader } from '../PrivateAssetUploader';
import {
  domainModeLabel,
  type ClientOnboardingState,
  type DraftFields,
  type OnboardingAsset,
  type PrefillKind,
} from '../types';

export type StepCommon = {
  draft: DraftFields;
  state: ClientOnboardingState;
  disabled?: boolean;
  updateDraft: (patch: Partial<DraftFields>) => void;
  upsertAsset: (asset: OnboardingAsset) => void;
  removeAssetLocal: (id: string) => void;
  mergeCanonical: (
    slice: Partial<Pick<ClientOnboardingState, 'barbers' | 'services' | 'openingHours' | 'workspace'>>,
  ) => void;
  registerBeforeContinue: (fn: (() => Promise<boolean>) | null) => void;
};

export function WelcomeStep({
  prefillKind,
  onStart,
}: {
  prefillKind: PrefillKind;
  onStart: () => void;
}) {
  return (
    <section className="admin-onboarding__card-block">
      <h1 className="admin-onboarding__title">Let’s get your KERSIVO setup ready</h1>
      <p className="admin-onboarding__description">
        We’ll use these details to prepare your booking website and account for launch. You can
        save your progress and come back at any time.
      </p>
      {prefillKind === 'fields' ? (
        <div className="client-onboarding__banner" role="status">
          <h2>We’ve brought across your details</h2>
          <p>
            We’ve brought across the information you already added. Review it and make any changes
            before continuing.
          </p>
        </div>
      ) : null}
      {prefillKind === 'canonical' ? (
        <div className="client-onboarding__banner" role="status">
          <h2>We’ve brought across your shop setup</h2>
          <p>
            We’ve brought across the team, services and opening hours you already added. Review
            them and make any changes before continuing.
          </p>
        </div>
      ) : null}
      <button type="button" className="btn btn--primary btn--lg" onClick={onStart}>
        Start setup
      </button>
    </section>
  );
}

export function BusinessStep({ draft, disabled, updateDraft }: StepCommon) {
  const set = (key: keyof DraftFields, value: string) =>
    updateDraft({ [key]: value.trim() ? value : null });

  return (
    <section className="client-onboarding__section">
      <h1 className="admin-onboarding__title">Your business</h1>
      <p className="admin-onboarding__description">
        Tell us how your business should appear and how we can reach you.
      </p>

      <div className="client-onboarding__section">
        <h2 className="client-onboarding__section-title">Business</h2>
        <div className="client-onboarding__field-grid">
          <TextInput
            id="legalBusinessName"
            label="Legal business name"
            optional
            disabled={disabled}
            value={draft.legalBusinessName ?? ''}
            onChange={(v) => set('legalBusinessName', v)}
          />
          <TextInput
            id="businessType"
            label="Business type"
            optional
            hint="e.g. Limited company, sole trader"
            disabled={disabled}
            value={draft.businessType ?? ''}
            onChange={(v) => set('businessType', v)}
          />
          <TextInput
            id="companyNumber"
            label="Company number"
            optional
            disabled={disabled}
            value={draft.companyNumber ?? ''}
            onChange={(v) => set('companyNumber', v)}
          />
        </div>
      </div>

      <div className="client-onboarding__section">
        <h2 className="client-onboarding__section-title">Address</h2>
        <div className="client-onboarding__field-grid">
          <TextInput
            id="addressLine1"
            label="Street address"
            disabled={disabled}
            value={draft.addressLine1 ?? ''}
            onChange={(v) => set('addressLine1', v)}
            autoComplete="address-line1"
          />
          <TextInput
            id="addressLine2"
            label="Address line 2"
            optional
            disabled={disabled}
            value={draft.addressLine2 ?? ''}
            onChange={(v) => set('addressLine2', v)}
            autoComplete="address-line2"
          />
          <div className="client-onboarding__field-grid client-onboarding__field-grid--2">
            <TextInput
              id="townCity"
              label="Town / city"
              disabled={disabled}
              value={draft.townCity ?? ''}
              onChange={(v) => set('townCity', v)}
              autoComplete="address-level2"
            />
            <TextInput
              id="postcode"
              label="Postcode"
              disabled={disabled}
              value={draft.postcode ?? ''}
              onChange={(v) => set('postcode', v)}
              autoComplete="postal-code"
            />
          </div>
        </div>
      </div>

      <div className="client-onboarding__section">
        <h2 className="client-onboarding__section-title">Primary contact</h2>
        <div className="client-onboarding__field-grid client-onboarding__field-grid--2">
          <TextInput
            id="primaryContactName"
            label="Contact name"
            disabled={disabled}
            value={draft.primaryContactName ?? ''}
            onChange={(v) => set('primaryContactName', v)}
            autoComplete="name"
          />
          <TextInput
            id="primaryContactEmail"
            label="Contact email"
            type="email"
            disabled={disabled}
            value={draft.primaryContactEmail ?? ''}
            onChange={(v) => set('primaryContactEmail', v)}
            autoComplete="email"
          />
        </div>
      </div>

      <div className="client-onboarding__section">
        <h2 className="client-onboarding__section-title">Public contact details</h2>
        <p className="admin-onboarding__description">
          Provide a public email or phone number clients can use.
        </p>
        <div className="client-onboarding__field-grid client-onboarding__field-grid--2">
          <TextInput
            id="publicEmail"
            label="Public email"
            type="email"
            optional
            disabled={disabled}
            value={draft.publicEmail ?? ''}
            onChange={(v) => set('publicEmail', v)}
          />
          <TextInput
            id="publicPhone"
            label="Public phone"
            type="tel"
            optional
            disabled={disabled}
            value={draft.publicPhone ?? ''}
            onChange={(v) => set('publicPhone', v)}
          />
        </div>
      </div>
    </section>
  );
}

export function BrandStep({ draft, state, disabled, updateDraft, upsertAsset, removeAssetLocal }: StepCommon) {
  const set = (key: keyof DraftFields, value: string) =>
    updateDraft({ [key]: value.trim() ? value : null });

  return (
    <section className="client-onboarding__section">
      <h1 className="admin-onboarding__title">Your brand</h1>
      <p className="admin-onboarding__description">
        Add the brand assets you already use. You can leave anything you don’t have yet.
      </p>
      <TextInput
        id="tagline"
        label="Tagline"
        optional
        disabled={disabled}
        value={draft.tagline ?? ''}
        onChange={(v) => set('tagline', v)}
      />
      <TextArea
        id="shopDescription"
        label="About your shop"
        optional
        disabled={disabled}
        value={draft.shopDescription ?? ''}
        onChange={(v) => set('shopDescription', v)}
      />
      <TextArea
        id="websiteNotes"
        label="Website notes"
        optional
        disabled={disabled}
        value={draft.websiteNotes ?? ''}
        onChange={(v) => set('websiteNotes', v)}
      />
      <TextInput
        id="currentWebsiteUrl"
        label="Current website"
        optional
        hint="https://…"
        disabled={disabled}
        value={draft.currentWebsiteUrl ?? ''}
        onChange={(v) => set('currentWebsiteUrl', v)}
      />
      <div className="client-onboarding__field-grid client-onboarding__field-grid--2">
        <TextInput
          id="instagramUrl"
          label="Instagram"
          optional
          disabled={disabled}
          value={draft.instagramUrl ?? ''}
          onChange={(v) => set('instagramUrl', v)}
        />
        <TextInput
          id="facebookUrl"
          label="Facebook"
          optional
          disabled={disabled}
          value={draft.facebookUrl ?? ''}
          onChange={(v) => set('facebookUrl', v)}
        />
        <TextInput
          id="tiktokUrl"
          label="TikTok"
          optional
          disabled={disabled}
          value={draft.tiktokUrl ?? ''}
          onChange={(v) => set('tiktokUrl', v)}
        />
        <TextInput
          id="otherSocialUrl"
          label="Other social link"
          optional
          disabled={disabled}
          value={draft.otherSocialUrl ?? ''}
          onChange={(v) => set('otherSocialUrl', v)}
        />
      </div>
      <TextArea
        id="brandNotes"
        label="Brand notes"
        optional
        disabled={disabled}
        value={draft.brandNotes ?? ''}
        onChange={(v) => set('brandNotes', v)}
      />
      <div className="client-onboarding__field-grid client-onboarding__field-grid--2">
        <TextInput
          id="preferredPrimaryColour"
          label="Primary colour"
          optional
          hint="e.g. #111111"
          disabled={disabled}
          value={draft.preferredPrimaryColour ?? ''}
          onChange={(v) => set('preferredPrimaryColour', v)}
        />
        <TextInput
          id="preferredSecondaryColour"
          label="Secondary colour"
          optional
          disabled={disabled}
          value={draft.preferredSecondaryColour ?? ''}
          onChange={(v) => set('preferredSecondaryColour', v)}
        />
      </div>

      <h2 className="client-onboarding__section-title">Brand files</h2>
      <PrivateAssetUploader
        kind="BRAND_LOGO"
        accept="image/jpeg,image/png,image/webp"
        assets={state.assets}
        disabled={disabled}
        hint="JPG, PNG or WEBP"
        onUploaded={upsertAsset}
        onRemoved={removeAssetLocal}
      />
      <PrivateAssetUploader
        kind="GALLERY_IMAGE"
        accept="image/jpeg,image/png,image/webp"
        assets={state.assets}
        disabled={disabled}
        hint="Add photos that represent your shop"
        onUploaded={upsertAsset}
        onRemoved={removeAssetLocal}
      />
      <PrivateAssetUploader
        kind="BRAND_GUIDELINES"
        accept=".pdf,image/jpeg,image/png,application/pdf"
        assets={state.assets}
        disabled={disabled}
        hint="Optional PDF or image guidelines"
        onUploaded={upsertAsset}
        onRemoved={removeAssetLocal}
      />
    </section>
  );
}

export function DomainStep({ draft, disabled, updateDraft }: StepCommon) {
  const modes: ClientOnboardingDomainMode[] = [
    ClientOnboardingDomainMode.EXISTING,
    ClientOnboardingDomainMode.KERSIVO_REGISTER,
    ClientOnboardingDomainMode.UNDECIDED,
  ];

  return (
    <section className="client-onboarding__section">
      <h1 className="admin-onboarding__title">Your domain</h1>
      <p className="admin-onboarding__description">
        Choose how you’d like to handle the website address for your booking site.
      </p>
      <div className="client-onboarding__choice-stack" role="radiogroup" aria-label="Domain option">
        {modes.map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={draft.domainMode === mode}
            className={`client-onboarding__choice${draft.domainMode === mode ? ' is-selected' : ''}`}
            disabled={disabled}
            onClick={() => updateDraft({ domainMode: mode })}
          >
            <div>
              <p className="client-onboarding__choice-title">{domainModeLabel(mode)}</p>
              {mode === ClientOnboardingDomainMode.EXISTING ? (
                <p className="client-onboarding__choice-body">
                  You won’t need to share your registrar password here.
                </p>
              ) : null}
              {mode === ClientOnboardingDomainMode.KERSIVO_REGISTER ? (
                <p className="client-onboarding__choice-body">
                  Share your preferred domain names and authorise registration.
                </p>
              ) : null}
              {mode === ClientOnboardingDomainMode.UNDECIDED ? (
                <p className="client-onboarding__choice-body">
                  You can decide later before submitting.
                </p>
              ) : null}
            </div>
          </button>
        ))}
      </div>

      {draft.domainMode === ClientOnboardingDomainMode.EXISTING ? (
        <div className="client-onboarding__section">
          <TextInput
            id="existingDomain"
            label="Your domain"
            hint="e.g. example.com"
            disabled={disabled}
            value={draft.existingDomain ?? ''}
            onChange={(v) =>
              updateDraft({ existingDomain: v.trim() ? v.trim() : null })
            }
          />
          <TextInput
            id="domainRegistrar"
            label="Registrar"
            optional
            hint="Where the domain is registered, if you know"
            disabled={disabled}
            value={draft.domainRegistrar ?? ''}
            onChange={(v) =>
              updateDraft({ domainRegistrar: v.trim() ? v.trim() : null })
            }
          />
        </div>
      ) : null}

      {draft.domainMode === ClientOnboardingDomainMode.KERSIVO_REGISTER ? (
        <div className="client-onboarding__section">
          <TextInput
            id="preferredDomain1"
            label="1st choice domain"
            disabled={disabled}
            value={draft.preferredDomain1 ?? ''}
            onChange={(v) =>
              updateDraft({ preferredDomain1: v.trim() ? v.trim() : null })
            }
          />
          <TextInput
            id="preferredDomain2"
            label="2nd choice domain"
            optional
            disabled={disabled}
            value={draft.preferredDomain2 ?? ''}
            onChange={(v) =>
              updateDraft({ preferredDomain2: v.trim() ? v.trim() : null })
            }
          />
          <TextInput
            id="preferredDomain3"
            label="3rd choice domain"
            optional
            disabled={disabled}
            value={draft.preferredDomain3 ?? ''}
            onChange={(v) =>
              updateDraft({ preferredDomain3: v.trim() ? v.trim() : null })
            }
          />
          <label className="client-onboarding__check-row">
            <input
              type="checkbox"
              checked={draft.domainRegistrationAuthorised}
              disabled={disabled}
              onChange={(e) =>
                updateDraft({ domainRegistrationAuthorised: e.target.checked })
              }
            />
            <span>
              I authorise KERSIVO to register and manage the selected domain name on behalf of my
              business using the details provided.
            </span>
          </label>
        </div>
      ) : null}
    </section>
  );
}
