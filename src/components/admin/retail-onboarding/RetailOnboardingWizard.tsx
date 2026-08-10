import React, { useEffect, useMemo, useState } from 'react';
import { ButtonSpinner } from '@/components/ButtonSpinner';
import { ConfirmationStatusIcon } from '@/components/ConfirmationStatusIcon';
import { ImagePlus } from '../../lucide-react';
import PrivateDemoAuthPanel from '../PrivateDemoAuthPanel';
import RetailOnboardingWelcome from './RetailOnboardingWelcome';
import {
  CATEGORY_LABELS,
  PRODUCT_CATEGORY_OPTIONS,
  createHighlights,
  formatGbp,
  parseGbpToPence,
  readJsonError,
  splitDescription,
  type ProductCategory,
} from './retailOnboardingTypes';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const IMAGE_HINT = 'JPG, PNG or WEBP · max 2MB';

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Use a JPG, PNG, or WEBP image.';
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'Image is too large. Maximum size is 2MB.';
  }
  return null;
}

function progressStepNumber(step: number) {
  return Math.min(2, Math.max(1, step));
}

function initialStepFromUrl() {
  if (typeof window === 'undefined') return 0;
  const raw = new URLSearchParams(window.location.search).get('step');
  if (raw === '1' || raw === '2') return Number(raw);
  return 0;
}

