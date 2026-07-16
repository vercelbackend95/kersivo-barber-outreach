import { describe, expect, it } from 'vitest';
import { groupServicesByCategory, type BookableService } from './groupServicesByCategory';

function service(partial: Partial<BookableService> & Pick<BookableService, 'id' | 'name'>): BookableService {
  return {
    durationMinutes: 30,
    pricePence: 3500,
    ...partial
  };
}

describe('groupServicesByCategory', () => {
  it('sorts featured services first within a category, then displayOrder', () => {
    const groups = groupServicesByCategory([
      service({ id: '1', name: 'Standard cut', category: 'styling', displayOrder: 1 }),
      service({ id: '2', name: 'Signature cut', category: 'styling', displayOrder: 5, featured: true }),
      service({ id: '3', name: 'Premium cut', category: 'styling', displayOrder: 2 })
    ]);

    expect(groups[0]?.services.map((item) => item.name)).toEqual(['Signature cut', 'Standard cut', 'Premium cut']);
  });

  it('groups services in default category order with displayOrder sorting', () => {
    const groups = groupServicesByCategory([
      service({ id: '1', name: 'Hair wash', category: 'styling', displayOrder: 10 }),
      service({ id: '2', name: 'Quality haircut', category: 'featured', displayOrder: 1 }),
      service({ id: '3', name: 'Premium haircut', category: 'featured', displayOrder: 2 }),
      service({ id: '4', name: 'Express shave', category: 'shaving', displayOrder: 14 })
    ]);

    expect(groups.map((group) => group.label)).toEqual(['Featured', 'Styling', 'Shaving']);
    expect(groups[0]?.services.map((item) => item.name)).toEqual(['Quality haircut', 'Premium haircut']);
  });

  it('puts uncategorized services in Other at the end', () => {
    const groups = groupServicesByCategory([
      service({ id: '1', name: 'Mystery', category: null }),
      service({ id: '2', name: 'Quality haircut', category: 'featured', displayOrder: 1 })
    ]);

    expect(groups.at(-1)).toMatchObject({ label: 'Other', services: [{ name: 'Mystery' }] });
  });
});
