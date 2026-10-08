import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { SQUIRE_UK_LIST_PLANS } from './squireFacts';
export { SQUIRE_FACTS_CHECKED_DATE, SQUIRE_OFFICIAL_SOURCES } from './squireFacts';

export const SQUIRE_ALTERNATIVE_PAGE_PATH='/squire-alternative';
export const SQUIRE_ALTERNATIVE_TITLE='SQUIRE Alternative for UK Barbershops | KERSIVO';
export const SQUIRE_ALTERNATIVE_DESCRIPTION=
  'Compare SQUIRE vs KERSIVO for UK barbershops: pricing, bookings, POS, deposits, own-domain websites, payment fees and switching.';
export const SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO='2026-10-08';
export const SQUIRE_ALTERNATIVE_LAST_UPDATED_LABEL='8 October 2026';

const price = (id:typeof SQUIRE_UK_LIST_PLANS[number]['id']) =>
  '£'+SQUIRE_UK_LIST_PLANS.find(plan=>plan.id===id)!.gbpMonthly;

export type SquireAlternativeFaqItem={question:string;answer:string};
/** On-page FAQ and FAQPage schema share this exact content. */
export const SQUIRE_ALTERNATIVE_FAQ_ITEMS:SquireAlternativeFaqItem[]=[
  {question:'What is a good SQUIRE alternative for UK barbershops?',answer:'KERSIVO is an option for independent UK barbershops that want direct online booking without SQUIRE’s wider physical POS and barber-payment suite. KERSIVO Starter is £0/month for up to four active bookable barbers, with a KERSIVO-hosted page; Full KERSIVO is £39/month per location and includes a branded barbershop website and standard domain.'},
  {question:'Is SQUIRE available in the UK?',answer:'Yes. SQUIRE publicly lists UK barbershops on its booking platform, and its data processing agreement lists Squire Europe Limited in the United Kingdom. Its official pricing page also states monthly UK subscription list prices. Confirm VAT treatment and local payment features and fees before subscribing.'},
  {question:'How much does SQUIRE cost per month in the UK?',answer:`SQUIRE’s official pricing page displays UK GBP list prices: Independent ${price('independent')}/month, Pro ${price('pro')}/month, Executive ${price('executive')}/month per shop and Titan ${price('titan')}/month per shop (checked 8 October 2026). These are published UK subscription prices, not confirmed VAT-inclusive totals. Ask SQUIRE for the tax basis, UK card-processing fees and any optional add-ons.`},
  {question:'Is KERSIVO cheaper than SQUIRE?',answer:'KERSIVO Starter is £0/month and Full is £39/month per physical UK barbershop location. SQUIRE's official UK subscription prices start at £20/month, but its tiers provide different functions, and UK VAT and payment-processing terms still need confirmation. We cannot claim a universal like-for-like total saving. Compare the actual UK quote, processing charges and the functions your team needs.'},
  {question:'Does KERSIVO charge commission or booking fees?',answer:'KERSIVO charges 0% KERSIVO platform commission on booking payments on Starter and Full, and 0% on Full retail payments. Normal Stripe processing fees remain separate. Starter public bookings require a connected Stripe account and at least £5 paid online. For services above £5, clients can choose a £5 deposit or Pay in full.'},
  {question:'Does SQUIRE charge booking fees to clients?',answer:'SQUIRE’s public pricing page does not provide a single verified fee amount that applies to every UK customer booking or payment path. Confirm any client-facing booking charges, card-processing rates, refund terms and payment fees with SQUIRE and review your own checkout flow. We do not assume there is no charge or quote an unverified UK rate.'},
  {question:'Can I use my own barbershop domain with KERSIVO?',answer:'Yes. Full KERSIVO includes a branded barbershop website with a standard domain. Starter uses a KERSIVO-hosted booking page under KERSIVO branding, not a custom domain.'},
  {question:'Does SQUIRE include POS, reminders and automated barber payouts?',answer:'SQUIRE offers online bookings, reminders and in-person POS. Its official materials also describe Auto Payout and Rent Collect, while the exact features included depend on the plan and local terms. KERSIVO covers booking operations and Full retail pickup but is not a replacement for the complete SQUIRE register or automated barber bank payouts.'},
  {question:'Can I migrate my SQUIRE clients to KERSIVO?',answer:'KERSIVO can help review and import compatible business data supplied by your current booking platform, including supported CSV exports. Ask SQUIRE which client and appointment data can be exported before assuming anything can be transferred. Existing bookings, saved payment methods and reviews should not be assumed to migrate automatically.'},
  {question:'Can I keep SQUIRE live while KERSIVO is being set up?',answer:'Yes. Keep your current SQUIRE booking journey active while you prepare and review your new KERSIVO setup. You can change your public booking links once the new experience has been reviewed and approved. Data transfer scope must be checked first.'},
  {question:'Do clients need an app to book using KERSIVO?',answer:'No. Customers book through a normal browser: on a KERSIVO-hosted booking page with Starter or your own branded website with Full KERSIVO.'},
  {question:'Can I explore KERSIVO before choosing a plan?',answer:'Yes. You can explore the live KERSIVO demo, including the customer booking journey and admin, before choosing Starter at £0/month or Full at £39/month per location.'},
];
export function buildSquireAlternativeFaqJsonLd():Record<string,unknown>{
 const url=getPublicSiteUrl()+SQUIRE_ALTERNATIVE_PAGE_PATH;
 return {'@context':'https://schema.org','@type':'FAQPage','@id':url+'#faq',
 mainEntity:SQUIRE_ALTERNATIVE_FAQ_ITEMS.map(({question,answer})=>({'@type':'Question',name:question,acceptedAnswer:{'@type':'Answer',text:answer}}))};
}
