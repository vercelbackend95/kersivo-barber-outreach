import React, { forwardRef } from 'react';

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
          <span className="admin-analytics-studio__headline-value">{headlineValue}</span>
          {headlineDelta ? (
            <span className="admin-analytics-studio__headline-delta">{headlineDelta}</span>
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
