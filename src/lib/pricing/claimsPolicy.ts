/**
 * Shared public-facing pricing / commission claim policy.
 * Keep marketing, FAQ and Terms aligned with Commercial Offer §2–§9 and what the product delivers.
 *
 * Banned phrasing (never use in customer-facing copy):
 * - "£39 including VAT"
 * - "£39 forever"
 * - Live “£199 setup” / “setup deposit required” while SHOW_SETUP_PLAN_CARDS is false
 * - fully bespoke / fully custom-built / built entirely from scratch / unlimited design / unlimited redesigns
 */

import {
  SAAS_EXPORT_RETENTION_DAYS,
  SAAS_GRACE_DAYS,
} from '@/lib/setup/saasEntitlement';

/** Amount charged today — not a forever price lock. */
export const PRICE_VAT_DISCLAIMER =
  'You pay exactly the price shown. KERSIVO is not currently VAT registered, so no VAT is added.';

/** One standard plan covers one physical location; no auto multi-location discount. */
export const PLAN_SCOPE_CLAIM =
  'The standard plan covers one physical barbershop location. There is no automatic discount for multiple locations; larger networks may request an individual offer.';

export const PLAN_SCOPE_SHORT = 'Covers one physical barbershop location.';

/** First charge at purchase; renewals on the same billing-cycle day. */
export const BILLING_CYCLE_CLAIM =
  'The first payment is taken immediately when you subscribe. Renewals are charged monthly on the same billing-cycle day. There is no annual, quarterly or prepaid plan.';

export const BILLING_CYCLE_SHORT =
  'Billed today, then monthly on the same billing-cycle day.';

/** No pause; cancel anytime through end of paid month. */
export const NO_PAUSE_CLAIM =
  'Subscriptions cannot be paused. You may cancel at any time; service stays active until the end of the paid month.';

export const NO_PAUSE_SHORT =
  'Cannot be paused. Cancel anytime — active until the end of the paid month.';

/**
 * Future price changes: not retroactive, ≥30 days notice, cancel before new price;
 * individual grandfathering is not a public guarantee.
 */
export const PRICE_CHANGE_NOTICE_CLAIM =
  'KERSIVO may change the plan price in future. Price changes are not retroactive. You will receive at least 30 days’ notice before a new price applies, and you may cancel before it takes effect. Keeping an earlier price for selected customers may be offered individually; it is not a public guarantee.';

/** §3 — no separate install / setup fee on the live SaaS path. */
export const NO_SETUP_FEE_CLAIM =
  'KERSIVO does not charge a separate installation or setup fee.';

export const NO_SETUP_FEE_SHORT = 'No setup fee.';

/**
 * §3 — what the £39/month plan includes as standard configuration (ops delivery, not a DIY site builder).
 */
export const INCLUDED_SETUP_CLAIM =
  'The £39/month plan includes standard configuration: salon account creation, platform setup, a standard website tailored to your shop’s brand, migration help, one standard domain, hosting, SSL and platform updates.';

export const INCLUDED_SETUP_SHORT =
  'Includes standard site, brand fit, migration help, domain, hosting, SSL and platform updates.';

/**
 * §3 — owner self-config via dashboard.
 * Basic shop info today = name, town/city and logo (via onboarding / workspace); not a full address CMS.
 */
export const OWNER_SELF_CONFIG_CLAIM =
  'Through the admin dashboard you can configure barbers, services, prices, working hours, retail products and basic shop details (name, town/city and logo).';

export const OWNER_SELF_CONFIG_SHORT =
  'Configure barbers, services, prices, hours, products and basic shop details in your dashboard.';

/**
 * §4 — standard barbershop website scope (delivered on the customer’s site, not a DIY site builder).
 * A separate services page is not a mandatory part of the standard package; services appear in booking.
 */
export const STANDARD_SITE_SCOPE_CLAIM =
  'Each location receives a professional website on the KERSIVO platform. The standard package may include a home page, salon information, team, gallery, contact details, social links, booking flow and retail pickup shop. Services are presented in the booking flow; a separate services page is not a mandatory part of the standard package.';

export const STANDARD_SITE_SCOPE_SHORT =
  'Standard site may include home, salon info, team, gallery, contact, social, booking and retail.';

