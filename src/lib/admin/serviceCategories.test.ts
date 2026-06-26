import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SERVICE_CATEGORIES,
  mergeServiceCategories,
  normalizeServiceCategory
} from './serviceCategories';

describe('serviceCategories', () => {
  it('returns default categories first and deduplicates case-insensitively', () => {
    const merged = mergeServiceCategories(['Packages', 'packages'], ['Styling', 'featured']);
    expect(merged[0]).toBe(DEFAULT_SERVICE_CATEGORIES[0]);
    expect(merged).toContain('Packages');
    expect(merged).toContain('styling');
    expect(merged.filter((entry) => entry.toLowerCase() === 'styling')).toHaveLength(1);
  });

  it('normalizes and truncates category names', () => {
    expect(normalizeServiceCategory('  beard styling  ')).toBe('beard styling');
    expect(normalizeServiceCategory('   ')).toBeNull();
  });
});
