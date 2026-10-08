import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
export const VAGARO_ALTERNATIVE_PAGE_PATH = '/vagaro-alternative';
export const VAGARO_ALTERNATIVE_TITLE = 'Vagaro Alternative UK | Pricing, Fees & Barbers | KERSIVO';
export const VAGARO_ALTERNATIVE_DESCRIPTION = 'Compare Vagaro vs KERSIVO for UK barbershops: Vagaro pricing, marketplace fees, booking tools, website options and how to switch.';
export const VAGARO_ALTERNATIVE_LAST_UPDATED_ISO = '2026-10-08';
export const VAGARO_ALTERNATIVE_LAST_UPDATED_LABEL = '8 October 2026';
export const VAGARO_ALTERNATIVE_FAQ_ITEMS = [
{question:'Is KERSIVO a Vagaro alternative for UK barbershops?',answer:'Yes. KERSIVO is an online booking and barbershop management platform for independent UK barbers. KERSIVO Starter costs £0/month for up to four bookable barbers, while Full costs £39/month per location with a branded website and standard domain.'},
{question:'How much does Vagaro cost in the UK?',answer:'Vagaro’s official UK pricing page currently shows £20/month for one bookable calendar, alongside a crossed-out £30 price. Pricing changes with the number of calendars and any selected services, so check a live quote for your shop and whether the displayed promotional price applies.'},
{question:'Does Vagaro charge commission on bookings?',answer:'Vagaro publishes a one-time 20% new-client fee on qualifying first appointments through the UK Marketplace and certain other channels. Its UK participation agreement contains specific conditions for partner networks, own channels, promotional settings and existing clients. This is not a universal charge on every appointment.'},
{question:'Does Vagaro charge 20% for every new client?',answer:'No. The UK terms tie the new-client connection fee to specified acquisition channels and settings, including marketplace listings. Own-channel new-client bookings have different rules depending on Fill My Books settings. Check the current UK Customer Participation Agreement before estimating fees.'},
{question:'Is Vagaro free?',answer:'Vagaro advertises a 30-day trial, but the published UK business subscription is not a permanent £0/month plan. KERSIVO Starter has a £0/month subscription; Starter public bookings require Stripe and at least £5 online payment, with normal Stripe processing fees.'},
{question:'Does Vagaro have online booking, deposits and reminders?',answer:'Yes. Vagaro supports online bookings, calendar management and automated reminders, and advertises payment tools. The reason to compare KERSIVO is its barber-first offering, subscription structure and direct own-brand customer experience rather than claiming Vagaro lacks these fundamentals.'},
{question:'Can I use my own website with Vagaro?',answer:'Vagaro offers booking widgets for existing business websites. Full KERSIVO includes a branded barbershop website and a standard own domain for £39/month per location.'},
{question:'Does KERSIVO charge per barber?',answer:'KERSIVO Starter supports up to four active bookable barbers for £0/month at one location. Full KERSIVO is £39/month per physical location without a per-barber subscription charge, subject to reasonable fair use.'},
{question:'Can I export customers from Vagaro?',answer:'Yes. Vagaro Support documents that a business owner can export a customer list as Excel or PDF from customer reports. KERSIVO can review compatible exports for migration, but cannot guarantee every data field or future appointment will transfer.'},
{question:'Can I keep Vagaro while setting up KERSIVO?',answer:'Yes. Keep your existing Vagaro appointments accessible while preparing KERSIVO. Switch public booking links after the new setup is reviewed and ready.'},
{question:'Does KERSIVO have a marketplace?',answer:'No. KERSIVO focuses on direct bookings rather than consumer marketplace discovery. Vagaro Marketplace may be useful to businesses that value reaching new clients through a platform.'},
{question:'Is KERSIVO Starter really £0/month?',answer:'KERSIVO Starter has no monthly KERSIVO subscription or KERSIVO platform commission. Public online bookings require a connected Stripe account and a £5 deposit or full payment. Stripe processing fees apply. Starter does not include a custom domain, full branded site, SMS reminders, retail pickup or full CRM.'},
{question:'Can I see KERSIVO before switching?',answer:'Yes. Visit the live KERSIVO demo to explore the booking flow and Full platform experience before choosing Starter or Full.'},
];
export function buildVagaroAlternativeFaqJsonLd(): Record<string,unknown> {
const pageUrl = `${getPublicSiteUrl()}${VAGARO_ALTERNATIVE_PAGE_PATH}`;
return {'@context':'https://schema.org','@type':'FAQPage','@id':`${pageUrl}#faq`,mainEntity:VAGARO_ALTERNATIVE_FAQ_ITEMS.map(item=>({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer}}))};
}