/**
 * §4 — brand fit, not unlimited bespoke web development.
 */
export const STANDARD_SITE_NOT_BESPOKE_CLAIM =
  'Your site is tailored to your shop’s name, visual identity, logo, photos, team, content and contact details. This is not a full, unlimited bespoke web-development service.';

/**
 * §4 — Powered by KERSIVO on the customer’s barbershop site only (ops attaches manually at delivery).
 * Never claim or place this badge on the kersivo.co.uk marketing site.
 */
export const POWERED_BY_KERSIVO_CLAIM =
  'Your barbershop website includes a subtle “Powered by KERSIVO” mark that links to KERSIVO. It cannot be removed on the standard £39 plan. KERSIVO does not place other ads, banners or aggressive promotional elements on your site. This mark applies to your shop site only — not to the KERSIVO marketing website.';

/**
 * §5 — one standard domain per location (public claim; do not put £30 on hero marketing).
 */
export const DOMAIN_INCLUDED_CLAIM =
  'Each location includes one standard domain. Your own domain included.';

export const DOMAIN_INCLUDED_SHORT = 'Your own domain included.';

/** §5 — new domain registered via KERSIVO. */
export const DOMAIN_NEW_CLAIM =
  'If you do not already have a domain, KERSIVO may register one on behalf of your business. Legal ownership of the domain remains with the salon or its legal owner. While your subscription is active, KERSIVO manages the registrar, DNS and SSL technically. When the engagement ends, the domain can be transferred to you.';

/**
 * Exact Tally onboarding checkbox text (post-purchase) when registering a new domain.
 * Ops: paste into the Tally form — not rendered on kersivo.co.uk marketing UI in this WP.
 */
export const DOMAIN_AUTH_TEXT =
  'I authorise KERSIVO to register and manage the selected domain name on behalf of my business using the details provided.';

/** §5 — customer already owns a domain. */
export const DOMAIN_EXISTING_CLAIM =
  'If you already have a domain, you keep ownership. Transferring the domain to KERSIVO is not required. KERSIVO may configure DNS and SSL; you remain responsible for renewing the domain. We can provide the required DNS records or help with configuration. KERSIVO will not ask you to send domain-registrar passwords by ordinary email.';

/**
 * §5 — internal/standard allowance (Terms, ops, AI — not hero marketing).
 */
export const DOMAIN_LIMIT_CLAIM =
  'The internal standard domain allowance is £30 per year, including mandatory registrar fees. Premium domains, aftermarket listings, auctions, expensive extensions and names above that allowance are not included in the standard package. In those cases KERSIVO will propose an alternative domain or agree a top-up for the difference with you.';

/**
 * §6 — post-purchase onboarding materials (Tally / similar form).
 */
export const ONBOARDING_MATERIALS_CLAIM =
  'After purchase you receive an onboarding form. Your salon should provide details such as business name, address, contact details, logo, photos, team information, opening hours, social media, a salon description and any information needed for migration.';

/** §6 — billing continues even if materials are late. */
export const ONBOARDING_BILLING_INDEPENDENT_CLAIM =
  'Your subscription starts on the day of purchase. Not sending materials does not pause or stop the billing cycle.';

/** §6 — delivery timeline (no hard go-live date without complete materials). */
export const ONBOARDING_TIMELINE_CLAIM =
  'Standard delivery is communicated as: Roughly 1–2 weeks after we receive all required information. Timing can depend on completeness of information, your availability, migration, domain access and the quality of exported data. We do not guarantee a specific go-live date if you have not provided all required information.';

/**
 * §6 — private preview, Approve and launch, approval records, existing site / DNS.
 * Do not describe future subdomain or email-button implementation in public copy.
 */
export const PREVIEW_LAUNCH_CLAIM =
  'Before publication you receive a private preview of your site. You should check content, contact details, photos, booking flow, services, prices, team and opening hours. Go-live happens only after your explicit approval (for example Approve and launch). KERSIVO keeps a record of who approved, when they approved, the site version and the go-live date. Where technically possible, your existing website can stay live while we build. DNS is switched only after approval.';

