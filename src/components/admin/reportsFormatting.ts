export type DeltaType = 'percent' | 'currency' | 'pp';

export type DeltaFormat = {
  text: string;
  direction: 'up' | 'down' | 'flat';
  className: string;
};

function formatCurrencyGbp(value: number): string {
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 100) / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: Math.abs(rounded) >= 100 ? 0 : 2,
    maximumFractionDigits: Math.abs(rounded) >= 100 ? 0 : 2
  }).format(rounded);
}

export function formatDelta({ value, type }: { value: number | null | undefined; type: DeltaType }): DeltaFormat {
  if (value == null || Number.isNaN(value) || Math.abs(value) < 0.0001) {
    return { text: '—', direction: 'flat', className: 'admin-kpi-trend--flat' };
  }

  const direction = value > 0 ? 'up' : 'down';
  const className = direction === 'up' ? 'admin-kpi-trend--up' : 'admin-kpi-trend--down';
  const sign = value > 0 ? '+' : '';

  if (type === 'currency') {
    return { text: `${sign}${formatCurrencyGbp(value)}`, direction, className };
  }

  if (type === 'pp') {
    return { text: `${sign}${value.toFixed(1)}pp`, direction, className };
  }

  return { text: `${sign}${value.toFixed(1)}%`, direction, className };
}
