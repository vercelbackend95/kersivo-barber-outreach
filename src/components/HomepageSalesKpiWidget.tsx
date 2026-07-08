import { useEffect, useMemo, useRef, useState } from 'react';

import AdminLineChart, { type AdminLineChartSeries } from '@/components/admin/charts/AdminLineChart';
import { getLandingSalesKpiData } from '@/lib/landing/landingSalesKpiData';

type SalesChartSeries = {
  key: string;
  name: string;
  points: Array<{ date: string; revenuePence: number; units: number }>;
};

type SalesSeriesPill = {
  key: string;
  label: string;
  color: string;
  isOverall?: boolean;
};

const CHART_HEIGHT = 'clamp(220px, 34vh, 320px)';
const MAX_SELECTED_PRODUCTS = 5;
const SALES_SELECTION_LIMIT_MESSAGE = 'Max 5 products can be compared.';
const PRODUCT_SLOT_COLORS = ['#E6EAF0', '#7DD3FC', '#5EEAD4', '#FBBF24', '#C4B5FD'];
const OVERALL_COLOR = '#E11D2E';

function formatPrice(pricePence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pricePence / 100);
}

function HomepageSalesKpiWidgetPlaceholder() {
  return (
    <div className="homepage-sales-kpi-widget" aria-hidden="true">
      <div className="admin-sales-chart-wrap">
        <div className="admin-sales-chart-inner">
          <div className="admin-sales-chart-canvas" style={{ height: CHART_HEIGHT }} />
        </div>
      </div>
      <div className="admin-sales-modal-selector">
        <div className="admin-sales-search-results" />
      </div>
    </div>
  );
}

function useProductSeriesSelection(allSalesSeries: SalesChartSeries[]) {
  const [enabledProductIds, setEnabledProductIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const validProductIds = new Set(allSalesSeries.filter((series) => series.key !== 'overall').map((series) => series.key));
    setEnabledProductIds((previous) => {
      const next = new Set(Array.from(previous).filter((seriesId) => validProductIds.has(seriesId)));
      return next.size === previous.size ? previous : next;
    });
  }, [allSalesSeries]);

  const setLimitError = () => {
    setErrorMessage(SALES_SELECTION_LIMIT_MESSAGE);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setErrorMessage(null);
    }, 2000);
  };

  const clearLimitError = () => {
    setErrorMessage(null);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const addProduct = (seriesKey: string) => {
    setEnabledProductIds((previous) => {
      if (previous.has(seriesKey)) return previous;
      if (previous.size >= MAX_SELECTED_PRODUCTS) {
        setLimitError();
        return previous;
      }
      clearLimitError();
      const next = new Set(previous);
      next.add(seriesKey);
      return next;
    });
  };

  const removeProduct = (seriesKey: string) => {
    setEnabledProductIds((previous) => {
      if (!previous.has(seriesKey)) return previous;
      const next = new Set(previous);
      next.delete(seriesKey);
      clearLimitError();
      return next;
    });
  };

  const selectedProductIds = Array.from(enabledProductIds);
  const activeSeriesKeys = allSalesSeries.some((series) => series.key === 'overall')
    ? ['overall', ...selectedProductIds]
    : selectedProductIds;

  return {
    selectedProductIds,
    activeSeriesKeys,
    addProduct,
    removeProduct,
    errorMessage,
  };
}

