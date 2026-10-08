import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const SQUIRE_ALTERNATIVE_PAGE_PATH = '/squire-alternative';
export const SQUIRE_ALTERNATIVE_TITLE = 'SQUIRE Alternative for UK Barbershops | KERSIVO';
export const SQUIRE_ALTERNATIVE_DESCRIPTION = 'Looking for a SQUIRE alternative in the UK? Compare SQUIRE and KERSIVO pricing, booking software, branded websites, payments and switching.';
export const SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO = '2026-10-08';
export const SQUIRE_ALTERNATIVE_LAST_UPDATED_LABEL = '8 October 2026';
export const SQUIRE_FACTS_CHECKED_DATE = '8 October 2026';
export const SQUIRE_OFFICIAL_SOURCES = [
  { label: 'SQUIRE pricing and plans', url: 'https://www.getsquire.com/pricing', supports: 'Public USD plan prices, plan features, reminders and management tools' },
  { label: 'SQUIRE payment processing', url: 'https://getsquire.com/features/payments', supports: 'In-person and online payment options' },
  { label: 'SQUIRE platform overview', url: 'https://www.getsquire.com/', supports: 'Scheduling, POS, discovery and branded booking capabilities' },
] as const;
export const SQUIRE_ALTERNATIVE_FAQ_ITEMS = [
  { question: 'What is a SQUIRE alternative for UK barbers?', answer: 'KERSIVO is a SQUIRE alternative designed for independent UK barbershops. Starter provides a KERSIVO-hosted booking page for £0/month for up to four active bookable barbers; Full KERSIVO costs £39/month per location and includes a branded website and standard domain. SQUIRE offers a broader barbershop POS and management ecosystem.' },
  { question: 'How much does SQUIRE cost in the UK?', answer: 'SQUIRE’s public pricing page lists plans in US dollars, not verified GBP prices for UK businesses: Independent $30/month, Pro $50/month, Executive $150/month per shop and Titan $250/month per shop as checked on 8 October 2026. Do not treat these as a UK quote; ask SQUIRE directly about UK availability, local pricing, payment-processing terms and eligibility.' },
  { question: 'Is KERSIVO cheaper than SQUIRE?', answer: 'KERSIVO Starter is £0/month and Full KERSIVO is £39/month per location. SQUIRE publicly lists US-dollar prices; without verified UK pricing and comparable features, a like-for-like UK cost-saving claim is not possible. Standard Stripe processing fees apply on KERSIVO online payments.' },
  { question: 'Does KERSIVO charge commission on bookings?', answer: 'KERSIVO charges 0% KERSIVO commission or application fees on booking payments. Standard Stripe processing fees still apply. Starter public bookings require online payment of a £5 deposit or full service price; a service priced at exactly £5 is paid in full.' },
  { question: 'Can I use my own barbershop domain?', answer: 'Yes, Full KERSIVO includes a branded barbershop website and a standard domain. Starter is a KERSIVO-hosted booking page and does not include a custom domain.' },
  { question: 'Does SQUIRE have online booking, reminders and payment tools?', answer: 'Yes. SQUIRE publicly advertises online bookings, appointment reminders, no-show protection, payments and barbershop operations tools. KERSIVO also supports bookings and payment options, but the platforms differ in the scope of POS, business tools and branding included.' },
  { question: 'Does KERSIVO include a point-of-sale system and automated barber payouts?', answer: 'KERSIVO does not currently offer the same full in-shop POS, automated barber bank payouts or chair-rent collection tools marketed by SQUIRE. Full KERSIVO includes retail pickup, booking and customer management. Shops requiring those particular tools should evaluate SQUIRE carefully.' },
  { question: 'Can I move client data from SQUIRE to KERSIVO?', answer: 'KERSIVO can help review and import usable business data available from your existing booking platform, including supported CSV exports. The availability and completeness of SQUIRE exports must be checked before promising a migration. Keep SQUIRE running while your new setup is prepared.' },
  { question: 'Can clients book without downloading an app?', answer: 'Yes. Clients use a browser-based KERSIVO booking flow: a hosted booking page on Starter or your branded website on Full KERSIVO.' },
  { question: 'Can I try KERSIVO before switching?', answer: 'Yes. You can explore the KERSIVO live demo. Starter costs £0/month, subject to its public booking payment rules, while Full KERSIVO is £39/month per location.' },
];
export function buildSquireAlternativeFaqJsonLd(): Record<string, unknown> {
  const url = getPublicSiteUrl() + SQUIRE_ALTERNATIVE_PAGE_PATH;
  return { '@context':'https://schema.org', '@type':'FAQPage', '@id': url + '#faq', mainEntity: SQUIRE_ALTERNATIVE_FAQ_ITEMS.map(({question, answer}) => ({'@type':'Question',name:question,acceptedAnswer:{'@type':'Answer',text:answer}})) };
}
