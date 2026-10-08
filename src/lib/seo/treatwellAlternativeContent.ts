import type { InsightCardItem, ModelComparisonItem } from '@/lib/editorial/insightIcons';
export const TREATWELL_QUICK_ANSWER_KICKER='The short version';
export const TREATWELL_QUICK_ANSWER_TITLE='Treatwell vs KERSIVO: the short answer for UK barbers.';
export const TREATWELL_QUICK_ANSWER_LEAD='Looking for a Treatwell alternative in the UK? Treatwell offers salon software and a marketplace that may introduce new customers. Its published 35% commission applies to qualifying first appointments from new marketplace customers, not all appointments. KERSIVO offers direct bookings with Starter at £0/month or Full at £39/month per location. Standard Stripe fees apply to KERSIVO card payments.';
export const TREATWELL_QUICK_ANSWER_DETAIL='Treatwell advertises 0% marketplace commission on repeat and directly booked clients, plus a separate fee for online prepayments. KERSIVO does not supply a customer discovery marketplace. Compare how you get new customers, what your shop pays, and which features you use.';
export const TREATWELL_QUICK_ANSWER_FACTS=[{label:'KERSIVO Starter',value:'£0/month · up to 4 barbers'},{label:'Full KERSIVO',value:'£39/month per location'},{label:'Treatwell first marketplace visit',value:'35% published commission'},{label:'Treatwell repeat/direct bookings',value:'0% marketplace commission'}];
export const TREATWELL_WHY_INTRO='Treatwell combines booking software with salon marketplace visibility. Barbershops comparing alternatives should separate marketing acquisition costs from software and card processing fees.';
export const TREATWELL_WHY_THEMES: readonly InsightCardItem[]=[
{icon:'discovery',title:'Marketplace discovery versus direct clients',body:'Treatwell can bring new customers through its marketplace. KERSIVO does not offer marketplace discovery; bookings come via your own channels.'},
{icon:'seats',title:'Which bookings trigger commission?',body:'Treatwell advertises 35% commission for qualifying first visits by new marketplace customers, and 0% marketplace commission on repeat/direct bookings. Individual agreements can differ.'},
{icon:'storefront',title:'Your own branded website',body:'Treatwell supports direct booking integrations with your existing online presence. Full KERSIVO adds a branded barbershop website and standard domain for £39/month per location.'},
{icon:'stack',title:'What is included in the system?',body:'Treatwell offers a broad salon ecosystem, including POS and marketing capabilities. Full KERSIVO focuses on barbershop bookings, clients, reports and retail pickup.'},
];
export const TREATWELL_FIT_PATHS: readonly [ModelComparisonItem,ModelComparisonItem]=[
{label:'Treatwell',descriptor:'Marketplace discovery and salon management',icon:'network',summary:[{label:'Discovery',value:'Treatwell marketplace'},{label:'Commission',value:'35% eligible first marketplace booking'}],heading:'Treatwell may suit your shop if…',points:['You value new-client discovery through an established marketplace','You want salon-oriented POS, marketing and reviews tools','You can justify acquisition fees with profitable first appointments and repeat visits','Your current Treatwell business already benefits from marketplace discovery']},
{label:'KERSIVO',descriptor:'Own-brand direct booking for barbers',icon:'direct',summary:[{label:'Pricing',value:'£0 Starter or £39/month Full'},{label:'Commission',value:'0% KERSIVO commission'}],heading:'KERSIVO may suit your shop if…',points:['Your customers find you through Google, Instagram or personal referrals','You want a £0 core booking plan with mandatory online deposit/full payment','You want a branded website and standard domain on a flat £39/month Full plan','You want retail pickup, reports, advanced clients and flexible Full payment settings']},
];
export const TREATWELL_FIT_CLOSING='Marketplace reach can be valuable. Choose based on new-client acquisition, total charges and the customer journey, rather than commission headlines alone.';
export const TREATWELL_SWITCHING_REASSURANCE='Keep Treatwell live while preparing your new KERSIVO setup.';
export const TREATWELL_SWITCHING_STEPS=[
{title:'Keep your bookings running',body:'Continue using Treatwell until the new booking flow is ready.'},
{title:'Check the available data export',body:'Ask Treatwell which customer, service and appointment fields your account can export.'},
{title:'Review compatible data',body:'KERSIVO can help assess migration of usable compatible exports, including supported CSV files.'},
{title:'Configure KERSIVO',body:'Set up barbers, services and availability. Full includes your branded website and standard domain.'},
{title:'Verify future bookings',body:'Cross-check upcoming appointments and client records before announcing a switch.'},
{title:'Switch public links when ready',body:'Update Google, website and social booking links after approving the new journey.'},
];
export const TREATWELL_SWITCHING_LIMITS=['Treatwell export availability and data fields must be verified; no complete automatic migration is guaranteed.','Keep existing future appointments accessible during the transition.'];