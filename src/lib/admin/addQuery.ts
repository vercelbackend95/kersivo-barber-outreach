/** Deep-link `?add=1` opens the section create sheet once, then is stripped from the URL. */

export function hasAdminAddQuery(
  search: string | URLSearchParams = typeof window === 'undefined' ? '' : window.location.search,
): boolean {
  const params =
    typeof search === 'string'
      ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
      : search;
  return params.get('add') === '1';
}

export function stripAdminAddQueryFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('add')) return;
  url.searchParams.delete('add');
  const qs = url.searchParams.toString();
  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`,
  );
}
