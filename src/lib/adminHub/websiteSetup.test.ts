import { describe, expect, it } from 'vitest';
import {
  businessComplete,
  businessPatch,
  BUSINESS_PROFILE_FIELDS,
  changedRows,
  durationLabel,
  emptyBusinessDraft,
  listsEqual,
  moveRow,
  newRows,
  orderChanged,
  productRowError,
  productRowFromApi,
  SERVICE_FIELDS,
  serviceRowError,
  serviceRowFromApi,
  SETUP_COPY,
  setupCompletion,
  teamRowError,
  teamRowFromApi,
  type ServiceRow,
} from './websiteSetup';

const service = (over: Partial<ServiceRow> = {}): ServiceRow => ({
  key: 's1',
  id: 's1',
  name: 'Skin fade',
  price: '22',
  priceFrom: false,
  durationMinutes: 45,
  category: 'featured',
  isActive: true,
  ...over,
});

describe('website setup view-model', () => {
  it('uses British copy with an honest save hint (no instant-publish claim)', () => {
    expect(SETUP_COPY.hint).toBe('Saved changes show on your website preview the next time it loads.');
    expect(SETUP_COPY.progress(2, 5)).toBe('2 of 5 sections complete');
    expect(Object.values(SETUP_COPY.sections).map((s) => s.title).slice(0, 5)).toEqual([
      'Business details',
      'Opening hours',
      'Services',
      'Team',
      'Products',
    ]);
  });

  it('counts completion from saved data only', () => {
    const empty = { business: emptyBusinessDraft(), hoursSaved: false, services: [], team: [], products: [] };
    expect(setupCompletion(empty)).toEqual({ done: 0, total: 5, label: '0 of 5 sections complete' });
    const some = {
      business: { ...emptyBusinessDraft(), postcode: 'M1 1AE', phone: '0161 496 0000' },
      hoursSaved: true,
      services: [service(), { ...service(), key: 'new', id: null }],
      team: [{ key: 'b', id: 'b', isActive: false }],
      products: [{ key: 'new', id: null, isActive: true }],
    };
    // Inactive team members and unsaved products do not count.
    expect(setupCompletion(some).done).toBe(3);
  });

  it('needs an address and a way to get in touch for business details', () => {
    expect(businessComplete({ ...emptyBusinessDraft(), addressLine1: '1 High St' })).toBe(false);
    expect(businessComplete({ ...emptyBusinessDraft(), addressLine1: '1 High St', email: 'a@b.co.uk' })).toBe(true);
  });

  it('sends only changed business fields, with null for cleared ones', () => {
    const saved = { ...emptyBusinessDraft(), phone: '0161', postcode: 'M1 1AE' };
    const draft = { ...saved, phone: '  ', tagline: 'Sharp cuts', postcode: 'M1 1AE ' };
    expect(businessPatch(saved, draft, BUSINESS_PROFILE_FIELDS)).toEqual({ phone: null, tagline: 'Sharp cuts' });
  });

  it('maps API rows with prices in pence to pound inputs and back', () => {
    expect(serviceRowFromApi({ id: 's', name: 'Cut', pricePence: 1250, durationMinutes: 30, category: null, isActive: true })).toMatchObject({
      price: '12.50',
      category: '',
      priceFrom: false,
    });
    expect(teamRowFromApi({ id: 'b', name: 'Jo', active: false })).toMatchObject({ title: '', showOnWebsite: true, isActive: false });
    const product = productRowFromApi({ id: 'p', name: 'Clay', pricePence: 1500, active: true, inStock: false, description: 'Matte' });
    expect(product).toMatchObject({ price: '15', inStock: false, isActive: true, rest: { description: 'Matte' } });
  });

  it('validates rows before anything is sent', () => {
    expect(serviceRowError(service())).toBeNull();
    expect(serviceRowError(service({ name: ' ' }))).toBe('Enter a service name.');
    expect(serviceRowError(service({ price: '12.345' }))).toMatch(/price in pounds/);
    // Older saved services may have no category; new ones must choose one.
    expect(serviceRowError(service({ category: '' }))).toBeNull();
    expect(serviceRowError(service({ id: null, category: '' }))).toBe('Choose a category.');
    expect(teamRowError({ key: 'b', id: null, isActive: true, name: 'Jo', title: 'x'.repeat(61), showOnWebsite: true })).toMatch(/60 characters/);
    expect(productRowError({ key: 'p', id: null, isActive: true, name: 'Clay', price: '0', inStock: true, rest: {} })).toMatch(/price/);
  });

  it('tracks changed, new and reordered rows', () => {
    const saved = [service(), service({ key: 's2', id: 's2', name: 'Beard trim' })];
    expect(listsEqual(saved, saved, SERVICE_FIELDS)).toBe(true);
    const edited = [service({ price: '24' }), saved[1]!];
    expect(changedRows(saved, edited, SERVICE_FIELDS).map((r) => r.id)).toEqual(['s1']);
    const added = [...saved, service({ key: 'tmp', id: null, name: 'Kids cut' })];
    expect(newRows(added).map((r) => r.name)).toEqual(['Kids cut']);
    const moved = moveRow(saved, 0, 1);
    expect(moved.map((r) => r.id)).toEqual(['s2', 's1']);
    expect(orderChanged(saved, moved)).toBe(true);
    expect(moveRow(saved, 0, -1)).toEqual(saved);
  });

  it('labels durations in hours and minutes', () => {
    expect(durationLabel(45)).toBe('45 min');
    expect(durationLabel(60)).toBe('1 hr');
    expect(durationLabel(75)).toBe('1 hr 15 min');
  });
});
