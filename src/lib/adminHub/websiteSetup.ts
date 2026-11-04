/**
 * Overview › Add to your website: the guided setup flow's view-model. Client-safe, no I/O.
 *
 * Statuses and the completion count come from saved data only (what the shop's canonical records
 * hold), never from unsaved edits or demo values.
 */
import { parsePoundsToPence, penceToPoundsInput } from '@/lib/shopData/schema';
import type { OpeningDay } from '@/lib/shopData/openingHours';

export const SETUP_SECTION_IDS = ['business', 'hours', 'services', 'team', 'products'] as const;
export type SetupSectionId = (typeof SETUP_SECTION_IDS)[number];

export const SETUP_COPY = {
  title: 'Set up your website',
  intro: 'Work through each section at your own pace. You can come back to any of them later.',
  hint: 'Saved changes show on your website preview the next time it loads.',
  complete: 'Complete',
  notSetUp: 'Not set up',
  progress: (done: number, total: number) => `${done} of ${total} sections complete`,
  save: 'Save changes',
  saving: 'Saving…',
  discard: 'Discard',
  saved: 'Changes saved.',
  unsaved: 'You have unsaved changes.',
  saveFailed: 'Some changes could not be saved. Check the highlighted sections and try again.',
  shopNeeded: 'Set up your shop to add your business details, opening hours, services, team and products.',
  shopButton: 'Set up my shop',
  readOnly: 'These details are managed from your KERSIVO dashboard now.',
  loadFailed: 'We could not load your shop details. Please try again.',
  retry: 'Try again',
  sections: {
    business: { title: 'Business details', description: 'Your address and how customers contact you.' },
    hours: { title: 'Opening hours', description: 'When customers can visit and book.' },
    services: { title: 'Services', description: 'What you offer, how long it takes and the price.' },
    team: { title: 'Team', description: 'The barbers shown on your website.' },
    products: { title: 'Products', description: 'Products appear on your website with Full KERSIVO.' },
    files: { title: 'Photos, logo and files', description: 'Images and files for your website.' },
    text: { title: 'Website text', description: 'Anything else you would like on your website.' },
  },
} as const;

// ---------------------------------------------------------------------------
// Business details
// ---------------------------------------------------------------------------

export type BusinessDraft = {
  tagline: string;
  aboutText: string;
  addressLine1: string;
  addressLine2: string;
  postcode: string;
  phone: string;
  email: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
};

/** Fields saved through /api/admin-hub/details (legacy mirror kept); the rest go to /profile. */
export const BUSINESS_DETAILS_FIELDS = ['aboutText', 'instagramUrl'] as const;
export const BUSINESS_PROFILE_FIELDS = [
  'tagline',
  'addressLine1',
  'addressLine2',
  'postcode',
  'phone',
  'email',
  'facebookUrl',
  'tiktokUrl',
] as const;

export function emptyBusinessDraft(): BusinessDraft {
  return {
    tagline: '',
    aboutText: '',
    addressLine1: '',
    addressLine2: '',
    postcode: '',
    phone: '',
    email: '',
    instagramUrl: '',
    facebookUrl: '',
    tiktokUrl: '',
  };
}

/** Complete once customers can find you (a street line or postcode) and reach you (phone or email). */
export function businessComplete(saved: BusinessDraft): boolean {
  const hasAddress = Boolean(saved.addressLine1.trim() || saved.postcode.trim());
  const hasContact = Boolean(saved.phone.trim() || saved.email.trim());
  return hasAddress && hasContact;
}

/** Changed fields only, as `null` when cleared (the APIs treat null as "clear"). */
export function businessPatch<K extends keyof BusinessDraft>(
  saved: BusinessDraft,
  draft: BusinessDraft,
  fields: readonly K[],
): Partial<Record<K, string | null>> {
  const patch: Partial<Record<K, string | null>> = {};
  for (const field of fields) {
    if (saved[field].trim() === draft[field].trim()) continue;
    patch[field] = draft[field].trim() || null;
  }
  return patch;
}

// ---------------------------------------------------------------------------
// Lists (services, team, products)
// ---------------------------------------------------------------------------

type RowBase = { key: string; id: string | null; isActive: boolean };

export type ServiceRow = RowBase & {
  name: string;
  price: string;
  priceFrom: boolean;
  durationMinutes: number;
  category: string;
};

export type TeamRow = RowBase & {
  name: string;
  title: string;
  showOnWebsite: boolean;
};

export type ProductRow = RowBase & {
  name: string;
  price: string;
  inStock: boolean;
  /** Fields the hub does not edit, sent back unchanged (the update route needs the whole product). */
  rest: Record<string, unknown>;
};

export type ServiceApi = {
  id: string;
  name: string;
  pricePence: number;
  priceFrom?: boolean;
  durationMinutes: number;
  category: string | null;
  isActive: boolean;
};

export type BarberApi = {
  id: string;
  name: string;
  title?: string | null;
  showOnWebsite?: boolean;
  isActive?: boolean;
  active?: boolean;
};

