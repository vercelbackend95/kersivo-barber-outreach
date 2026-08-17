export type BookingDemoConfirmCta = {
  label: string;
  href: string;
  primary?: boolean;
};

export type BookingFlowPresentation = {
  eyebrow?: string;
  title?: string;
  sandboxNote?: string;
  confirmEyebrow?: string;
  confirmHeading?: string;
  confirmBody?: string;
  confirmCtas?: readonly BookingDemoConfirmCta[];
  demoReferencePrefix?: string;
  skipCompletionAnalytics?: boolean;
  wholePoundPrices?: boolean;
};
