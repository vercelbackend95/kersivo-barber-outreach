import React, { useEffect, useRef, useState } from 'react';
import { ButtonSpinner } from '../../ButtonSpinner';
import { ConfirmationStatusIcon } from '../../ConfirmationStatusIcon';
import { Check, ImagePlus, Package, X } from '../../lucide-react';
import { adminFetchJson } from '../adminAuth';
import AdminOnOffPill from '../AdminOnOffPill';
import {
  EMPTY_PRODUCT_FORM,
  PRODUCT_CATEGORY_OPTIONS,
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_WIZARD_STEPS,
  formatGbp,
  getProductCategoryLabel,
  parseGbpToPence,
  validateProductWizardStep,
  type ProductCategory,
  type ProductForm,
  type ProductWizardErrors,
  type ProductWizardMode,
  type ProductWizardStep
} from './productWizardTypes';

const PRODUCT_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const PRODUCT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const SORT_ORDER_MIN = 0;
const SORT_ORDER_MAX = 9999;

type ProductWizardProps = {
  mode: ProductWizardMode;
  productId?: string;
  initialForm?: ProductForm;
  onCancel: () => void;
  onSaved: (result: { mode: ProductWizardMode }) => void | Promise<void>;
};

function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="field__error" role="alert">
      {children}
    </p>
  );
}

