import {
  CATEGORY_LABELS,
  PRODUCT_CATEGORY_VALUES,
  type ProductCategory,
} from '@/lib/shop/productPresentation';

export type ProductWizardMode = 'create' | 'edit';

export type ProductWizardStep = 1 | 2 | 3 | 4;

export type { ProductCategory };

export type ProductForm = {
  name: string;
  description: string;
  imageUrl: string;
  category: ProductCategory;
  priceGbp: string;
  active: boolean;
  featured: boolean;
  sortOrder: number;
};

export type ProductCategoryOption = {
  value: ProductCategory;
  label: string;
};

export type ProductWizardErrors = Partial<Record<'name' | 'description' | 'category' | 'priceGbp', string>>;

export const PRODUCT_CATEGORY_OPTIONS: ProductCategoryOption[] = PRODUCT_CATEGORY_VALUES.map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));

export const EMPTY_PRODUCT_FORM: ProductForm = {
  name: '',
  description: '',
  imageUrl: '',
  category: 'STYLING',
  priceGbp: '',
  active: true,
  featured: false,
  sortOrder: 0
};

export const PRODUCT_WIZARD_STEPS: Array<{ number: ProductWizardStep; label: string }> = [
  { number: 1, label: 'Basics' },
  { number: 2, label: 'Pricing' },
  { number: 3, label: 'Visibility' },
  { number: 4, label: 'Review' }
];

export const PRODUCT_DESCRIPTION_MAX_LENGTH = 2000;

export function parseGbpToPence(input: string): number {
  if (!input.trim()) return -1;
  const value = Number(input.replace(',', '.'));
  return Number.isFinite(value) ? Math.round(value * 100) : -1;
}

export function formatGbp(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(pence / 100);
}

export function getProductCategoryLabel(category: ProductCategory): string {
  return PRODUCT_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
}

export function validateProductWizardStep(step: ProductWizardStep, form: ProductForm): ProductWizardErrors {
  const errors: ProductWizardErrors = {};

  if (step === 1) {
    const name = form.name.trim();
    const description = form.description.trim();

    if (!name) errors.name = 'Enter a product name.';
    else if (name.length > 120) errors.name = 'Keep the name to 120 characters or fewer.';

    if (description.length > PRODUCT_DESCRIPTION_MAX_LENGTH) {
      errors.description = `Keep the description to ${PRODUCT_DESCRIPTION_MAX_LENGTH} characters or fewer.`;
    }

    if (!form.category) errors.category = 'Choose a category.';
  }

  if (step === 2) {
    const pricePence = parseGbpToPence(form.priceGbp);
    if (pricePence <= 0) errors.priceGbp = 'Enter a price greater than £0.00.';
  }

  return errors;
}
