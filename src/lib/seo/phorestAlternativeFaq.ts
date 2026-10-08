import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
export const PHOREST_ALTERNATIVE_PAGE_PATH='/phorest-alternative';
export const PHOREST_ALTERNATIVE_TITLE='Phorest Alternative UK for Barbershops | KERSIVO';
export const PHOREST_ALTERNATIVE_DESCRIPTION='Looking for a Phorest alternative in the UK? Compare KERSIVO and Phorest pricing, bookings, deposits, websites, client tools and switching for barbershops.';
export const PHOREST_ALTERNATIVE_LAST_UPDATED_ISO='2026-10-08';
export const PHOREST_ALTERNATIVE_LAST_UPDATED_LABEL='8 October 2026';
export const PHOREST_ALTERNATIVE_FAQ_ITEMS=[
{question:'Is KERSIVO an alternative to Phorest for UK barbers?',answer:'Yes. KERSIVO is built for independent UK barbershops. Starter provides a hosted booking page at £0/month for up to four active bookable barbers. Full costs £39/month per location and includes a branded website and standard domain.'},
{question:'How much does Phorest cost in the UK?',answer:'Phorest’s official UK pricing website asks businesses to request a quote rather than publishing a single monthly GBP price for every shop. Ask Phorest to detail the subscription, add-ons and payment charges in writing.'},
{question:'Is Phorest designed for barbershops?',answer:'Phorest is a broad salon, clinic and spa platform. Barber businesses can assess its appointment and business tools, while KERSIVO is built specifically around independent UK barbershops.'},
{question:'Does Phorest have online booking and deposits?',answer:'Yes. Phorest advertises web and social online booking plus configurable deposits. KERSIVO also has online booking and deposits; its Starter and Full plans have different payment rules.'},
{question:'Does Phorest have a branded booking app?',answer:'Phorest offers a branded client booking app, with availability and commercial terms depending on the package or options. KERSIVO Full focuses on a branded website on your own standard domain rather than promising a dedicated native app for each shop.'},
{question:'Does KERSIVO charge per barber?',answer:'KERSIVO Starter supports up to four active bookable barbers for £0/month. Full is £39/month per location without an additional per-barber subscription fee, subject to fair use.'},
{question:'Does KERSIVO charge booking commission?',answer:'KERSIVO charges 0% KERSIVO commission on booking payments. Standard Stripe processing fees apply. Starter public booking requires an online £5 deposit towards the service or full payment.'},
{question:'Can I migrate clients from Phorest to KERSIVO?',answer:'KERSIVO can help assess and migrate usable, legally exportable records, including compatible CSV files. Confirm what Phorest can provide before assuming a complete client, booking or marketing-data transfer.'},
{question:'Can I keep Phorest while preparing KERSIVO?',answer:'Yes. Keep your existing Phorest booking setup active while KERSIVO is prepared. For Full KERSIVO, review the private website preview and approve launch before switching public links.'},
{question:'Is KERSIVO Starter really free?',answer:'KERSIVO Starter is £0/month with 0% KERSIVO commission for up to four bookable barbers. Public bookings need a connected Stripe account and a minimum £5 online payment or full service prepayment. Stripe processing fees apply.'},
{question:'Can I use my own website and domain?',answer:'Full KERSIVO includes a branded barbershop website and one standard domain. Starter provides a KERSIVO-hosted booking page, not a custom domain or full website.'},
{question:'Does KERSIVO replace Phorest’s marketing and POS features?',answer:'Not feature for feature. Phorest offers a larger salon marketing, loyalty, POS and stock-management suite. KERSIVO Full includes focused booking management, advanced clients, reports and retail pickup, without claiming identical functionality.'},
{question:'Can I see a KERSIVO demo before switching?',answer:'Yes. Explore the live KERSIVO demo and booking journey before choosing Starter or Full.'},
];
export function buildPhorestAlternativeFaqJsonLd():Record<string,unknown>{
const pageUrl=`${getPublicSiteUrl()}${PHOREST_ALTERNATIVE_PAGE_PATH}`;
return {'@context':'https://schema.org','@type':'FAQPage','@id':`${pageUrl}#faq`,mainEntity:PHOREST_ALTERNATIVE_FAQ_ITEMS.map(item=>({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer}}))};
}
