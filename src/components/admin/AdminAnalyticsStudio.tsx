import React, { forwardRef, isValidElement } from 'react';

type AdminAnalyticsStudioProps = {
  toolbar?: React.ReactNode;
  toolbarSecondary?: React.ReactNode;
  headlineValue: React.ReactNode;
  headlineLabel?: string;
  headlineDelta?: React.ReactNode;
  headlineAction?: React.ReactNode;
  onHeadlineClick?: () => void;
  chart: React.ReactNode;
  footer?: React.ReactNode;
  statsRow?: React.ReactNode;
  className?: string;
  ariaLive?: 'polite' | 'off';
};

function isHeadlineSkeleton(value: React.ReactNode): boolean {
  if (!isValidElement(value)) return false;
  const className = (value.props as { className?: unknown }).className;
  return typeof className === 'string' && className.includes('admin-analytics-studio__headline-skeleton');
}

function headlineRevealKey(value: React.ReactNode): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (isHeadlineSkeleton(value)) return 'skeleton';
  return 'node';
}

const AdminAnalyticsStudio = forwardRef<HTMLElement, AdminAnalyticsStudioProps>(function AdminAnalyticsStudio(
  {
    toolbar,
    toolbarSecondary,
    headlineValue,
    headlineLabel,
    headlineDelta,
    headlineAction,
    onHeadlineClick,
    chart,
    footer,
    statsRow,
    className = '',
    ariaLive = 'polite',
  },
  ref,
) {
  const valueKey = headlineRevealKey(headlineValue);
  const showSkeleton = isHeadlineSkeleton(headlineValue);

  return (
    <section
      ref={ref}
      className={`admin-analytics-studio ${className}`.trim()}
      aria-live={ariaLive}
    >
      {(toolbar || toolbarSecondary) && (
        <div className="admin-analytics-studio__toolbar">
          {toolbar ? <div className="admin-analytics-studio__toolbar-primary">{toolbar}</div> : null}
          {toolbarSecondary ? (
            <div className="admin-analytics-studio__toolbar-secondary">{toolbarSecondary}</div>
          ) : null}
        </div>
      )}

      <div
        className={`admin-analytics-studio__headline${onHeadlineClick ? ' admin-analytics-studio__headline--clickable' : ''}`}
        onClick={onHeadlineClick}
        onKeyDown={
          onHeadlineClick
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onHeadlineClick();
                }
              }
            : undefined
        }
        role={onHeadlineClick ? 'button' : undefined}
        tabIndex={onHeadlineClick ? 0 : undefined}
      >
        <div className="admin-analytics-studio__headline-main">
          <span className="admin-analytics-studio__headline-value">
            {showSkeleton ? (
              headlineValue
            ) : (
              <span key={valueKey} className="admin-analytics-studio__headline-value-reveal">
                {headlineValue}
              </span>
            )}
          </span>
          {headlineDelta ? (
            <span key={`delta-${valueKey}`} className="admin-analytics-studio__headline-delta-wrap">
              {headlineDelta}
            </span>
          ) : null}
        </div>
        {headlineLabel ? (
          <p className="admin-analytics-studio__headline-label">{headlineLabel}</p>
        ) : null}
        {headlineAction ? (
          <div className="admin-analytics-studio__headline-action">{headlineAction}</div>
        ) : null}
      </div>

      <div className="admin-analytics-studio__chart">{chart}</div>

      {footer ? <div className="admin-analytics-studio__footer">{footer}</div> : null}

      {statsRow ? <div className="admin-analytics-studio__stats-row">{statsRow}</div> : null}
    </section>
  );
});

export default AdminAnalyticsStudio;
