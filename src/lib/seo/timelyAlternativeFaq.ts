import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
export const TIMELY_ALTERNATIVE_PAGE_PATH = '/timely-alternative';
export const TIMELY_ALTERNATIVE_TITLE = 'Timely Alternative UK | Pricing & Features | KERSIVO';
export const TIMELY_ALTERNATIVE_DESCRIPTION = 'Compare Timely vs KERSIVO for UK barbershops: pricing, online bookings, deposits, websites, salon features and switching. Explore the live KERSIVO demo.';
export const TIMELY_ALTERNATIVE_LAST_UPDATED_ISO = '2026-10-08';
export const TIMELY_ALTERNATIVE_LAST_UPDATED_LABEL = '8 October 2026';
export const TIMELY_ALTERNATIVE_FAQ_ITEMS = [
 {question:'Is KERSIVO a Timely alternative for UK barbershops?',answer:'Yes. Both offer online appointment booking. KERSIVO Starter is £0/month for up to four active bookable barbers at one location. Full KERSIVO costs £39/month per physical location and includes a branded website and standard domain. Timely is a broader salon and beauty business platform.'},
 {question:'How much does Timely cost in the UK?',answer:'Timely lists Build, Elevate and Innovate plans. Its public pricing view can display USD per staff member for the USA, which is not a verified UK GBP quote. UK monthly price, VAT, payments and add-ons should be confirmed with Timely for your team before comparing costs.'},
 {question:'Does Timely charge a booking commission?',answer:'Timely’s published Build, Elevate and Innovate plans advertise no new-client fees. This does not eliminate subscription and payment-processing fees. Check UK TimelyPay fees for your shop. KERSIVO charges 0% KERSIVO commission on bookings; normal Stripe processing fees apply.'},
 {question:'Can clients book online with Timely?',answer:'Yes. Timely supports online appointment scheduling for salon and beauty businesses, including configurable booking tools. KERSIVO provides a hosted booking page on Starter and a full branded website with booking on Full.'},
 {question:'Does Timely support deposits and online payments?',answer:'Timely offers online payment and deposit-related tools, subject to plan, location and payment setup. Confirm Timely’s current processing charges and conditions. KERSIVO Starter requires a £5 deposit towards the appointment or full online prepayment via Stripe.'},
 {question:'Does Timely include a website?',answer:'Timely provides online booking tools and options for embedding or linking bookings from a business website. A complete independently branded barbershop website and standard domain are included in Full KERSIVO; Starter uses a hosted booking page. Check exact Timely website options for your plan.'},
 {question:'Is KERSIVO cheaper than Timely?',answer:'It depends on the Timely quote, number of staff, options and payment volume. KERSIVO Starter is £0/month for up to four bookable barbers; Full KERSIVO is £39/month per location. Compare the full feature requirements and payment-processing costs instead of monthly subscription alone.'},
 {question:'Does KERSIVO charge per barber?',answer:'Starter supports up to four active bookable barbers at one location. Full KERSIVO is £39/month per location with no per-barber subscription charge, subject to fair use.'},
 {question:'Can I migrate client details from Timely to KERSIVO?',answer:'Timely documents an export request through its support team for clients, appointments, services, client notes, products and product purchases. KERSIVO can review the actual downloaded files and help with compatible CSV migrations. This does not guarantee every appointment or record imports automatically.'},
 {question:'Can I keep Timely active while setting up KERSIVO?',answer:'Yes. Continue using Timely while KERSIVO is configured and checked. Review the new booking flow first, then change public booking links only once you are ready.'},
 {question:'Does KERSIVO replace every Timely feature?',answer:'No. Timely offers salon-oriented workflows and capabilities that may not have direct KERSIVO equivalents. Compare your must-have features, such as inventory, marketing tools, reporting and staff management, before switching.'},
 {question:'Can I try KERSIVO before changing booking software?',answer:'Yes. Explore the live booking experience and Full KERSIVO dashboard via the public demo, or start with the free Starter plan.'},
 {question:'Does Timely offer a free trial?',answer:'Timely’s public pricing page advertises a 14-day free trial. Confirm current eligibility and subscription terms for your UK shop.'},
 {question:'Does Timely charge for each staff member?',answer:'Timely’s current public Build, Elevate and Innovate plan selector displays per-staff subscription pricing and says part-time staff are charged at the same rate as full-time staff. Verify the UK price and your exact team setup with Timely.'},
 {question:'Can I export customers and appointments from Timely?',answer:'Yes. Timely’s Help Centre documents a support-requested export of clients, appointments, services, client notes, products and product purchases. Timely says export requests can take up to 48 hours. Confirm the file formats and contents before planning migration.'},
];

export function buildTimelyAlternativeFaqJsonLd(): Record<string, unknown> {
  const pageUrl = `${getPublicSiteUrl()}${TIMELY_ALTERNATIVE_PAGE_PATH}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    mainEntity: TIMELY_ALTERNATIVE_FAQ_ITEMS.map(item => ({
      '@type': 'Question', name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}