export type ProductApi = {
  id: string;
  name: string;
  pricePence: number;
  inStock?: boolean;
  active: boolean;
  [key: string]: unknown;
};

export function serviceRowFromApi(row: ServiceApi): ServiceRow {
  return {
    key: row.id,
    id: row.id,
    name: row.name,
    price: penceToPoundsInput(row.pricePence),
    priceFrom: Boolean(row.priceFrom),
    durationMinutes: row.durationMinutes,
    category: row.category ?? '',
    isActive: row.isActive,
  };
}

export function teamRowFromApi(row: BarberApi): TeamRow {
  return {
    key: row.id,
    id: row.id,
    name: row.name,
    title: row.title ?? '',
    showOnWebsite: row.showOnWebsite !== false,
    isActive: row.isActive ?? row.active ?? true,
  };
}

export function productRowFromApi(row: ProductApi): ProductRow {
  const { id, name, pricePence, inStock, active, ...rest } = row;
  return {
    key: id,
    id,
    name,
    price: penceToPoundsInput(pricePence),
    inStock: inStock !== false,
    isActive: active,
    rest,
  };
}

/** Saved (persisted) active rows: what the website can show today. */
export function activeCount(rows: readonly RowBase[]): number {
  return rows.filter((row) => row.id && row.isActive).length;
}

/** Rows whose editable fields differ from the saved copy (new rows are not "changed"). */
export function changedRows<T extends RowBase>(saved: readonly T[], draft: readonly T[], fields: readonly (keyof T)[]): T[] {
  const byId = new Map(saved.map((row) => [row.id, row]));
  return draft.filter((row) => {
    if (!row.id) return false;
    const before = byId.get(row.id);
    if (!before) return false;
    return fields.some((field) => before[field] !== row[field]);
  });
}

export function newRows<T extends RowBase>(draft: readonly T[]): T[] {
  return draft.filter((row) => !row.id);
}

export function orderChanged(saved: readonly RowBase[], draft: readonly RowBase[]): boolean {
  const before = saved.map((row) => row.key);
  const after = draft.map((row) => row.key);
  return before.length !== after.length || before.some((key, index) => key !== after[index]);
}

export function listsEqual<T extends RowBase>(saved: readonly T[], draft: readonly T[], fields: readonly (keyof T)[]): boolean {
  return !orderChanged(saved, draft) && newRows(draft).length === 0 && changedRows(saved, draft, fields).length === 0;
}

export function moveRow<T>(rows: readonly T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= rows.length) return [...rows];
  const next = [...rows];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved!);
  return next;
}

export const SERVICE_FIELDS = ['name', 'price', 'priceFrom', 'durationMinutes', 'category', 'isActive'] as const;
export const TEAM_FIELDS = ['name', 'title', 'showOnWebsite', 'isActive'] as const;
export const PRODUCT_FIELDS = ['name', 'price', 'inStock', 'isActive'] as const;

/** Inline row errors before anything is sent (the routes validate again). */
export function serviceRowError(row: ServiceRow): string | null {
  if (!row.name.trim()) return 'Enter a service name.';
  if (parsePoundsToPence(row.price) === null) return 'Enter a price in pounds, e.g. 25 or 25.50.';
  // Older services may have no category; only new ones must pick one (the create route requires it).
  if (!row.id && !row.category.trim()) return 'Choose a category.';
  return null;
}

export function teamRowError(row: TeamRow): string | null {
  if (!row.name.trim()) return 'Enter a name.';
  if (row.title.trim().length > 60) return 'Keep the role to 60 characters or fewer.';
  return null;
}

export function productRowError(row: ProductRow): string | null {
  if (!row.name.trim()) return 'Enter a product name.';
  const pence = parsePoundsToPence(row.price);
  if (pence === null || pence <= 0) return 'Enter a price in pounds, e.g. 12 or 12.50.';
  return null;
}

/** "45 min", "1 hr", "1 hr 15 min". */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export const DURATION_OPTIONS: readonly number[] = [
  ...Array.from({ length: 24 }, (_, i) => (i + 1) * 5), // 5 … 120
  135, 150, 165, 180, 210, 240,
];

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

export type SetupSavedState = {
  business: BusinessDraft;
  hoursSaved: boolean;
  services: readonly RowBase[];
  team: readonly RowBase[];
  products: readonly RowBase[];
};

export function setupSectionStatus(saved: SetupSavedState): Record<SetupSectionId, boolean> {
  return {
    business: businessComplete(saved.business),
    hours: saved.hoursSaved,
    services: activeCount(saved.services) > 0,
    team: activeCount(saved.team) > 0,
    products: activeCount(saved.products) > 0,
  };
}

export function setupCompletion(saved: SetupSavedState): { done: number; total: number; label: string } {
  const status = setupSectionStatus(saved);
  const done = SETUP_SECTION_IDS.filter((id) => status[id]).length;
  const total = SETUP_SECTION_IDS.length;
  return { done, total, label: SETUP_COPY.progress(done, total) };
}

export type { OpeningDay };
