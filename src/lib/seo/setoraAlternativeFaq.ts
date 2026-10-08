import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from './defaults';
import { requireVerifiedSetoraFact, SETORA_FACTS_CHECKED_DATE } from './setoraFacts';

const monthly = requireVerifiedSetoraFact('canonicalMonthlyGbp').value;
const trial = requireVerifiedSetoraFact('trialDays').value;
export const SETORA_ALTERNATIVE_PAGE_PATH = '/setora-alternative';
export const SETORA_ALTERNATIVE_TITLE = 'Setora Alternative UK | Pricing & Features | KERSIVO';
export const SETORA_ALTERNATIVE_DESCRIPTION = `Compare Setora vs KERSIVO for UK barbershops: £${monthly} official Setora pricing, £${SAAS_MONTHLY_GBP} Full KERSIVO, free Starter, websites, deposits and switching.`;
export const SETORA_ALTERNATIVE_LAST_UPDATED_ISO = '2026-10-08';
export const SETORA_ALTERNATIVE_LAST_UPDATED_LABEL = '8 October 2026';

export const SETORA_ALTERNATIVE_FAQ_ITEMS: { question: string; answer: string }[] = [
  {question:'Is KERSIVO a Setora alternative for UK barbershops?',answer:'Yes. Both Setora and KERSIVO offer online bookings and staff scheduling for UK barbershops. KERSIVO offers a free Starter plan for up to four active bookable barbers and a £39/month Full plan per location with a branded website and standard domain.'},
  {question:'How much does Setora cost per month in the UK?',answer:`Setora's main UK pricing page lists £${monthly}/month per location, before VAT where applicable, including unlimited staff. Some Setora industry pages still display £39, which conflicts with its main pricing page; ask Setora to confirm the exact amount on your invoice before switching.`},
  {question:'Why does Setora show both £39 and £59?',answer:`As checked ${SETORA_FACTS_CHECKED_DATE}, Setora's official /pricing page and homepage show £59/month per location while its barbershop-specific page still says £39. We use the canonical £59 figure and disclose the discrepancy instead of silently treating £39 as a current universal offer.`},
  {question:'Is Setora cheaper than KERSIVO?',answer:`The standard Setora rate shown on its main pricing page is £${monthly}/month per location, versus £${SAAS_MONTHLY_GBP}/month for Full KERSIVO. KERSIVO Starter is £0/month for up to four bookable barbers but has fewer tools. Compare VAT, SMS credits, card fees and the features you will actually use.`},
  {question:'Does Setora charge per barber or booking commission?',answer:'Setora advertises unlimited staff with no per-staff seat fees, and 0% Setora commission on bookings. KERSIVO Full is also priced per location rather than per barber and does not charge KERSIVO commission. Stripe payment processing is separate where used.'},
  {question:'Does Setora provide a barbershop website and a custom domain?',answer:'Yes. Setora offers a public Shop Website separate from its focused Booking Page. Its Help Centre describes a Setora-hosted default website address and custom-domain setup with assistance. It does not establish that buying your own domain is included in the subscription. Full KERSIVO includes a standard domain and branded website.'},
  {question:'What does Setora include that KERSIVO may not?',answer:'Setora advertises a staff-operated walk-in kiosk, waitlist management, and native management apps for iOS and Android. Do not assume KERSIVO has identical versions of those tools. Full KERSIVO focuses on a branded own-domain website, Advanced Clients, Reports and retail pickup.'},
  {question:'Does Setora have a free plan?',answer:`Setora offers a ${trial}-day trial without a payment card, then the published monthly subscription if you continue. This is different from KERSIVO Starter, which is an ongoing £0/month option for up to four active bookable barbers subject to its payment and usage conditions.`},
  {question:'Are Setora payments and SMS included?',answer:'Setora includes email reminders; optional SMS reminders are charged through credits. Card processing uses Stripe rates without a Setora markup, according to Setora. KERSIVO Starter and Full also use Stripe with separate processing fees.'},
  {question:'Does KERSIVO Starter require a deposit?',answer:`Yes. For public online bookings, KERSIVO Starter requires a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit towards the service or payment in full through the connected Stripe account. The deposit is not an extra KERSIVO booking fee. Full KERSIVO provides more flexible payment settings, including Pay at shop.`},
  {question:'Can I migrate Setora clients to KERSIVO?',answer:'Setora documents customer CSV exports. KERSIVO can review supported files and help migrate compatible information, but completeness depends on the exact export fields. Do not assume automatic migration of every booking, consent record or future appointment.'},
  {question:'Can I keep Setora active while preparing KERSIVO?',answer:'Yes. Keep existing booking links live during setup. Test the KERSIVO booking flow and confirm the handling of future appointments before changing your public links.'},
  {question:'Do Setora or KERSIVO operate a consumer booking marketplace?',answer:'Neither is positioned as a consumer marketplace. Both prioritise direct bookings between the shop and its customers. Choose based on platform cost, required functionality, domain setup and payment terms.'},
  {question:'Can I try KERSIVO before replacing Setora?',answer:'Yes. You can try the public KERSIVO demo or start KERSIVO Starter at £0/month. Review your shop requirements and the exact commercial terms before switching.'},
];

export function buildSetoraAlternativeFaqJsonLd(): Record<string,unknown> {
  const pageUrl = `${getPublicSiteUrl()}${SETORA_ALTERNATIVE_PAGE_PATH}`;
  return {
    '@context':'https://schema.org',
    '@type':'FAQPage',
    '@id': `${pageUrl}#faq`,
    mainEntity: SETORA_ALTERNATIVE_FAQ_ITEMS.map(item => ({
      '@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer},
    })),
  };
}