export default function RetailOnboardingWizard() {
  const [authReady, setAuthReady] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [step, setStep] = useState(initialStepFromUrl);

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [description, setDescription] = useState('');
  const [priceGbp, setPriceGbp] = useState('');
  const [priceError, setPriceError] = useState('');
  const [category, setCategory] = useState<ProductCategory>('STYLING');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');
  const [finished, setFinished] = useState(false);
  const [addedSummary, setAddedSummary] = useState<{
    name: string;
    pricePence: number;
    category: ProductCategory;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/admin/session', { credentials: 'include' });
        if (response.status === 401 || response.status === 403) {
          setHasAccess(false);
          return;
        }
        if (!response.ok) {
          setError(await readJsonError(response));
          setHasAccess(true);
          return;
        }
        setHasAccess(true);
      } catch {
        setError('Could not load retail setup. Please refresh.');
      } finally {
        setAuthReady(true);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const pricePence = useMemo(() => parseGbpToPence(priceGbp), [priceGbp]);
  const previewIntro = useMemo(() => splitDescription(description || null).intro, [description]);
  const previewHighlights = useMemo(
    () => createHighlights(description || null, category),
    [description, category],
  );
  const displayName = name.trim() || 'Your product';
  const displayPrice = Number.isFinite(pricePence) && pricePence > 0 ? formatGbp(pricePence) : '£0.00';

  const setupProgressVisible = !finished && step >= 1 && step <= 2;

  const validateForm = () => {
    let valid = true;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Product name is required.');
      valid = false;
    } else {
      setNameError('');
    }

    if (!Number.isFinite(pricePence) || pricePence <= 0) {
      setPriceError('Enter a price greater than zero.');
      valid = false;
    } else {
      setPriceError('');
    }

    return valid;
  };

  const handleContinueFromForm = () => {
    setError('');
    if (!validateForm()) return;
    setStep(2);
  };

  const handleAddProduct = async () => {
    if (saving) return;
    setError('');
    if (!validateForm()) {
      setStep(1);
      return;
    }

    setSaving(true);
    try {
      const form = new FormData();
      form.set('name', name.trim());
      form.set('description', description.trim());
      form.set('pricePence', String(pricePence));
      form.set('category', category);
      form.set('active', 'true');
      form.set('featured', 'false');
      form.set('sortOrder', '0');
      if (imageFile) {
        form.set('image', imageFile);
      }

      const response = await fetch('/api/admin/shop/products/create', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      if (response.status === 401 || response.status === 403) {
        setHasAccess(false);
        throw new Error('Your session expired. Please sign in again.');
      }
      if (!response.ok) {
        throw new Error(await readJsonError(response));
      }

      setAddedSummary({
        name: name.trim(),
        pricePence,
        category,
      });
      setFinished(true);
      setSaving(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add product to the shop.');
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (saving || step <= 0) return;
    setError('');
    setStep((current) => current - 1);
  };

  if (!authReady || loading) {
    return (
      <div className="admin-onboarding admin-onboarding--retail">
        <div className="admin-onboarding__loading" role="status">
          Loading retail setup…
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <PrivateDemoAuthPanel
        initialMode="signup"
        onSuccess={() => {
          window.location.assign('/admin/retail-onboarding');
        }}
      />
    );
  }

  const shellClass = `admin-onboarding admin-onboarding--retail${
    !finished && step === 2 ? ' admin-onboarding--preview' : ''
  }${finished ? ' admin-onboarding--finished' : ''}`;

  if (finished && addedSummary) {
    const categoryLabel =
      PRODUCT_CATEGORY_OPTIONS.find((option) => option.value === addedSummary.category)?.label ??
      CATEGORY_LABELS[addedSummary.category];

    return (
      <div className={shellClass}>
        <header className="admin-onboarding__header">
          <div className="admin-onboarding__brand">
            <img className="admin-onboarding__logo" src="/images/logo_nobg.png" alt="" />
            <span className="admin-onboarding__brand-name">Kersivo</span>
          </div>
        </header>

        <main className="admin-onboarding__main">
          <div className="booking-flow booking-flow--wizard">
            <section
              className="booking-confirmation booking-confirmation--success"
              role="status"
              aria-live="polite"
              tabIndex={-1}
            >
              <div className="booking-confirmation__header">
                <ConfirmationStatusIcon variant="success" />
                <div className="booking-confirmation__copy">
                  <p className="booking-confirmation__eyebrow">Confirmed</p>
                  <h2 className="booking-confirmation__heading">Product added</h2>
                  <p className="booking-confirmation__body">
                    Your product is live in your shop. Customers can browse it on your storefront.
                  </p>
                </div>
              </div>

              <dl className="booking-confirmation__summary" aria-label="Product summary">
                <div className="booking-confirmation__summary-row">
                  <dt>Product</dt>
                  <dd>{addedSummary.name}</dd>
                </div>
                <div className="booking-confirmation__summary-row">
                  <dt>Price</dt>
                  <dd>{formatGbp(addedSummary.pricePence)}</dd>
                </div>
                <div className="booking-confirmation__summary-row">
                  <dt>Category</dt>
                  <dd>{categoryLabel}</dd>
                </div>
              </dl>

              <div className="booking-confirmation__cta">
                <a
                  className="btn btn--primary btn--lg"
                  href={`/admin/test-shop?category=${encodeURIComponent(addedSummary.category)}&highlight=1`}
                >
                  View in my shop
                </a>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <header className="admin-onboarding__header">
        <div className="admin-onboarding__brand">
          <img className="admin-onboarding__logo" src="/images/logo_nobg.png" alt="" />
          <span className="admin-onboarding__brand-name">Kersivo</span>
        </div>
        {setupProgressVisible ? (
          <div>
            <div className="admin-onboarding__progress-meta">
              <p className="admin-onboarding__progress-text" id="retail-onboarding-progress-label">
                Step {progressStepNumber(step)} of 2
              </p>
            </div>
            <div
              className="admin-onboarding__progress-track"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={2}
              aria-valuenow={progressStepNumber(step)}
              aria-labelledby="retail-onboarding-progress-label"
            >
              <div
                className="admin-onboarding__progress-fill"
                style={{ width: `${(progressStepNumber(step) / 2) * 100}%` }}
              />
            </div>
          </div>
        ) : null}
      </header>

      <main className={`admin-onboarding__main${step === 0 ? ' admin-onboarding__main--welcome' : ''}`}>
        {error ? (
          <p className="admin-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}

        {step === 0 ? <RetailOnboardingWelcome layout="wizard" /> : null}

        {step === 1 ? (
          <section aria-labelledby="retail-onboarding-product-title" className="admin-onboarding__stack">
            <div>
              <h1 id="retail-onboarding-product-title" className="admin-onboarding__title">
                Add your first product
              </h1>
              <p className="admin-onboarding__description">
                Tell us what you sell — you can always add more products later from Products.
              </p>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="retail-product-name">
                Product name
              </label>
              <input
                id="retail-product-name"
                className={`input${nameError ? ' input--error' : ''}`}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameError) setNameError('');
                }}
                required
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? 'retail-product-name-error' : undefined}
              />
              {nameError ? (
                <p id="retail-product-name-error" className="field__error" role="alert">
                  {nameError}
                </p>
              ) : null}
            </div>

            <div className="field admin-onboarding__file">
              <span className="field__label" id="retail-product-image-label">
                Product image <span className="field__hint">(optional)</span>
              </span>
              <input
                id="retail-product-image"
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-labelledby="retail-product-image-label"
                aria-describedby="retail-product-image-hint"
                aria-invalid={Boolean(imageError)}
                onChange={(event) => {
                  const input = event.target;
                  const file = input.files?.[0] ?? null;
                  if (!file) {
                    setImageFile(null);
                    setImageError('');
                    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
                    setImagePreview(null);
                    return;
                  }
                  const validationError = validateImageFile(file);
                  if (validationError) {
                    setImageError(validationError);
                    setImageFile(null);
                    input.value = '';
                    return;
                  }
                  setImageError('');
                  setImageFile(file);
                  if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
                  setImagePreview(URL.createObjectURL(file));
                }}
              />
              <label
                htmlFor="retail-product-image"
                className={`admin-onboarding__upload-tile${imagePreview ? ' has-preview' : ''}`}
              >
                {imagePreview ? (
                  <>
                    <img className="admin-onboarding__upload-preview" src={imagePreview} alt="" />
                    <span className="admin-onboarding__upload-overlay">Change</span>
                  </>
                ) : (
                  <>
                    <ImagePlus width={22} height={22} aria-hidden="true" />
                    <span className="admin-onboarding__upload-caption">Add image</span>
                  </>
                )}
              </label>
              <span id="retail-product-image-hint" className="field__hint admin-onboarding__file-hint">
                {IMAGE_HINT}
              </span>
              {imageError ? <p className="field__error">{imageError}</p> : null}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="retail-product-price">
                Price
              </label>
              <div className={`admin-onboarding__price-wrap${priceError ? ' input--error' : ''}`}>
                <span aria-hidden="true">£</span>
                <input
                  id="retail-product-price"
                  className="input"
                  inputMode="decimal"
                  value={priceGbp}
                  onChange={(event) => {
                    setPriceGbp(event.target.value.replace(/[^0-9.,]/g, ''));
                    if (priceError) setPriceError('');
                  }}
                  required
                  aria-invalid={Boolean(priceError)}
                  aria-describedby={priceError ? 'retail-product-price-error' : undefined}
                />
              </div>
              {priceError ? (
                <p id="retail-product-price-error" className="field__error" role="alert">
                  {priceError}
                </p>
              ) : null}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="retail-product-description">
                Description <span className="field__hint">(optional)</span>
              </label>
              <textarea
                id="retail-product-description"
                className="input"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="retail-product-category">
                Category
              </label>
              <select
                id="retail-product-category"
                className="input"
                value={category}
                onChange={(event) => setCategory(event.target.value as ProductCategory)}
              >
                {PRODUCT_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section aria-labelledby="retail-onboarding-preview-title" className="admin-onboarding__stack">
            <div>
              <h1 id="retail-onboarding-preview-title" className="admin-onboarding__title">
                Preview your retail shop
              </h1>
              <p className="admin-onboarding__description">
                This is how your product will look for customers on the product page.
              </p>
            </div>

            <div className="admin-retail-preview">
              <section className="product-hero" aria-label="Product details preview">
                <div className="product-media">
                  {imagePreview ? (
                    <img src={imagePreview} alt={displayName} className="product-image" />
                  ) : (
                    <div className="product-image-placeholder">No image available</div>
                  )}
                </div>

                <div className="product-content">
                  <p className="product-overline">{CATEGORY_LABELS[category]}</p>
                  <h1>{displayName}</h1>
                  <p className="product-price">{displayPrice}</p>
                  <p className="product-intro">{previewIntro}</p>

                  {previewHighlights.length > 0 ? (
                    <ul className="product-highlights" aria-label="Product highlights">
                      {previewHighlights.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="product-actions">
                    <button type="button" className="btn btn--primary" disabled tabIndex={-1} aria-disabled="true">
                      Add to cart
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="admin-onboarding__footer">
        {step === 0 ? (
          <div className="admin-onboarding__footer-row admin-onboarding__footer-row--welcome">
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => {
                setError('');
                setStep(1);
              }}
            >
              Yes, set up my retail shop
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--lg"
              onClick={() => {
                window.location.assign('/admin');
              }}
            >
              Not right now
            </button>
          </div>
        ) : (
          <div className="admin-onboarding__footer-row">
            <button type="button" className="btn btn--secondary btn--lg" onClick={handleBack} disabled={saving}>
              Back
            </button>
            {step === 1 ? (
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={handleContinueFromForm}
                disabled={saving}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => {
                  void handleAddProduct();
                }}
                disabled={saving}
                aria-busy={saving}
              >
                {saving ? <ButtonSpinner /> : null}
                <span>{saving ? 'Adding…' : 'Add product to the shop'}</span>
              </button>
            )}
          </div>
        )}
      </footer>
    </div>
  );
}
