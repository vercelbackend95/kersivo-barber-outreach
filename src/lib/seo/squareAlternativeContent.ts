import type { InsightCardItem, ModelComparisonItem } from '@/lib/editorial/insightIcons';
export const SQUARE_QUICK_ANSWER_KICKER='The short version';
export const SQUARE_QUICK_ANSWER_TITLE='Square Appointments vs KERSIVO: the short answer.';
export const SQUARE_QUICK_ANSWER_LEAD='KERSIVO is a Square Appointments alternative for independent UK barbershops. Square offers Free (£0), Plus (£29/month) and Premium (£69/month) appointment plans per location, plus payment-processing fees. KERSIVO Starter is £0/month for up to four bookable barbers; Full KERSIVO is £39/month per location and includes a complete branded website on your own standard domain.';
export const SQUARE_QUICK_ANSWER_DETAIL='Square is particularly strong when appointments, point of sale and in-person payments are part of the same workflow. KERSIVO focuses on a barber-specific digital experience. Square already offers a customisable booking site, a free full-service Square Online website option, deposits and SMS reminders; this is a comparison of business models, not a claim that those functions are missing.';
export const SQUARE_QUICK_ANSWER_FACTS=[{label:'Square Appointments Free',value:'£0/month · processing fees apply'},{label:'Square Appointments Plus',value:'£29/month per location'},{label:'Square Appointments Premium',value:'£69/month per location'},{label:'Full KERSIVO',value:'£39/month per location'}];
export const SQUARE_WHY_INTRO='Square Appointments is a serious scheduling and payments platform. For a barber, the question is whether its broad POS ecosystem or KERSIVO’s own-domain barber experience better matches the way the shop operates.';
export const SQUARE_WHY_THEMES: readonly InsightCardItem[]=[
{icon:'storefront',title:'One complete brand experience',body:'Square provides both booking websites and a full-service Square Online website. Full KERSIVO bundles a standard domain, barbershop website, bookings and retail pickup in its barber-specific £39/month platform.'},
{icon:'stack',title:'POS versus an online-first platform',body:'Square is strong in point-of-sale hardware and integrated card acceptance. KERSIVO focuses on online bookings and shop operations, not replacing the physical till or card terminal.'},
{icon:'seats',title:'Which features justify a paid plan?',body:'Square Free already offers unlimited staff calendars, reminders, deposits and a booking website. Compare Square Plus and Premium features with the Full KERSIVO platform rather than judging by price alone.'},
{icon:'direct',title:'What your clients experience',body:'KERSIVO Starter uses a hosted booking page; Full centres bookings on your shop website and domain. Choose the model that fits where customers find, rebook and buy from your shop.'},
];
export const SQUARE_FIT_PATHS: readonly [ModelComparisonItem,ModelComparisonItem]=[
{label:'Square Appointments',descriptor:'Appointments and POS ecosystem',icon:'network',summary:[{label:'Plans',value:'£0 / £29 / £69 per month'},{label:'Payments',value:'Square processing fees'}],heading:'Square may suit your shop if…',points:['You already rely on Square POS or card terminals','You want a free appointment plan with unlimited staff calendars','You value Square’s configurable deposits and text reminders','You need complex resource management or Square’s wider commerce tools']},
{label:'KERSIVO',descriptor:'Barber-focused booking and own-brand experience',icon:'direct',summary:[{label:'Starter',value:'£0/month · up to 4 barbers'},{label:'Full',value:'£39/month per location'}],heading:'KERSIVO may suit your shop if…',points:['You want the core booking operation with no monthly subscription','You want Full bookings, website and retail pickup under your own domain','You favour a barber-specific dashboard rather than a broad POS platform','You want 0% KERSIVO commission; Stripe fees apply separately']},
];
export const SQUARE_FIT_CLOSING='Square can be the better option for integrated POS and in-person retail. KERSIVO can be the better fit for an independent barbershop prioritising a branded online journey.';
export const SQUARE_SWITCHING_REASSURANCE='Keep Square Appointments running while you prepare KERSIVO. Do not switch live booking links until you have reviewed the new setup.';
export const SQUARE_SWITCHING_STEPS=[
{title:'Keep Square appointments live',body:'Continue serving existing clients and taking bookings in Square during preparation.'},
{title:'Export your Customer Directory',body:'Square provides a Customer Directory CSV export. Review its fields and permissions before sharing business data.'},
{title:'Check future appointments separately',body:'Do not assume all upcoming appointments or historic booking data can be imported automatically; check export availability and map any gaps.'},
{title:'Set up KERSIVO',body:'Configure services, team and availability. For Full, prepare your branded website and standard domain.'},
{title:'Review and approve',body:'Test the new booking journey. On Full, approve your private site preview before switching.'},
{title:'Move your public booking links',body:'Update your Google, social and website booking destinations only when the new setup is ready.'},
];
export const SQUARE_SWITCHING_LIMITS=['Only usable, legally transferable records in supported formats can be migrated; there is no guaranteed full Square migration.','Payment card details are sensitive. Never email card data or assume card-on-file records will move into KERSIVO or Stripe.'];
