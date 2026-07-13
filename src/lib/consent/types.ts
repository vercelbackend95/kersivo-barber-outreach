export type ConsentPreferences = {
  version: number;
  necessary: true;
  analytics: boolean;
  advertisingMeasurement: boolean;
  /** Always false for the current launch — personalised advertising is not offered. */
  personalisedAdvertising: false;
  timestamp: string;
};

export type ConsentChoiceInput = {
  analytics: boolean;
  advertisingMeasurement: boolean;
};

export type GoogleConsentState = {
  analytics_storage: 'granted' | 'denied';
  ad_storage: 'granted' | 'denied';
  ad_user_data: 'granted' | 'denied';
  ad_personalization: 'granted' | 'denied';
};
