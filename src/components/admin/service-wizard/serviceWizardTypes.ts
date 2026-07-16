export type ServiceWizardMode = 'create' | 'edit';

export type ServiceWizardStep = 1 | 2 | 3 | 4;

export type ServiceForm = {
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  priceGbp: string;
  durationMinutes: string;
  bufferMinutes: string;
  displayOrder: string;
  isActive: boolean;
  featured: boolean;
};

export type ServiceWizardBarber = {
  id: string;
  name: string;
  isActive: boolean;
  avatarUrl?: string | null;
};

export type ServiceWizardErrors = Partial<
  Record<'name' | 'description' | 'category' | 'priceGbp' | 'durationMinutes', string>
>;

export const EMPTY_SERVICE_FORM: ServiceForm = {
  name: '',
  description: '',
  imageUrl: '',
  category: '',
  priceGbp: '',
  durationMinutes: '30',
  bufferMinutes: '0',
  displayOrder: '0',
  isActive: true,
  featured: false
};

export const SERVICE_WIZARD_STEPS: Array<{ number: ServiceWizardStep; label: string }> = [
  { number: 1, label: 'Basics' },
  { number: 2, label: 'Pricing' },
  { number: 3, label: 'Team' },
  { number: 4, label: 'Review' }
];

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

function isIntegerInRange(value: string, min: number, max?: number): boolean {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && (max === undefined || parsed <= max);
}

export function validateServiceWizardStep(step: ServiceWizardStep, form: ServiceForm): ServiceWizardErrors {
  const errors: ServiceWizardErrors = {};

  if (step === 1) {
    const name = form.name.trim();
    const description = form.description.trim();
    const category = form.category.trim();

    if (!name) errors.name = 'Enter a service name.';
    else if (name.length > 120) errors.name = 'Keep the name to 120 characters or fewer.';

    if (description.length > 280) errors.description = 'Keep the description to 280 characters or fewer.';

    if (!category) errors.category = 'Choose or add a category.';
    else if (category.length > 80) errors.category = 'Keep the category to 80 characters or fewer.';
  }

  if (step === 2) {
    const pricePence = parseGbpToPence(form.priceGbp);
    if (pricePence < 0) errors.priceGbp = 'Enter a valid price.';
    if (!isIntegerInRange(form.durationMinutes, 5, 480)) {
      errors.durationMinutes = 'Duration must be between 5 and 480 minutes.';
    }
  }

  return errors;
}
