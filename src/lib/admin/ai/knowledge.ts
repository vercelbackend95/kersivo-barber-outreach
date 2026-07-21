import {
  BILLING_CYCLE_CLAIM,
  DOMAIN_AUTH_TEXT,
  DOMAIN_EXISTING_CLAIM,
  DOMAIN_INCLUDED_CLAIM,
  DOMAIN_LIMIT_CLAIM,
  DOMAIN_NEW_CLAIM,
  FAIR_USE_IMMEDIATE_RESTRICTION_CLAIM,
  FAIR_USE_INTRO,
  FAIR_USE_ORDINARY_BREACH_CLAIM,
  FAIR_USE_PROHIBITED_LIST,
  FAIR_USE_UNLIMITED_LIST,
  INCLUDED_SETUP_CLAIM,
  MISSING_CRITICAL_MATERIALS_CLAIM,
  MISSING_OPTIONAL_MATERIALS_CLAIM,
  NO_FAKE_STOCK_CLAIM,
  NO_PAUSE_CLAIM,
  NO_SETUP_FEE_CLAIM,
  ONBOARDING_BILLING_INDEPENDENT_CLAIM,
  ONBOARDING_MATERIALS_CLAIM,
  ONBOARDING_TIMELINE_CLAIM,
  OWNER_SELF_CONFIG_CLAIM,
  PLAN_SCOPE_CLAIM,
  PLAN_SCOPE_FULL_LIST,
  POWERED_BY_KERSIVO_CLAIM,
  PREVIEW_LAUNCH_CLAIM,
  PRICE_CHANGE_NOTICE_CLAIM,
  PRICE_VAT_DISCLAIMER,
  SMS_INCLUDED_CLAIM,
  STANDARD_SITE_NOT_BESPOKE_CLAIM,
  STANDARD_SITE_SCOPE_CLAIM,
} from '@/lib/pricing/claimsPolicy';
import { BARBERSHOP_BOOKING_FAQ_ITEMS } from '@/lib/seo/barbershopBookingFaq';
import { ADMIN_SECTIONS_PLAYBOOK } from './adminSections';
import { ADMIN_RESULTS_PLAYBOOK } from './adminResultsPlaybook';

/**
 * Curated domain pack for the admin assistant.
 * Structured so live catalog / booking snippets can be appended later.
 */
export type KnowledgeSection = {
  id: string;
  title: string;
  body: string;
};

const BRAND_FACTS: KnowledgeSection = {
  id: 'brand',
  title: 'Kersivo brand facts',
  body: [
    'Kersivo builds branded booking + retail systems for UK barbershops on the shop’s own domain.',
    '0% KERSIVO commission on bookings and retail. Standard Stripe payment-processing fees still apply; cash in-shop can mean 0% processing.',
    `Pricing: £39/month subscription. ${NO_SETUP_FEE_CLAIM} ${PLAN_SCOPE_CLAIM}`,
    BILLING_CYCLE_CLAIM,
    PRICE_VAT_DISCLAIMER,
    PRICE_CHANGE_NOTICE_CLAIM,
    INCLUDED_SETUP_CLAIM,
    OWNER_SELF_CONFIG_CLAIM,
    STANDARD_SITE_SCOPE_CLAIM,
    STANDARD_SITE_NOT_BESPOKE_CLAIM,
    POWERED_BY_KERSIVO_CLAIM,
    'Never place “Powered by KERSIVO” on the kersivo.co.uk marketing site; it belongs on the customer’s barbershop site (attached at site delivery).',
    DOMAIN_INCLUDED_CLAIM,
    DOMAIN_NEW_CLAIM,
    DOMAIN_EXISTING_CLAIM,
    DOMAIN_LIMIT_CLAIM,
    `Post-purchase Tally (new domain): require checkbox — “${DOMAIN_AUTH_TEXT}”`,
    'Never ask customers to send domain-registrar passwords by ordinary email; prefer DNS records or secure handoff.',
    'Do not advertise the £30/year domain allowance on hero marketing; it belongs in Terms/ops.',
    ONBOARDING_MATERIALS_CLAIM,
    ONBOARDING_BILLING_INDEPENDENT_CLAIM,
    ONBOARDING_TIMELINE_CLAIM,
    PREVIEW_LAUNCH_CLAIM,
    'Do not describe internal preview hosting or Approve-button delivery mechanics in customer-facing answers.',
    MISSING_OPTIONAL_MATERIALS_CLAIM,
    MISSING_CRITICAL_MATERIALS_CLAIM,
    NO_FAKE_STOCK_CLAIM,
    `£39/month plan scope (full list): ${PLAN_SCOPE_FULL_LIST.join('; ')}.`,
    `${SMS_INCLUDED_CLAIM} — included in the £39/month plan while the subscription is active.`,
    'Email appointment confirmations and reminders are also included.',
    'Do not claim you can send SMS yourself as the assistant; describe the product capability only.',
    'Shop roles OWNER/MANAGER/BARBER are live via ShopMember + invites (bound to shopId). Barber access requires a linked roster seat. Do not invent a multi-shop switcher UI.',
    FAIR_USE_INTRO,
    `Unlimited within one location: ${FAIR_USE_UNLIMITED_LIST.join('; ')}.`,
    `Fair use does not allow: ${FAIR_USE_PROHIBITED_LIST.join('; ')}.`,
    FAIR_USE_ORDINARY_BREACH_CLAIM,
    FAIR_USE_IMMEDIATE_RESTRICTION_CLAIM,
    'Do not invent numerical caps (e.g. max bookings or max clients). Point to Terms #fair-use for full rules.',
    NO_PAUSE_CLAIM,
    'Never say “£39 forever”, “£39 including VAT”, “fully bespoke”, “fully custom-built”, “built entirely from scratch”, “unlimited design”, or “unlimited redesigns”. Do not sell a live “£199 setup” / required setup deposit while setup fees are disabled.',
    'Currently onboarding founding UK barbershops with closer setup support; switchers can keep their current booking system live until go-live is confirmed.',
    'Clients book in the browser — no app download, no forced account creation.',
    'Customer owns domain, brand, content, client relationship and exported data (free CSV: name, email, phone, booking history during subscription + 30 days after). KERSIVO owns platform/code/infra; subscription is a licence.',
    'Do not invent competitor commission rates, monthly cost corridors, or savings figures. Do not claim Booksy takes 30% per booking.',
  ].join('\n'),
};

