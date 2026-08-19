/**
 * Canonical GA4 / Ads funnel events for KERSIVO acquisition.
 * Use these names in data-track attributes and trackConsentedEvent calls.
 */
export const FUNNEL_EVENTS = {
  landing_view: 'landing_view',
  primary_cta_clicked: 'primary_cta_clicked',
  /** Hero / preview path — not purchase. */
  build_preview_click: 'build_preview_click',
  view_live_demo_click: 'view_live_demo_click',
  /** Pricing / purchase intent. */
  plan_my_setup_click: 'plan_my_setup_click',
  auth_started: 'auth_started',
  signup_completed: 'signup_completed',
  onboarding_started: 'onboarding_started',
  shop_details_completed: 'shop_details_completed',
  first_barber_added: 'first_barber_added',
  first_service_added: 'first_service_added',
  availability_completed: 'availability_completed',
  test_booking_started: 'test_booking_started',
  test_booking_completed: 'test_booking_completed',
  private_admin_opened: 'private_admin_opened',
  retail_onboarding_started: 'retail_onboarding_started',
  first_product_added: 'first_product_added',
  test_order_completed: 'test_order_completed',
  retail_task_card_viewed: 'retail_task_card_viewed',
  retail_show_product_clicked: 'retail_show_product_clicked',
  retail_onboarding_product_revealed: 'retail_onboarding_product_revealed',
  retail_onboarding_product_added_to_cart: 'retail_onboarding_product_added_to_cart',
  retail_open_basket_clicked: 'retail_open_basket_clicked',
  retail_continue_checkout_clicked: 'retail_continue_checkout_clicked',
  retail_view_order_clicked: 'retail_view_order_clicked',
  retail_mark_collected_clicked: 'retail_mark_collected_clicked',
  launch_wizard_started: 'launch_wizard_started',
  plan_selected: 'plan_selected',
  launch_review_viewed: 'launch_review_viewed',
  checkout_started: 'checkout_started',
  checkout_cancelled: 'checkout_cancelled',
  /** Alias of setup_deposit_paid for Ads purchase. */
  checkout_completed: 'checkout_completed',
  setup_deposit_paid: 'setup_deposit_paid',
  launch_stripe_click: 'launch_stripe_click',
  priority_growth_stripe_click: 'priority_growth_stripe_click',
  setup_enquiry_submit: 'setup_enquiry_submit',
  demo_pricing_capture_submit: 'demo_pricing_capture_submit',
  public_demo_completed: 'public_demo_completed',
  public_shop_demo_completed: 'public_shop_demo_completed',
  blackline_admin_conversion_card_viewed: 'blackline_admin_conversion_card_viewed',
  blackline_admin_create_system_click: 'blackline_admin_create_system_click',
  blackline_admin_view_plans_click: 'blackline_admin_view_plans_click',
} as const;

export type FunnelEventName = (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS];

/** Micro-conversions (early engagement). */
export const MICRO_CONVERSION_EVENTS = new Set<FunnelEventName>([
  FUNNEL_EVENTS.landing_view,
  FUNNEL_EVENTS.primary_cta_clicked,
  FUNNEL_EVENTS.build_preview_click,
  FUNNEL_EVENTS.view_live_demo_click,
  FUNNEL_EVENTS.plan_my_setup_click,
  FUNNEL_EVENTS.auth_started,
  FUNNEL_EVENTS.onboarding_started,
  FUNNEL_EVENTS.launch_wizard_started,
  FUNNEL_EVENTS.public_demo_completed,
  FUNNEL_EVENTS.public_shop_demo_completed,
  FUNNEL_EVENTS.blackline_admin_conversion_card_viewed,
  FUNNEL_EVENTS.blackline_admin_create_system_click,
]);

/** Lead-quality signals. */
export const LEAD_EVENTS = new Set<FunnelEventName>([
  FUNNEL_EVENTS.signup_completed,
  FUNNEL_EVENTS.shop_details_completed,
  FUNNEL_EVENTS.setup_enquiry_submit,
  FUNNEL_EVENTS.demo_pricing_capture_submit,
]);

/** Product-qualified lead signals (used product meaningfully). */
export const PQL_EVENTS = new Set<FunnelEventName>([
  FUNNEL_EVENTS.first_service_added,
  FUNNEL_EVENTS.availability_completed,
  FUNNEL_EVENTS.test_booking_completed,
  FUNNEL_EVENTS.launch_review_viewed,
  FUNNEL_EVENTS.first_product_added,
  FUNNEL_EVENTS.test_order_completed,
]);