function SeriesPills({
  seriesList,
  onRemove,
  maxHintVisible,
  emptySelectionHintVisible,
}: {
  seriesList: SalesSeriesPill[];
  onRemove: (seriesKey: string) => void;
  maxHintVisible: boolean;
  emptySelectionHintVisible: boolean;
}) {
  return (
    <div className="admin-sales-series-pills-wrap" aria-live="polite">
      <div className="admin-sales-series-pills" role="list" aria-label="Chart series legend">
        {seriesList.map((series) => (
          <div
            key={series.key}
            role="listitem"
            className="admin-sales-series-pill admin-sales-series-pill--active"
          >
            <span className="admin-sales-series-pill__swatch" style={{ background: series.color }} aria-hidden="true" />
            <span>{series.label}</span>
            {!series.isOverall ? (
              <button
                type="button"
                className="admin-sales-series-pill__remove"
                onClick={() => onRemove(series.key)}
                aria-label={`Remove ${series.label}`}
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {maxHintVisible ? <p className="admin-sales-series-hint">{SALES_SELECTION_LIMIT_MESSAGE}</p> : null}
      {emptySelectionHintVisible ? <p className="admin-sales-series-hint">Select a product to display data</p> : null}
    </div>
  );
}

function HomepageSalesKpiWidgetContent() {
  const salesData = useMemo(() => getLandingSalesKpiData(), []);

  const allSalesSeries = useMemo(() => {
    const lines: SalesChartSeries[] = [];
    if (salesData.series.overall) {
      lines.push({ key: 'overall', name: 'Overall', points: salesData.series.overall });
    }
    for (const productSeries of salesData.series.products ?? []) {
      lines.push({
        key: productSeries.productId,
        name: productSeries.name,
        points: productSeries.points.map((point) => ({
          date: point.date,
          revenuePence: point.revenuePence,
          units: point.units,
        })),
      });
    }
    return lines;
  }, [salesData]);

  const {
    selectedProductIds,
    activeSeriesKeys,
    addProduct,
    removeProduct,
    errorMessage: selectionLimitMessage,
  } = useProductSeriesSelection(allSalesSeries);

  const getSlotColor = (productId: string): string => {
    const slotIndex = selectedProductIds.indexOf(productId);
    return slotIndex >= 0 ? PRODUCT_SLOT_COLORS[slotIndex] : PRODUCT_SLOT_COLORS[0];
  };

  const getSeriesColor = (seriesKey: string): string => {
    if (seriesKey === 'overall') return OVERALL_COLOR;
    if (seriesKey === '__empty__') return 'var(--border)';
    return getSlotColor(seriesKey);
  };

  const getSeriesStrokeWidth = (seriesKey: string): number => {
    if (seriesKey === 'overall' || seriesKey === '__empty__') return 2;
    const slotIndex = selectedProductIds.indexOf(seriesKey);
    return slotIndex === 0 ? 3 : 2;
  };

  const seriesPills = useMemo(
    () =>
      allSalesSeries.map((series) => ({
        key: series.key,
        label: series.name,
        color: getSeriesColor(series.key),
        isOverall: series.key === 'overall',
      })),
    [allSalesSeries, selectedProductIds],
  );

  const chartSeries = useMemo(
    () => allSalesSeries.filter((series) => activeSeriesKeys.includes(series.key)),
    [activeSeriesKeys, allSalesSeries],
  );

  const legendSeries = useMemo(
    () => seriesPills.filter((series) => activeSeriesKeys.includes(series.key)),
    [activeSeriesKeys, seriesPills],
  );

  const adminChartSeries = useMemo<AdminLineChartSeries[]>(
    () =>
      chartSeries.map((series) => ({
        key: series.key,
        name: series.name,
        points: series.points.map((point) => ({
          label: point.date,
          value: point.revenuePence,
        })),
      })),
    [chartSeries],
  );

  const filteredExpandableProducts = useMemo(
    () => seriesPills.filter((series) => !activeSeriesKeys.includes(series.key)),
    [activeSeriesKeys, seriesPills],
  );

  const handleAddSeriesSelection = (seriesKey: string) => {
    addProduct(seriesKey);
  };

  return (
    <div className="homepage-sales-kpi-widget">
      <div className="admin-sales-chart-wrap">
        <AdminLineChart
          series={adminChartSeries}
          metric="currency"
          getColor={getSeriesColor}
          getStrokeWidth={getSeriesStrokeWidth}
          formatValue={formatPrice}
          responsive
          height={CHART_HEIGHT}
          emptyNode={
            <>
              <p>No products selected</p>
              <p>Enable a product below to display data.</p>
            </>
          }
        />

        <SeriesPills
          seriesList={legendSeries}
          onRemove={removeProduct}
          maxHintVisible={Boolean(selectionLimitMessage)}
          emptySelectionHintVisible={false}
        />
      </div>

      <div className="admin-sales-modal-selector">
        <div className="admin-sales-search-results" role="list" aria-label="Search results">
          {filteredExpandableProducts.map((series) => (
            <button
              key={`search-${series.key}`}
              type="button"
              className="admin-sales-search-result"
              onClick={() => handleAddSeriesSelection(series.key)}
            >
              <span className="admin-sales-series-pill__swatch" style={{ background: series.color }} aria-hidden="true" />
              <span>{series.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomepageSalesKpiWidget() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <HomepageSalesKpiWidgetPlaceholder />;
  }

  return <HomepageSalesKpiWidgetContent />;
}