const SEO_OPS: KnowledgeSection = {
  id: 'seo-website',
  title: 'Website & SEO guidance themes',
  body: [
    'Help with local SEO for barbershops: Google Business Profile, Maps discovery, title/meta for booking pages, service pages, NAP consistency, review follow-ups.',
    'Prefer concrete, UK-barbershop language: chair utilisation, no-shows, deposits, walk-ins vs booked chairs, retail margin at the till.',
    'When writing copy, keep brand voice direct and margin-focused — not marketplace fluff.',
    'Do not invent rankings, traffic numbers, or “guaranteed #1 Google” outcomes.',
  ].join('\n'),
};

const RETAIL_OPS: KnowledgeSection = {
  id: 'shop-retail',
  title: 'Shop / retail guidance themes',
  body: [
    'Advise on product naming, short descriptions, featured products, pickup flow, and pairing retail with services (e.g. aftercare after a fade).',
    'Kersivo retail is shop-owned pickup: clients reserve/order through the branded site; commission stays 0% from Kersivo.',
    'Suggest merchandising ideas that fit a barbershop counter, not generic e-commerce jargon.',
  ].join('\n'),
};

const BARBER_OPS: KnowledgeSection = {
  id: 'barber-ops',
  title: 'Barber & booking ops themes',
  body: [
    'Advise on schedules, buffers, deposits to cut no-shows, SMS reminders, win-back of old clients, and balancing walk-ins vs bookings.',
    'Deposits + reminders increase commitment and reduce empty-chair losses.',
    'Switching from another booking platform: map services/team/hours first; clients keep booking via a normal URL after go-live.',
  ].join('\n'),
};

function faqToSection(
  id: string,
  title: string,
  items: Array<{ question: string; answer: string; details?: string }>,
): KnowledgeSection {
  const body = items
    .map((item) => {
      const extra = item.details ? `\n  Detail: ${item.details}` : '';
      return `Q: ${item.question}\nA: ${item.answer}${extra}`;
    })
    .join('\n\n');
  return { id, title, body };
}

export const KNOWLEDGE_SECTIONS: KnowledgeSection[] = [
  BRAND_FACTS,
  ADMIN_SECTIONS_PLAYBOOK,
  ADMIN_RESULTS_PLAYBOOK,
  SEO_OPS,
  RETAIL_OPS,
  BARBER_OPS,
  // Orphaned FAQ_ITEMS kept out of AI knowledge — aggressive ownership / competitor wording.
  faqToSection('faq-booking-landing', 'Booking-system FAQ', BARBERSHOP_BOOKING_FAQ_ITEMS),
];

/** Flatten knowledge for system prompt injection. Optional extra live snippets later. */
export function buildKnowledgePack(extraSections: KnowledgeSection[] = []): string {
  return [...KNOWLEDGE_SECTIONS, ...extraSections]
    .map((section) => `### ${section.title}\n${section.body}`)
    .join('\n\n');
}
