/**
 * Client behaviour for the /compare Alternatives Hub.
 * The page is fully server-rendered; this only re-scores, re-orders and toggles.
 * Filter state is intentionally not written to the URL (no crawlable combinations).
 */
import { HUB_CRITERION_IDS, isHubCriterionId, type HubCriterionId } from '@/lib/compare/alternativesHubCriteria';
import {
  describeScore,
  formatScoreLabel,
  rankPlatforms,
  ringDashOffset,
  type HubScoreInput,
  type HubSortMode,
  type HubStatusMap,
} from '@/lib/compare/alternativesHubScoring';

type CardInput = HubScoreInput & { el: HTMLElement };

function readCards(grid: HTMLElement): CardInput[] {
  return Array.from(grid.querySelectorAll<HTMLElement>('[data-hub-card]')).map((el) => {
    let statuses: HubStatusMap = {};
    try {
      statuses = JSON.parse(el.dataset.statuses ?? '{}') as HubStatusMap;
    } catch {
      statuses = {};
    }
    return {
      el,
      id: el.dataset.platformId ?? '',
      name: el.dataset.platformName ?? '',
      isFirstParty: el.dataset.firstParty === 'true',
      order: Number(el.dataset.order ?? 0),
      statuses,
    };
  });
}

export function initAlternativesHub(doc: Document = document): void {
  const root = doc.querySelector<HTMLElement>('[data-hub-root]');
  if (!root || root.dataset.hubReady === 'true') return;
  const grid = root.querySelector<HTMLElement>('[data-hub-grid]');
  if (!grid) return;
  root.dataset.hubReady = 'true';

  const pills = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-hub-filter]'));
  const sortSelect = root.querySelector<HTMLSelectElement>('[data-hub-sort]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-hub-reset]');
  const selectedCount = root.querySelector<HTMLElement>('[data-hub-selected-count]');
  const live = root.querySelector<HTMLElement>('[data-hub-live]');
  const suggestedNote = root.querySelector<HTMLElement>('[data-hub-suggested-note]');
  const showAll = root.querySelector<HTMLButtonElement>('[data-hub-show-all]');
  const showAllLabel = root.querySelector<HTMLElement>('[data-hub-show-all-label]');
  const moreFilters = root.querySelector<HTMLButtonElement>('[data-hub-more-filters]');
  const closeFilters = root.querySelector<HTMLButtonElement>('[data-hub-close]');
  const applyFilters = root.querySelector<HTMLButtonElement>('[data-hub-apply]');
  const visibleCount = root.querySelector<HTMLElement>('[data-hub-visible-count]');
  const moreFiltersLabel = root.querySelector<HTMLElement>('[data-hub-more-label]');
  const panel = root.querySelector<HTMLElement>('.alt-hub-panel');

  const cards = readCards(grid);
  const initialVisible = Number(root.dataset.initialVisible ?? cards.length);

  const selected = new Set<HubCriterionId>(
    pills
      .filter((p) => p.getAttribute('aria-pressed') === 'true')
      .map((p) => p.dataset.hubFilter ?? '')
      .filter(isHubCriterionId),
  );

  const orderedSelection = (): HubCriterionId[] => HUB_CRITERION_IDS.filter((id) => selected.has(id));
  const sortMode = (): HubSortMode => (sortSelect?.value === 'name' ? 'name' : 'best');

  function render(): void {
    const selection = orderedSelection();
    const mode = sortMode();
    const ranked = rankPlatforms(cards, selection, mode);

    ranked.forEach(({ platform, score }, index) => {
      const card = platform.el;
      grid!.appendChild(card);
      card.dataset.collapsed = index >= initialVisible ? 'true' : 'false';

      const ring = card.querySelector<HTMLElement>('[data-hub-ring]');
      if (ring) ring.dataset.empty = score.selected === 0 ? 'true' : 'false';
      card.querySelector<SVGCircleElement>('[data-hub-ring-value]')?.setAttribute('stroke-dashoffset', String(ringDashOffset(score.ratio)));
      const label = card.querySelector<HTMLElement>('[data-hub-score-label]');
      if (label) label.textContent = formatScoreLabel(score);
      const description = card.querySelector<HTMLElement>('[data-hub-score-description]');
      if (description) description.textContent = describeScore(score);
      const caption = card.querySelector<HTMLElement>('[data-hub-score-caption]');
      if (caption) caption.textContent = score.selected === 0 ? 'choose' : 'match';
      const summary = card.querySelector<HTMLElement>('[data-hub-score-summary]');
      if (summary) {
        summary.textContent = score.selected === 0
          ? 'Choose priorities to see confirmed matches and unknowns.'
          : `${score.matches}/${score.selected} confirmed · ${score.partial} partial · ${score.unverified} not verified`;
      }

      card.querySelectorAll<HTMLElement>('[data-criterion]').forEach((item) => {
        const id = item.dataset.criterion ?? '';
        item.dataset.selected = isHubCriterionId(id) && selected.has(id) ? 'true' : 'false';
      });
    });

    pills.forEach((pill) => {
      const id = pill.dataset.hubFilter ?? '';
      pill.setAttribute('aria-pressed', isHubCriterionId(id) && selected.has(id) ? 'true' : 'false');
    });

    if (selectedCount) selectedCount.textContent = String(selection.length);
    if (suggestedNote) suggestedNote.hidden = selection.length !== 0;
    if (live) {
      const sortText = mode === 'name' ? 'sorted by name' : 'sorted by best match';
      const shown = grid!.dataset.expanded === 'true' ? cards.length : Math.min(initialVisible, cards.length);
      if (visibleCount) visibleCount.textContent = String(shown);
      live.textContent =
        selection.length === 0
          ? `${shown} of ${cards.length} systems shown. Select priorities to see match scores.`
          : `${shown} of ${cards.length} systems shown, ${sortText} for ${selection.length} selected ${selection.length === 1 ? 'priority' : 'priorities'}.`;
    }
  }

  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const id = pill.dataset.hubFilter ?? '';
      if (!isHubCriterionId(id)) return;
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      // Changing priorities always reveals the complete ranked list, including Booksy.
      if (selected.size > 0) setShowAll(true);
      render();
    });
  });

  sortSelect?.addEventListener('change', render);

  resetButton?.addEventListener('click', () => {
    selected.clear();
    setShowAll(false);
    render();
  });

  function setShowAll(expanded: boolean): void {
    grid!.dataset.expanded = expanded ? 'true' : 'false';
    showAll?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if (showAllLabel) showAllLabel.textContent = expanded ? 'Show fewer systems' : `Show all systems (${cards.length})`;
  }

  showAll?.addEventListener('click', () => {
    setShowAll(grid.dataset.expanded !== 'true');
    render();
  });

  // Mobile filter sheet reuses the server-rendered criteria; no duplicate state.
  const mobileSheetQuery = doc.defaultView?.matchMedia?.('(max-width: 720px)');
  let lastFocus: HTMLElement | null = null;
  let previousOverflow = '';

  function closeSheet(restoreFocus = true): void {
    if (panel) {
      panel.dataset.filtersExpanded = 'false';
      panel.removeAttribute('role');
      panel.removeAttribute('aria-modal');
      panel.removeAttribute('aria-label');
    }
    moreFilters?.setAttribute('aria-expanded', 'false');
    moreFilters?.setAttribute('aria-label', 'Open all comparison filters');
    if (moreFiltersLabel) moreFiltersLabel.textContent = 'All filters';
    if (mobileSheetQuery?.matches) doc.documentElement.style.overflow = previousOverflow;
    if (restoreFocus) lastFocus?.focus();
    lastFocus = null;
  }

  moreFilters?.addEventListener('click', () => {
    const expanded = panel?.dataset.filtersExpanded !== 'true';
    if (!expanded) {
      closeSheet();
      return;
    }

    lastFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    if (panel) {
      panel.dataset.filtersExpanded = 'true';
      if (mobileSheetQuery?.matches) {
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', 'Compare booking software filters');
      }
    }
    moreFilters.setAttribute('aria-expanded', 'true');
    moreFilters.setAttribute('aria-label', 'Apply comparison filters and close');
    if (moreFiltersLabel) moreFiltersLabel.textContent = mobileSheetQuery?.matches ? 'Close' : 'Fewer filters';

    if (mobileSheetQuery?.matches) {
      previousOverflow = doc.documentElement.style.overflow;
      doc.documentElement.style.overflow = 'hidden';
      pills[0]?.focus();
    }
  });

  closeFilters?.addEventListener('click', () => closeSheet());
  applyFilters?.addEventListener('click', () => closeSheet());

  doc.addEventListener('keydown', (event) => {
    if (panel?.dataset.filtersExpanded !== 'true') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSheet();
    }
    if (event.key !== 'Tab' || !mobileSheetQuery?.matches) return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), a[href]'),
    ).filter((el) => el.getClientRects().length > 0);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  doc.addEventListener('click', (event) => {
    if (!mobileSheetQuery?.matches || panel?.dataset.filtersExpanded !== 'true') return;
    if (event.target instanceof Node && !panel.contains(event.target)) closeSheet();
  });

  mobileSheetQuery?.addEventListener?.('change', () => {
    if (!mobileSheetQuery?.matches && panel?.dataset.filtersExpanded === 'true') {
      previousOverflow = '';
      closeSheet(false);
      doc.documentElement.style.removeProperty('overflow');
    }
  });
  doc.addEventListener('astro:before-swap', () => {
    if (panel?.dataset.filtersExpanded === 'true') closeSheet(false);
  });

  render();
}
