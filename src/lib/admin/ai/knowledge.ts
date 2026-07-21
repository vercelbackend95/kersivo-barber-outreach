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
    'Pricing: £39/month subscription (no setup fee), billed automatically. Prices shown are final. KERSIVO is not currently VAT registered, so no VAT is added.',
    'Subscription includes: custom site + booking + admin + pickup shop setup, hosting, SSL, platform/security updates, maintenance, support, domain renewal, transactional emails, booking/admin/retail, up to 1h minor changes/month, email appointment reminders.',
    'Cancel anytime — service stays active until the end of the paid month.',
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
