/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasAdminAddQuery, stripAdminAddQueryFromUrl } from './addQuery';

describe('hasAdminAddQuery', () => {
  it('is true only for add=1', () => {
    expect(hasAdminAddQuery('add=1')).toBe(true);
    expect(hasAdminAddQuery('?add=1')).toBe(true);
    expect(hasAdminAddQuery('section=services&add=1')).toBe(true);
    expect(hasAdminAddQuery('add=true')).toBe(false);
    expect(hasAdminAddQuery('')).toBe(false);
    expect(hasAdminAddQuery(new URLSearchParams('add=1'))).toBe(true);
  });
});

describe('stripAdminAddQueryFromUrl', () => {
  afterEach(() => {
    window.history.replaceState(window.history.state, '', '/');
    vi.restoreAllMocks();
  });

  it('removes add with replaceState and keeps the rest of the query', () => {
    window.history.replaceState({ adminSection: 'services' }, '', '/admin?section=services&add=1');
    const replaceState = vi.spyOn(window.history, 'replaceState');

    stripAdminAddQueryFromUrl();

    expect(replaceState).toHaveBeenCalledWith(
      expect.anything(),
      '',
      '/admin?section=services',
    );
  });

  it('is a no-op when add is already absent', () => {
    window.history.replaceState(null, '', '/admin/services');
    const replaceState = vi.spyOn(window.history, 'replaceState');

    stripAdminAddQueryFromUrl();
    expect(replaceState).not.toHaveBeenCalled();
  });
});