/**
 * §7 — optional materials missing: safe fallbacks (ops delivery).
 */
export const MISSING_OPTIONAL_MATERIALS_CLAIM =
  'If you do not supply every optional asset, we may use a neutral avatar where a barber photo is missing, hide the gallery section where there are no gallery images, use a typographic salon name where there is no logo, and prepare basic website copy from the information you have provided.';

/** §7 — critical data missing can hold launch (billing still runs per §6). */
export const MISSING_CRITICAL_MATERIALS_CLAIM =
  'If key details are missing — such as your address or proper contact details — launch may be held until they are provided.';

/** §7 — no deceptive stock photography. */
export const NO_FAKE_STOCK_CLAIM =
  'KERSIVO does not use stock photos in a way that suggests they depict your real salon, staff or clients.';

/**
 * §8 — full plan scope for Terms / AI (commercial offer list).
 * SMS appointment reminders are included (landing: plain claim; Terms: monthly allowance, no figure).
 */
export const PLAN_SCOPE_FULL_LIST = [
  'professional barbershop website',
  'one standard domain (your own domain included)',
  'booking flow',
  'admin dashboard',
  'barber management',
  'service management',
  'working-hours management',
  'client database',
  'booking deposits',
  'email appointment confirmations',
  'email appointment reminders',
  'SMS appointment reminders',
  'retail pickup shop',
  'retail orders',
  'booking reports',
  'product sales reports',
  'hosting',
  'SSL',
  'platform updates',
  'support',
  'migration help',
  'website update support',
] as const;

/** §8 — pricing card highlight bullets (~7; SMS in highlight, not only a pill). */
export const PLAN_SCOPE_HIGHLIGHTS = [
  'Professional barbershop website',
  'Your own standard domain',
  'Booking flow + admin dashboard',
  'Retail pickup shop',
  'Client database + booking deposits',
  'Email and SMS confirmations and reminders',
  'Hosting, SSL, updates and support',
] as const;

/** §8 — pills under pricing for remaining scope (SMS already in highlights). */
export const PLAN_SCOPE_PILLS = [
  'Barber management',
  'Service management',
  'Working hours',
  'Retail orders',
  'Booking reports',
  'Product sales reports',
  'Migration help',
  'Website update support',
] as const;

/** Preferred short commission framing. */
export const KERSIVO_COMMISSION_CLAIM = '0% KERSIVO commission.';

/** Stripe qualification — use near commission claims. */
export const STRIPE_FEES_NOTE = 'Standard Stripe payment-processing fees still apply.';

export const KERSIVO_COMMISSION_WITH_STRIPE = `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`;

/** §8 — commission footnote already used near pricing (alias). */
export const PLAN_SCOPE_COMMISSION_FOOTNOTE = KERSIVO_COMMISSION_WITH_STRIPE;

/** Email confirmations and reminders (Care). */
export const EMAIL_REMINDERS_CLAIM = 'Email appointment confirmations and reminders';

/**
 * Public / landing SMS claim — plain feature name only.
 * Do not say Unlimited, limited, allowance, or any £/message figure in marketing.
 */
export const SMS_INCLUDED_CLAIM = 'SMS appointment reminders';

/** Combined client communications claim for pricing / feature cards. */
export const CLIENT_COMMS_CLAIM = `${EMAIL_REMINDERS_CLAIM}. ${SMS_INCLUDED_CLAIM}.`;

/**
 * Terms-only: monthly SMS allowance exists, but no published amount or message count.
 * Do not reuse on landing / pricing / FAQ marketing surfaces.
 */
export const SMS_MONTHLY_ALLOWANCE_TERMS =
  'Automated SMS appointment reminders are included while your subscription is active and are subject to a monthly allowance. We do not publish a fixed monetary amount or message count in these Terms.';

/**
 * @deprecated Do not use in public copy — use SMS_INCLUDED_CLAIM (landing) or SMS_MONTHLY_ALLOWANCE_TERMS (Terms).
 */
export const SMS_ROADMAP_NOTE =
  'SMS appointment reminders are included in the subscription while it is active.';

export const STRIPE_ACCOUNT_CLAIM =
  'The public retail demo is a simulation (no Stripe payment). Private owner test orders create marked test data without payment. Live shops connect to your Stripe account during go-live setup.';

