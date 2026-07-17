export type TrendTone = 'higher_better' | 'lower_better' | 'neutral';
export type DeltaType = 'percent' | 'currency' | 'pp' | 'count';

/** How to format the absolute change next to the percent (Coinbase-style). */
export type DeltaValueType = 'currency' | 'pp' | 'count';

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
    maximumFractionDigits: Math.abs(rounded) >= 100 ? 0 : 2,
  }).format(rounded);
}

function getClassName(direction: 'up' | 'down' | 'flat', tone: TrendTone): string {
  if (direction === 'flat' || tone === 'neutral') return 'admin-kpi-trend--flat';

  if (tone === 'higher_better') {
    return direction === 'up' ? 'admin-kpi-trend--up' : 'admin-kpi-trend--down';
  }

  return direction === 'down' ? 'admin-kpi-trend--up' : 'admin-kpi-trend--down';
}

function formatRawValue(value: number, type: DeltaType | DeltaValueType): string {
  if (type === 'currency') return formatCurrencyGbp(value);
  if (type === 'pp') return `${value.toFixed(1)}pp`;
  if (type === 'count') return `${Math.round(value)}`;
  return `${value.toFixed(1)}%`;
}

function signedAbs(value: number, type: DeltaType | DeltaValueType): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatRawValue(Math.abs(value), type)}`;
}

/**
 * Coinbase-style delta: absolute change + percent in parentheses.
 * Zero previous baseline uses a conventional 100% (true % is undefined).
 */
export function formatDelta({
  value,
  type,
  valueType,
  tone = 'higher_better',
  currentValue,
  previousValue,
}: {
  value: number | null | undefined;
  type: DeltaType;
  /** When set, render absolute change + (percent) like Coinbase. */
  valueType?: DeltaValueType;
  tone?: TrendTone;
  currentValue?: number | null;
  previousValue?: number | null;
}): DeltaFormat {
  const safeCurrent = currentValue ?? null;
  const safePrevious = previousValue ?? null;

  if (valueType && safeCurrent != null && safePrevious != null) {
    if (safePrevious === 0) {
      if (safeCurrent === 0) {
        return { text: '—', direction: 'flat', className: 'admin-kpi-trend--flat' };
      }
      if (safeCurrent > 0) {
        return {
          text: `+${formatRawValue(safeCurrent, valueType)} (100%)`,
          direction: 'up',
          className: getClassName('up', tone),
        };
      }
    }

    const absDelta = safeCurrent - safePrevious;
    if (Math.abs(absDelta) < 0.0001) {
      return { text: '—', direction: 'flat', className: 'admin-kpi-trend--flat' };
    }

    const pct = type === 'percent' && value != null && !Number.isNaN(value)
      ? value
      : safePrevious > 0
        ? (absDelta / safePrevious) * 100
        : null;

    const direction: 'up' | 'down' = absDelta > 0 ? 'up' : 'down';
    const absText = signedAbs(absDelta, valueType);
    if (pct == null || Number.isNaN(pct) || Math.abs(pct) < 0.0001) {
      return {
        text: absText,
        direction,
        className: getClassName(direction, tone),
      };
    }

    const pctSign = pct > 0 ? '+' : '-';
    return {
      text: `${absText} (${pctSign}${Math.abs(pct).toFixed(1)}%)`,
      direction,
      className: getClassName(direction, tone),
    };
  }

  // Legacy / simple path (no valueType): keep compact percent/pp/count labels.
  if (safePrevious === 0) {
    if ((safeCurrent ?? 0) === 0) {
      return { text: '—', direction: 'flat', className: 'admin-kpi-trend--flat' };
    }

    if ((safeCurrent ?? 0) > 0) {
      if (type === 'currency') {
        return {
          text: `+${formatCurrencyGbp(safeCurrent ?? 0)} (100%)`,
          direction: 'up',
          className: getClassName('up', tone),
        };
      }
      if (type === 'pp') {
        return {
          text: `+${(safeCurrent ?? 0).toFixed(1)}pp (100%)`,
          direction: 'up',
          className: getClassName('up', tone),
        };
      }
      if (type === 'count') {
        return {
          text: `+${Math.round(safeCurrent ?? 0)} (100%)`,
          direction: 'up',
          className: getClassName('up', tone),
        };
      }
      return {
        text: '+100%',
        direction: 'up',
        className: getClassName('up', tone),
      };
    }
  }

  if (value == null || Number.isNaN(value) || Math.abs(value) < 0.0001) {
    return { text: '—', direction: 'flat', className: 'admin-kpi-trend--flat' };
  }

  const direction = value > 0 ? 'up' : 'down';
  // Favorable higher-better: "+12.5%". Favorable lower-better (negative value): "1.2pp" with no minus.
  const sign = value > 0 ? '+' : '';

  return {
    text: `${sign}${formatRawValue(Math.abs(value), type)}`,
    direction,
    className: getClassName(direction, tone),
  };
}
