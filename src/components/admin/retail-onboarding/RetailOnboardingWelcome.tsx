import React from 'react';

type RetailOnboardingWelcomeProps = {
  layout?: 'wizard' | 'panel';
  onYes?: () => void;
  titleId?: string;
};

export default function RetailOnboardingWelcome({
  layout = 'wizard',
  onYes,
  titleId = 'retail-onboarding-welcome-title',
}: RetailOnboardingWelcomeProps) {
  const isPanel = layout === 'panel';

  return (
    <section
      className={isPanel ? 'admin-retail-empty-prompt' : undefined}
      aria-labelledby={titleId}
    >
      <h1 id={titleId} className={isPanel ? 'admin-retail-empty-prompt__title' : 'admin-onboarding__title'}>
        Let’s set up your retail shop
      </h1>
      <p className={isPanel ? 'admin-retail-empty-prompt__description' : 'admin-onboarding__description'}>
        Add your first product so customers can browse and order from your KERSIVO shop. It only takes a couple of
        minutes.
      </p>
      <div className={isPanel ? 'admin-retail-empty-prompt__question' : 'admin-onboarding__question'}>
        <p
          className={isPanel ? 'admin-retail-empty-prompt__question-title' : 'admin-onboarding__question-title'}
          id="retail-onboarding-sell-question"
        >
          Do you sell products in your shop?
        </p>
      </div>
      {isPanel ? (
        <div className="admin-retail-empty-prompt__actions">
          <button type="button" className="btn btn--primary btn--lg" onClick={onYes}>
            Yes, set up my retail shop
          </button>
        </div>
      ) : null}
    </section>
  );
}
