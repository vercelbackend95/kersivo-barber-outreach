/** Token-based palette for analytics chart series. */
export const CHART_OVERALL_COLOR = 'var(--accent)';

export const CHART_PRODUCT_SLOT_COLORS = [
  'var(--info)',
  'var(--success)',
  'var(--warning)',
  'var(--purple)',
  'var(--fg)',
] as const;

export const CHART_INACTIVE_COLOR = 'var(--muted)';

export function getProductSlotColor(slotIndex: number): string {
  if (slotIndex < 0) return CHART_PRODUCT_SLOT_COLORS[0];
  return CHART_PRODUCT_SLOT_COLORS[slotIndex % CHART_PRODUCT_SLOT_COLORS.length];
}

export function getSeriesColor(seriesKey: string, slotIndex: number): string {
  if (seriesKey === 'overall') return CHART_OVERALL_COLOR;
  if (seriesKey === '__empty__') return 'var(--border)';
  return getProductSlotColor(slotIndex);
}
