import type { InsightCardItem, ModelComparisonItem } from '@/lib/editorial/insightIcons';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { estimateTreatwellPublishedBookingFees, requireVerifiedTreatwellFact } from '@/lib/seo/treatwellFacts';

const pct = (n: number) => `${n}%`;
const gbp = (n: number) => Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`;
const NEW_CLIENT = pct(requireVerifiedTreatwellFact('newMarketplaceClientCommission').percent!);
const REPEAT = pct(requireVerifiedTreatwellFact('repeatBookingMarketplaceCommission').percent!);
const FULL = gbp(SAAS_MONTHLY_GBP);
const DEPOSIT = gbp(KERSIVO_BOOKING_DEPOSIT_GBP);
export const TREATWELL_QUICK_ANSWER_KICKER='The short version';
export const TREATWELL_QUICK_ANSWER_TITLE='Treatwell vs KERSIVO: the short answer for UK barbers.';
export const TREATWELL_QUICK_ANSWER_LEAD=`Looking for a Treatwell Connect alternative in the UK? Treatwell offers salon software and a marketplace that may introduce new customers. Its published ${NEW_CLIENT} + VAT commission applies to eligible new-client marketplace bookings, not all appointments; its September 2026 terms include a 365-day repeat-booking test. KERSIVO offers direct bookings with Starter at £0/month or Full at ${FULL}/month per location. Standard Stripe fees apply to KERSIVO card payments.`;
export const TREATWELL_QUICK_ANSWER_DETAIL=`Treatwell advertises ${REPEAT} marketplace commission on repeat and directly booked clients, plus a separate fee for online prepayments. KERSIVO does not supply a customer discovery marketplace. Compare how you get new customers, what your shop pays, and which features you use.`;
export const TREATWELL_QUICK_ANSWER_FACTS=[{label:'KERSIVO Starter',value:'£0/month · up to 4 barbers'},{label:'Full KERSIVO',value:`${FULL}/month per location`},{label:'Treatwell first marketplace visit',value:`${NEW_CLIENT} published commission`},{label:'Treatwell repeat/direct bookings',value:`${REPEAT} marketplace commission`}];
export const TREATWELL_WHY_INTRO='Treatwell combines booking software with salon marketplace visibility. Barbershops comparing alternatives should separate marketing acquisition costs from software and card processing fees.';
export const TREATWELL_WHY_THEMES: readonly InsightCardItem[]=[
{icon:'discovery',title:'Marketplace discovery versus direct clients',body:'Treatwell can bring new customers through its marketplace. KERSIVO does not offer marketplace discovery; bookings come via your own channels.'},
{icon:'seats',title:'Which bookings trigger commission?',body:`Treatwell advertises ${NEW_CLIENT} commission for qualifying first visits by new marketplace customers, and ${REPEAT} marketplace commission on repeat/direct bookings. Individual agreements can differ.`},
{icon:'storefront',title:'Your own branded website',body:`Treatwell supports direct booking integrations with your existing online presence. Full KERSIVO adds a branded barbershop website and standard domain for ${FULL}/month per location.`},
{icon:'stack',title:'What is included in the system?',body:'Treatwell offers a broad salon ecosystem, including POS and marketing capabilities. Full KERSIVO focuses on barbershop bookings, clients, reports and retail pickup.'},
];
export const TREATWELL_FIT_PATHS: readonly [ModelComparisonItem,ModelComparisonItem]=[
{label:'Treatwell',descriptor:'Marketplace discovery and salon management',icon:'network',summary:[{label:'Discovery',value:'Treatwell marketplace'},{label:'Commission',value:`${NEW_CLIENT} eligible first marketplace booking`}],heading:'Treatwell may suit your shop if…',points:['You value new-client discovery through an established marketplace','You want salon-oriented POS, marketing and reviews tools','You can justify acquisition fees with profitable first appointments and repeat visits','Your current Treatwell business already benefits from marketplace discovery']},
{label:'KERSIVO',descriptor:'Own-brand direct booking for barbers',icon:'direct',summary:[{label:'Pricing',value:`£0 Starter or ${FULL}/month Full`},{label:'Commission',value:'0% KERSIVO commission · Stripe fees apply'}],heading:'KERSIVO may suit your shop if…',points:['Your customers find you through Google, Instagram or personal referrals',`You want a £0 core booking plan with a mandatory ${DEPOSIT} online deposit or full payment`,`You want a branded website and standard domain on a flat ${FULL}/month Full plan`,'You want retail pickup, reports, advanced clients and flexible Full payment settings']},
];
export const TREATWELL_FIT_CLOSING='Marketplace reach can be valuable. Choose based on new-client acquisition, total charges and the customer journey, rather than commission headlines alone.';
export const TREATWELL_SWITCHING_REASSURANCE='Prepare KERSIVO while keeping Treatwell appointments accessible. Check your Treatwell agreement before taking live bookings in two systems.';
export const TREATWELL_SWITCHING_STEPS=[
{title:'Keep your bookings running',body:'Continue using Treatwell for public bookings while preparing KERSIVO privately. Check your contract for any restrictions on parallel booking software.'},
{title:'Check the available data export',body:'Ask Treatwell which customer, service and appointment fields your account can export.'},
{title:'Review compatible data',body:'KERSIVO can help assess migration of usable compatible exports, including supported CSV files.'},
{title:'Configure KERSIVO',body:'Set up barbers, services and availability. Full includes your branded website and standard domain.'},
{title:'Verify future bookings',body:'Cross-check upcoming appointments and client records before announcing a switch.'},
{title:'Switch public links when ready',body:'Update Google, website and social booking links only after approving the new journey and checking Treatwell contractual obligations.'},
];
export const TREATWELL_SWITCHING_LIMITS=['Treatwell export availability and data fields must be verified; no complete automatic migration is guaranteed.','Keep existing future appointments accessible during the transition. Treatwell terms restrict using another booking provider simultaneously; consult your signed agreement before enabling dual public bookings.'];
/* Published commission example: every figure comes from estimateTreatwellPublishedBookingFees. */
export const TREATWELL_COMMISSION_EXAMPLE_SERVICE_GBP = 25;
export const TREATWELL_COMMISSION_EXAMPLE_VOLUMES = [5, 10, 20] as const;

export type TreatwellCommissionExampleRow = {
  label: string;
  treatwellExVat: string;
  kersivo: string;
};

const perBookingCommission = estimateTreatwellPublishedBookingFees({
  servicePriceGbp: TREATWELL_COMMISSION_EXAMPLE_SERVICE_GBP,
  eligibility: 'eligible-new-marketplace',
  onlinePrepaid: 'no',
}).commissionExVatGbp!;

export const TREATWELL_COMMISSION_EXAMPLES: readonly TreatwellCommissionExampleRow[] =
  TREATWELL_COMMISSION_EXAMPLE_VOLUMES.map((bookings) => ({
    label: `${bookings} eligible new marketplace bookings`,
    treatwellExVat: `${gbp(Math.round(perBookingCommission * bookings * 100) / 100)} + VAT`,
    kersivo: '£0 KERSIVO commission',
  }));

export const TREATWELL_COMMISSION_EXAMPLES_NOTE = `Each row assumes a ${gbp(TREATWELL_COMMISSION_EXAMPLE_SERVICE_GBP)} first appointment paid in the shop, at Treatwell’s published ${NEW_CLIENT} rate. It excludes Treatwell’s monthly software quote, online prepayment processing and any terms in your own agreement. Repeat and direct bookings that qualify under Treatwell’s terms carry ${REPEAT} marketplace commission. KERSIVO has no marketplace, so it brings no new clients to compare against; standard Stripe processing fees apply to KERSIVO card payments.`;
