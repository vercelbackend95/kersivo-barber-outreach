import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
export const TREATWELL_ALTERNATIVE_PAGE_PATH = '/treatwell-alternative';
export const TREATWELL_ALTERNATIVE_TITLE = 'Treatwell Alternative UK | Pricing & Fees | KERSIVO';
export const TREATWELL_ALTERNATIVE_DESCRIPTION = 'Compare Treatwell vs KERSIVO for UK barbers: 35% first marketplace booking commission, direct bookings, deposits, websites and pricing.';
export const TREATWELL_ALTERNATIVE_LAST_UPDATED_ISO = '2026-10-08';
export const TREATWELL_ALTERNATIVE_LAST_UPDATED_LABEL = '8 October 2026';
export const TREATWELL_ALTERNATIVE_FAQ_ITEMS = [
{question:'Is KERSIVO a Treatwell alternative for UK barbers?',answer:'Yes. KERSIVO offers direct booking software for independent UK barbershops. Starter is £0/month for up to four bookable barbers; Full is £39/month per location with a branded website and standard domain. Unlike Treatwell, KERSIVO does not operate a consumer marketplace.'},
{question:'How much commission does Treatwell charge in the UK?',answer:'Treatwell publicly lists 35% commission on the first booking from a new customer introduced through its marketplace. This is not a commission on every visit. Check your individual partner agreement, VAT treatment and which clients qualify.'},
{question:'Does Treatwell charge commission on repeat bookings?',answer:'Treatwell’s UK pricing page advertises 0% marketplace commission on repeat appointments and clients booking directly with the salon.'},
{question:'Are Treatwell website and social bookings commission-free?',answer:'Treatwell says bookings made directly through a salon’s website or social booking integrations are commission-free. A separate online prepayment processing fee may still apply.'},
{question:'How much does Treatwell charge for online prepayments?',answer:'Treatwell lists 2.5% plus VAT for online prepayment processing on its public UK pricing page. This is separate from qualifying marketplace new-client acquisition commission.'},
{question:'Is Treatwell free to use?',answer:'Treatwell’s partner pricing promotes Start for free options, but some plans or individual agreements can have monthly charges. Confirm your own pricing and terms before signing.'},
{question:'Is KERSIVO Starter really free?',answer:'KERSIVO Starter has no monthly subscription for up to four active bookable barbers at one location. Public appointments require a £5 deposit towards the service or full online payment using a connected Stripe account. Standard Stripe processing fees apply.'},
{question:'Does KERSIVO charge commission on bookings?',answer:'KERSIVO charges 0% KERSIVO platform commission on bookings under Starter and Full. Standard Stripe processing fees still apply to card payments.'},
{question:'Can I get my own website with KERSIVO?',answer:'Full KERSIVO includes a branded barbershop website and one standard domain for £39/month per physical location. Starter uses a KERSIVO-hosted booking page.'},
{question:'Does KERSIVO offer marketplace discovery like Treatwell?',answer:'No. Treatwell can help you find customers via its marketplace. KERSIVO focuses on direct bookings via your own website, Google profile, social accounts and shop QR code.'},
{question:'Can I migrate clients and bookings from Treatwell?',answer:'KERSIVO can help assess compatible export data, including supported CSV exports. Check with Treatwell exactly what can be exported; a complete automatic client or appointment migration cannot be guaranteed.'},
{question:'Can I keep Treatwell live until KERSIVO is ready?',answer:'Yes. Keep your current calendar accessible while configuring KERSIVO and reviewing a switch plan. Change booking links once your setup and future appointments have been checked.'},
{question:'Which system is better for an independent barbershop?',answer:'Treatwell may fit if marketplace customer discovery and broader salon POS/marketing features are important. KERSIVO may fit if most clients find you directly and you value £0 Starter or a £39/month branded Full website with 0% KERSIVO platform commission.'},
];
export function buildTreatwellAlternativeFaqJsonLd(): Record<string,unknown> {
const pageUrl = `${getPublicSiteUrl()}${TREATWELL_ALTERNATIVE_PAGE_PATH}`;
return {'@context':'https://schema.org','@type':'FAQPage','@id':`${pageUrl}#faq`,mainEntity:TREATWELL_ALTERNATIVE_FAQ_ITEMS.map(item=>({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer}}))};
}