export default function ProductWizard({
  mode,
  productId,
  initialForm = EMPTY_PRODUCT_FORM,
  onCancel,
  onSaved
}: ProductWizardProps) {
  const [step, setStep] = useState<ProductWizardStep>(1);
  const [form, setForm] = useState<ProductForm>(() => ({ ...initialForm }));
  const [errors, setErrors] = useState<ProductWizardErrors>({});
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

  function updateField<Key extends keyof ProductForm>(key: Key, value: ProductForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key in errors) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
    if (submitError) setSubmitError('');
  }

  function moveToStep(nextStep: ProductWizardStep) {
    setErrors({});
    setSubmitError('');
    setStep(nextStep);
  }

  function validateAndContinue() {
    const nextErrors = validateProductWizardStep(step, form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (step < 4) moveToStep((step + 1) as ProductWizardStep);
  }

  async function uploadProductImage(file: File) {
    if (!PRODUCT_IMAGE_TYPES.has(file.type)) {
      setImageError('Choose a JPG, PNG, WEBP, or GIF image.');
      return;
    }
    if (file.size > PRODUCT_IMAGE_MAX_SIZE_BYTES) {
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
      const data = await adminFetchJson<{ url?: string }>('/api/admin/products/upload-image', {
        method: 'POST',
        body,
        errorMessage: 'Could not upload product image.'
      });
      if (!data.url) throw new Error('Upload failed. Invalid response.');
      updateField('imageUrl', data.url);
      setImagePreviewUrl(data.url);
    } catch (error) {
      setImagePreviewUrl(form.imageUrl);
      setImageError(error instanceof Error ? error.message : 'Could not upload product image.');
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function saveProduct() {
    if (isUploadingImage) return;

    for (const validationStep of [1, 2] as ProductWizardStep[]) {
      const nextErrors = validateProductWizardStep(validationStep, form);
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        setStep(validationStep);
        return;
      }
    }

    const pricePence = parseGbpToPence(form.priceGbp);
    const endpoint =
      mode === 'edit' && productId ? '/api/admin/shop/products/update' : '/api/admin/shop/products/create';
    const payload = {
      id: mode === 'edit' ? productId : undefined,
      name: form.name.trim(),
      description: form.description.trim(),
      pricePence,
      imageUrl: form.imageUrl.trim(),
      active: form.featured ? true : form.active,
      featured: form.active ? form.featured : false,
      category: form.category,
      sortOrder: Math.min(SORT_ORDER_MAX, Math.max(SORT_ORDER_MIN, form.sortOrder))
    };

    setIsSaving(true);
    setSubmitError('');
    try {
      await adminFetchJson(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        errorMessage: 'Unable to save product.'
      });
      await onSaved({ mode });
      setFinished(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save product.');
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
      void saveProduct();
      return;
    }
    validateAndContinue();
  }

  const pricePence = parseGbpToPence(form.priceGbp);
  const categoryLabel = getProductCategoryLabel(form.category);
  const summaryBits = [
    form.name.trim(),
    categoryLabel,
    pricePence > 0 && form.priceGbp.trim() ? formatGbp(pricePence) : ''
  ].filter(Boolean);

  return (
    <form
      className="admin-barber-sheet admin-product-sheet admin-product-wizard"
      onSubmit={handleSubmit}
      onMouseDown={(event) => event.stopPropagation()}
      noValidate
    >
      <header className="admin-product-wizard__header">
        <div className="admin-product-wizard__header-copy">
          <p>{mode === 'edit' ? 'EDIT PRODUCT' : 'ADD PRODUCT'}</p>
          <h2 id="admin-product-form-title">{finished ? 'Product ready' : 'Build a shop product'}</h2>
        </div>
        <button
          type="button"
          className="btn btn--ghost admin-product-wizard__close"
          onClick={onCancel}
          disabled={isBusy}
          aria-label="Close product wizard"
        >
          <X width={18} height={18} aria-hidden="true" />
        </button>
      </header>

      {!finished ? (
        <>
          <nav className="admin-product-wizard__progress" aria-label="Product setup progress">
            <ol>
              {PRODUCT_WIZARD_STEPS.map((item) => {
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

          <div className="admin-product-wizard__live-summary" aria-live="polite">
            <Package width={16} height={16} aria-hidden="true" />
            <span>{summaryBits.length ? summaryBits.join(' · ') : 'Your product will take shape here as you go.'}</span>
          </div>
        </>
      ) : null}

      <div className="admin-product-wizard__content">
        {submitError ? (
          <p className="admin-product-wizard__error" role="alert">
            {submitError}
          </p>
        ) : null}

        {finished ? (
          <section className="admin-product-wizard__success" role="status" aria-live="polite">
            <ConfirmationStatusIcon variant="success" />
            <p className="admin-product-wizard__eyebrow">{mode === 'edit' ? 'Updated' : 'Created'}</p>
            <h3>{form.name.trim()} is ready</h3>
            <p>
              {form.active
                ? 'It is live and ready to appear in your shop.'
                : 'It has been saved as hidden and can be published whenever you are ready.'}
            </p>
          </section>
        ) : null}

        {!finished && step === 1 ? (
          <section className="admin-product-wizard__step" aria-labelledby="product-wizard-basics-title">
            <div className="admin-product-wizard__intro">
              <p className="admin-product-wizard__eyebrow">STEP 1 · BASICS</p>
              <h3 id="product-wizard-basics-title" ref={stepHeadingRef} tabIndex={-1}>
                What are you selling?
              </h3>
              <p>Give the product a clear identity customers can understand at a glance.</p>
            </div>

            <div className={`field${errors.name ? ' field--error' : ''}`}>
              <label className="field__label" htmlFor="product-wizard-name">
                Product name
              </label>
              <input
                id="product-wizard-name"
                className={`input${errors.name ? ' input--error' : ''}`}
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="e.g. Matte clay pomade"
                maxLength={120}
                autoFocus
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'product-wizard-name-error' : undefined}
              />
              <FieldError id="product-wizard-name-error">{errors.name}</FieldError>
            </div>

            <div className="field admin-product-wizard__image-field">
              <span className="field__label">
                Product image <span className="field__hint">(optional)</span>
              </span>
              <span className="field__hint">JPG, PNG, WEBP or GIF · max 5MB</span>
              <input
                id="product-wizard-image"
                className="sr-only"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.gif"
                disabled={isBusy}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void uploadProductImage(file);
                }}
              />
              <label
                className={`admin-product-wizard__image-upload${imagePreviewUrl ? ' has-preview' : ''}`}
                htmlFor="product-wizard-image"
                aria-busy={isUploadingImage}
              >
                {imagePreviewUrl ? (
                  <img src={imagePreviewUrl} alt="" />
                ) : (
                  <span className="admin-product-wizard__image-empty">
                    <ImagePlus width={24} height={24} aria-hidden="true" />
                    <strong>Add a product image</strong>
                    <small>Choose a clear photo customers will recognise</small>
                  </span>
                )}
                {isUploadingImage ? (
                  <span className="admin-product-wizard__image-overlay">
                    <ButtonSpinner />
                    Uploading…
                  </span>
                ) : imagePreviewUrl ? (
                  <span className="admin-product-wizard__image-overlay">Change image</span>
                ) : null}
              </label>
              {imagePreviewUrl && !isUploadingImage ? (
                <button
                  type="button"
                  className="admin-product-wizard__image-remove"
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
              <div className="admin-product-wizard__label-row">
                <label className="field__label" htmlFor="product-wizard-description">
                  Description <span className="field__hint">(optional)</span>
                </label>
                <span>
                  {form.description.length}/{PRODUCT_DESCRIPTION_MAX_LENGTH}
                </span>
              </div>
              <textarea
                id="product-wizard-description"
                className={`input admin-product-wizard__textarea${errors.description ? ' input--error' : ''}`}
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="What makes this product worth buying?"
                maxLength={PRODUCT_DESCRIPTION_MAX_LENGTH}
                rows={4}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? 'product-wizard-description-error' : undefined}
              />
              <FieldError id="product-wizard-description-error">{errors.description}</FieldError>
            </div>

            <div className={`field${errors.category ? ' field--error' : ''}`}>
              <label className="field__label" htmlFor="product-wizard-category">
                Category
              </label>
              <span className="field__hint">Choose the best fit for your shop shelves.</span>
              <select
                id="product-wizard-category"
                className={`input${errors.category ? ' input--error' : ''}`}
                value={form.category}
                onChange={(event) => updateField('category', event.target.value as ProductCategory)}
                aria-invalid={Boolean(errors.category)}
                disabled={isBusy}
              >
                {PRODUCT_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FieldError id="product-wizard-category-error">{errors.category}</FieldError>
            </div>
          </section>
        ) : null}

        {!finished && step === 2 ? (
          <section className="admin-product-wizard__step" aria-labelledby="product-wizard-pricing-title">
            <div className="admin-product-wizard__intro">
              <p className="admin-product-wizard__eyebrow">STEP 2 · PRICING</p>
              <h3 id="product-wizard-pricing-title" ref={stepHeadingRef} tabIndex={-1}>
                Set the price
              </h3>
              <p>Define what customers pay for this product in the shop.</p>
            </div>

            <div className={`field${errors.priceGbp ? ' field--error' : ''}`}>
              <label className="field__label" htmlFor="product-wizard-price">
                Price
              </label>
              <div
                className={`admin-price-input-wrap admin-product-wizard__price${errors.priceGbp ? ' admin-price-input-wrap--error' : ''}`}
              >
                <span>£</span>
                <input
                  id="product-wizard-price"
                  inputMode="decimal"
                  value={form.priceGbp}
                  onChange={(event) => updateField('priceGbp', event.target.value)}
                  placeholder="0.00"
                  autoFocus
                  aria-invalid={Boolean(errors.priceGbp)}
                />
              </div>
              <FieldError id="product-wizard-price-error">{errors.priceGbp}</FieldError>
            </div>
          </section>
        ) : null}

        {!finished && step === 3 ? (
          <section className="admin-product-wizard__step" aria-labelledby="product-wizard-visibility-title">
            <div className="admin-product-wizard__intro">
              <p className="admin-product-wizard__eyebrow">STEP 3 · VISIBILITY</p>
              <h3 id="product-wizard-visibility-title" ref={stepHeadingRef} tabIndex={-1}>
                Decide how it appears
              </h3>
              <p>Choose whether the product is live in the shop and whether it should stand out.</p>
            </div>

            <div className="admin-product-wizard__visibility">
              <div>
                <p className="admin-product-wizard__field-title">Publish in shop</p>
                <p className="admin-product-wizard__field-hint">
                  {form.active
                    ? 'Customers can find and buy this product.'
                    : 'Saved privately until you publish it.'}
                </p>
              </div>
              <AdminOnOffPill
                value={form.active}
                onChange={(nextActive) => {
                  setForm((current) => ({
                    ...current,
                    active: nextActive,
                    featured: nextActive ? current.featured : false,
                  }));
                  if (submitError) setSubmitError('');
                }}
                ariaLabel="Publish in shop"
                onLabel="Live"
                offLabel="Hidden"
              />
            </div>

            <div className="admin-product-wizard__visibility">
              <div>
                <p className="admin-product-wizard__field-title">Featured product</p>
                <p className="admin-product-wizard__field-hint">
                  {form.featured
                    ? 'This product is highlighted in the shop catalogue.'
                    : 'Pin standout products so they catch the eye.'}
                </p>
              </div>
              <AdminOnOffPill
                value={form.featured}
                onChange={(nextFeatured) => {
                  setForm((current) => ({
                    ...current,
                    featured: nextFeatured,
                    active: nextFeatured ? true : current.active,
                  }));
                  if (submitError) setSubmitError('');
                }}
                ariaLabel="Featured product"
                onLabel="Featured"
                offLabel="Standard"
              />
            </div>
          </section>
        ) : null}

        {!finished && step === 4 ? (
          <section className="admin-product-wizard__step" aria-labelledby="product-wizard-review-title">
            <div className="admin-product-wizard__intro">
              <p className="admin-product-wizard__eyebrow">STEP 4 · REVIEW</p>
              <h3 id="product-wizard-review-title" ref={stepHeadingRef} tabIndex={-1}>
                Ready for the shelf
              </h3>
              <p>Take one last look. You can jump back to any section before saving.</p>
            </div>

            <div className="admin-product-wizard__review">
              <section>
                <div className="admin-product-wizard__review-head">
                  <h4>Product</h4>
                  <button type="button" onClick={() => moveToStep(1)}>
                    Edit
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>Image</dt>
                    <dd>
                      {form.imageUrl ? (
                        <img className="admin-product-wizard__review-image" src={form.imageUrl} alt="" />
                      ) : (
                        'No image'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Name</dt>
                    <dd>{form.name.trim()}</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>{categoryLabel}</dd>
                  </div>
                  {form.description.trim() ? (
                    <div>
                      <dt>Description</dt>
                      <dd>{form.description.trim()}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <section>
                <div className="admin-product-wizard__review-head">
                  <h4>Pricing</h4>
                  <button type="button" onClick={() => moveToStep(2)}>
                    Edit
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>Price</dt>
                    <dd>{formatGbp(pricePence)}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <div className="admin-product-wizard__review-head">
                  <h4>Visibility</h4>
                  <button type="button" onClick={() => moveToStep(3)}>
                    Edit
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>Status</dt>
                    <dd>{form.active ? 'Live' : 'Hidden'}</dd>
                  </div>
                  <div>
                    <dt>Featured</dt>
                    <dd>{form.featured ? 'Yes' : 'No'}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </section>
        ) : null}
      </div>

      <footer className="admin-product-wizard__footer">
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
                onClick={() => moveToStep((step - 1) as ProductWizardStep)}
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
                mode === 'edit' ? (
                  'Update product'
                ) : (
                  'Create product'
                )
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
