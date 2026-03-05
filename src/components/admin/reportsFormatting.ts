export type TrendTone = 'higher_better' | 'lower_better' | 'neutral';
export type DeltaType = 'percent' | 'currency' | 'pp' | 'count';


export type DeltaFormat = {
  text: string;
  direction: 'up' | 'down' | 'flat';
  className: string;
    isNew?: boolean;
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

function getClassName(direction: 'up' | 'down' | 'flat', tone: TrendTone): string {
  if (direction === 'flat' || tone === 'neutral') return 'admin-kpi-trend--flat';

  if (tone === 'higher_better') {
    return direction === 'up' ? 'admin-kpi-trend--up' : 'admin-kpi-trend--down';

  }

  return direction === 'down' ? 'admin-kpi-trend--up' : 'admin-kpi-trend--down';
}

function formatRawValue(value: number, type: DeltaType): string {
  if (type === 'currency') return formatCurrencyGbp(value);
  if (type === 'pp') return `${value.toFixed(1)}pp`;
  if (type === 'count') return `${Math.round(value)}`;
  return `${value.toFixed(1)}%`;
}


export function formatDelta({
  value,
  type,
  tone = 'higher_better',
  currentValue,
  previousValue
}: {
  value: number | null | undefined;
  type: DeltaType;
  tone?: TrendTone;
  currentValue?: number | null;
  previousValue?: number | null;
}): DeltaFormat {
  const safeCurrent = currentValue ?? null;
  const safePrevious = previousValue ?? null;

  if (safePrevious === 0) {
    if ((safeCurrent ?? 0) === 0) {
      return { text: '—', direction: 'flat', className: 'admin-kpi-trend--flat' };
    }

    if ((safeCurrent ?? 0) > 0) {
      const baseText = type === 'currency'
        ? `+${formatCurrencyGbp(safeCurrent ?? 0)}`
        : type === 'pp'
          ? `+${(safeCurrent ?? 0).toFixed(1)}pp`
          : `+${Math.round(safeCurrent ?? 0)}`;
      return {
        text: `${baseText} new`,
        direction: 'up',
        className: getClassName('up', tone),
        isNew: true
      };
    }

  }

  if (value == null || Number.isNaN(value) || Math.abs(value) < 0.0001) {
    return { text: '—', direction: 'flat', className: 'admin-kpi-trend--flat' };

  }

  const direction = value > 0 ? 'up' : 'down';
  const sign = value > 0 ? '+' : '';

  return {
    text: `${sign}${formatRawValue(value, type)}`,
    direction,
    className: getClassName(direction, tone)
  };

}
