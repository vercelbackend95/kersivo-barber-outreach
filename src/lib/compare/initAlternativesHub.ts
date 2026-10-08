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

function parseSuggested(value: string | undefined): HubCriterionId[] {
  return (value ?? '').split(',').filter(isHubCriterionId);
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
  const moreFiltersLabel = root.querySelector<HTMLElement>('[data-hub-more-label]');
  const panel = root.querySelector<HTMLElement>('.alt-hub-panel');

  const cards = readCards(grid);
  const initialVisible = Number(root.dataset.initialVisible ?? cards.length);
  const suggested = parseSuggested(root.dataset.suggested);
  const extraPillCount = pills.filter((p) => p.classList.contains('alt-hub-pill--extra')).length;

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
    if (suggestedNote) {
      const isSuggested =
        selection.length === suggested.length && suggested.every((id) => selected.has(id));
      suggestedNote.hidden = !isSuggested;
    }
    if (live) {
      const sortText = mode === 'name' ? 'sorted by name' : 'sorted by best match';
      live.textContent =
        selection.length === 0
          ? `${cards.length} systems shown. Select priorities to see a match score.`
          : `${cards.length} systems shown, ${sortText} for ${selection.length} selected ${selection.length === 1 ? 'priority' : 'priorities'}.`;
    }
  }

  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const id = pill.dataset.hubFilter ?? '';
      if (!isHubCriterionId(id)) return;
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      render();
    });
  });

  sortSelect?.addEventListener('change', render);

  resetButton?.addEventListener('click', () => {
    selected.clear();
    render();
  });

  showAll?.addEventListener('click', () => {
    const expanded = grid.dataset.expanded !== 'true';
    grid.dataset.expanded = expanded ? 'true' : 'false';
    showAll.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if (showAllLabel) showAllLabel.textContent = expanded ? 'Show fewer systems' : `Show all systems (${cards.length})`;
  });

  moreFilters?.addEventListener('click', () => {
    const expanded = panel?.dataset.filtersExpanded !== 'true';
    if (panel) panel.dataset.filtersExpanded = expanded ? 'true' : 'false';
    moreFilters.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if (moreFiltersLabel) moreFiltersLabel.textContent = expanded ? 'Fewer filters' : `More filters (${extraPillCount})`;
  });

  render();
}