/**
 * §9 — within one physical location, the plan covers these without numerical caps.
 * Reasonable fair use still applies (see FAIR_USE_PROHIBITED_LIST).
 */
export const FAIR_USE_UNLIMITED_LIST = [
  'bookings',
  'clients',
  'barbers',
  'dashboard users',
  'services',
  'products',
  'retail orders',
] as const;

export const FAIR_USE_INTRO =
  'Within one physical barbershop location, the standard plan covers unlimited bookings, clients, barbers, dashboard users, services, products and retail orders. Reasonable fair use applies.';

export const FAIR_USE_PROHIBITED_LIST = [
  'using one subscription for more than one physical location',
  'sharing an account with independent businesses',
  'reselling access to the platform',
  'using the system for spam',
  'bots and mass automation',
  'storing unrelated data',
  'conduct that threatens the platform',
  'attempts to circumvent limits',
  'illegal or fraudulent activity',
] as const;

export const FAIR_USE_ORDINARY_BREACH_CLAIM =
  'For an ordinary fair-use breach, KERSIVO will contact you, explain the issue, give you a chance to correct it, and may offer an additional location subscription or an individual plan.';

export const FAIR_USE_IMMEDIATE_TRIGGERS = [
  'fraud',
  'spam',
  'a security threat',
  'illegal use',
  'serious risk to the platform or other customers',
] as const;

export const FAIR_USE_IMMEDIATE_RESTRICTION_CLAIM =
  'KERSIVO may restrict access immediately in cases of fraud, spam, a security threat, illegal use, or serious risk to the platform or other customers.';

/**
 * Failed / overdue subscription payments — aligned with saasEntitlement grace + lifecycle cron.
 * Do not claim a fixed termination day; CANCELED comes from Stripe cancel/delete.
 */
export const FAILED_PAYMENT_CLAIM = `Stripe may retry a failed subscription payment in accordance with its billing process. After a failed renewal, the subscription may be marked past due. For ${SAAS_GRACE_DAYS} days after the failed payment, paid features may remain available. After that grace period, KERSIVO may restrict or suspend access to the website, booking system and retail system. The admin dashboard may remain available for billing management and data export. If payment remains outstanding, KERSIVO may terminate the subscription. Restoring the service may require payment of all outstanding charges.`;

/**
 * First subscription payment / refunds — goodwill when KERSIVO cannot deliver; not a change-of-mind refund.
 */
export const REFUND_CLAIM =
  'Except where required by law, the first subscription payment is not automatically refundable because onboarding and configuration work may begin immediately after purchase. If KERSIVO is wholly unable to begin or provide the service for reasons solely within KERSIVO’s control, KERSIVO will refund the first subscription payment. Nothing in these Terms excludes rights or remedies that cannot lawfully be excluded.';

/** Support response target — not a guaranteed resolution time. */
export const SUPPORT_RESPONSE_CLAIM =
  'Our target is to provide an initial response to subscribed clients within one business day. This is a response target, not a guaranteed resolution time. Standard support does not include 24/7 telephone support unless separately agreed in writing.';

/**
 * Website update support scope (ops support, not a claim that every field is self-serve in the CMS).
 */
export const WEBSITE_UPDATE_SUPPORT_CLAIM =
  'Website update support covers reasonable minor changes to the standard KERSIVO website, such as updating supplied text, opening hours, contact details, team information, prices and replacing images supplied by the Client. It does not include new software features, a full redesign, unlimited revisions, bespoke pages, custom integrations or an open-ended allocation of development hours. Larger changes may require a separate written quotation.';

/**
 * CSV export availability + post-termination retention window (matches SAAS_EXPORT_RETENTION_DAYS + purge cron).
 * Do not claim automatic anonymisation; the system may hard-delete shop data after the window.
 */
export const DATA_EXPORT_RETENTION_CLAIM = `You may request a free CSV export containing first name, surname where stored, email, phone number and booking history. Export is available while your subscription is active and for ${SAAS_EXPORT_RETENTION_DAYS} days after the subscription ends. After that period, shop data may be deleted in accordance with our Privacy Policy.`;
