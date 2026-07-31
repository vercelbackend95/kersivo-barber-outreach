export type ConsentPreferences = {
  version: number;
  necessary: true;
  analytics: boolean;
  advertisingMeasurement: boolean;
  /** Drives `ad_personalization`, i.e. Google Ads remarketing audiences. */
  personalisedAdvertising: boolean;
  timestamp: string;
};

export type ConsentChoiceInput = {
  analytics: boolean;
  advertisingMeasurement: boolean;
  personalisedAdvertising: boolean;
};

export type GoogleConsentState = {
  analytics_storage: 'granted' | 'denied';
  ad_storage: 'granted' | 'denied';
  ad_user_data: 'granted' | 'denied';
  ad_personalization: 'granted' | 'denied';
};
