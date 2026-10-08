import type { InsightCardItem, ModelComparisonItem } from '@/lib/editorial/insightIcons';
export const PHOREST_QUICK_ANSWER_KICKER='The short version';
export const PHOREST_QUICK_ANSWER_TITLE='Phorest vs KERSIVO: the short answer for UK barbers.';
export const PHOREST_QUICK_ANSWER_LEAD='KERSIVO is a Phorest alternative for independent UK barbershops. Phorest offers extensive salon management, bookings, marketing, POS and branded-app tools, with UK pricing supplied by quote. KERSIVO Starter costs £0/month for up to four bookable barbers, while Full KERSIVO costs £39/month per location and includes a branded website and standard domain. Both KERSIVO plans take 0% KERSIVO commission; Stripe processing fees apply.';
export const PHOREST_QUICK_ANSWER_DETAIL='Phorest may suit a salon needing broad marketing, loyalty and POS tools. KERSIVO may suit a barber wanting a simpler UK barber-focused subscription and, with Full, bookings centred on their own site.';
export const PHOREST_QUICK_ANSWER_FACTS=[{label:'KERSIVO Starter',value:'£0/month · up to 4 barbers'},{label:'Full KERSIVO',value:'£39/month per location'},{label:'Phorest UK',value:'Pricing by quotation'},{label:'Phorest product',value:'Salon management suite'}];
export const PHOREST_WHY_INTRO='Phorest already has serious capabilities. The meaningful question is whether its wider salon platform or a more focused barber booking experience better matches your business.';
export const PHOREST_WHY_THEMES:readonly InsightCardItem[]=[
{icon:'seats',title:'Know what the plan costs',body:'Phorest provides personalised pricing quotes, with plan scope and optional extras to review. KERSIVO publishes £0/month Starter and £39/month Full pricing.'},
{icon:'storefront',title:'Put your barbershop brand first',body:'Phorest offers web bookings and branded apps. Full KERSIVO combines a branded website, standard domain and customer booking flow into one barbershop-focused subscription.'},
{icon:'discovery',title:'Choose the right level of software',body:'A multi-service salon may benefit from Phorest POS, loyalty and marketing depth. A focused barber business may not need every part of that broader stack.'},
{icon:'stack',title:'Review deposit rules',body:'Phorest provides flexible booking deposits. KERSIVO Starter requires £5 towards the booking or full prepayment; Full offers editable payment modes.'},
];
export const PHOREST_FIT_PATHS:readonly [ModelComparisonItem,ModelComparisonItem]=[
{label:'Phorest',descriptor:'Full-featured salon management ecosystem',icon:'network',summary:[{label:'Pricing',value:'Individual quote'},{label:'Focus',value:'Salons, clinics and spas'}],heading:'Phorest may suit your shop if…',points:['You need deeper salon POS, inventory and marketing automation','A branded client app or loyalty tools are important to your business','You operate a more complex salon business with multiple treatment types','Your current Phorest workflow is valuable and a switch offers little benefit']},
{label:'KERSIVO',descriptor:'Free barber bookings or a full branded site',icon:'direct',summary:[{label:'Pricing',value:'£0 Starter or £39/month Full'},{label:'Focus',value:'Independent UK barbershops'}],heading:'KERSIVO may suit your shop if…',points:['You want free hosted core bookings for up to four barbers','You prefer a published flat Full subscription per location','You want an own-domain branded website with Full KERSIVO','You value a focused booking, client and retail pickup platform']},
];
export const PHOREST_FIT_CLOSING='Choose on the features you genuinely need, the written quote and how you want your clients to book.';
export const PHOREST_SWITCHING_REASSURANCE='Keep Phorest live while your KERSIVO setup is prepared.';
export const PHOREST_SWITCHING_STEPS=[
{title:'Keep your current calendar running',body:'Do not switch off Phorest just because you are reviewing another platform.'},
{title:'Confirm which data can be exported',body:'Ask Phorest about usable client, service and upcoming appointment exports and applicable privacy/contract terms.'},
{title:'Review compatible files',body:'KERSIVO can assist with compatible data such as supported CSV exports; no complete transfer is guaranteed.'},
{title:'Prepare your KERSIVO setup',body:'Set up the barbers, services and availability. Full adds your own branded site and domain.'},
{title:'Review and approve',body:'Check the private Full website preview, prices and booking journey before launch.'},
{title:'Change public booking links',body:'Move public links when ready, with a checked plan for future appointments.'},
];
export const PHOREST_SWITCHING_LIMITS=['Phorest export fields, access and format must be confirmed before migration; do not assume every record can move.','Reviews, loyalty points and historical marketing data may not transfer; keep the original records accessible as permitted by your contract.'];
