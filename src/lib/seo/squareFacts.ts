/** Verified Square Appointments UK claims, checked 8 October 2026. */
export const SQUARE_FACTS_CHECKED_ISO = '2026-10-08';
export const SQUARE_FACTS_CHECKED_DATE = '8 October 2026';
export const SQUARE_SOURCES = [
  {label:'Square Appointments UK pricing',url:'https://squareup.com/gb/en/appointments/pricing',supports:'Free, Plus and Premium subscriptions, processing fees and staff calendars'},
  {label:'Square Appointments overview',url:'https://squareup.com/gb/en/appointments',supports:'Booking website, reminders, point of sale and plan features'},
  {label:'Square deposits guide',url:'https://squareup.com/help/gb/en/article/8096-deposits-on-square-appointments',supports:'Fixed or percentage deposits on Free, Plus and Premium'},
  {label:'Square cancellations and no-show policies',url:'https://squareup.com/help/gb/en/article/5493-set-a-custom-cancellation-policy-with-square-appointments',supports:'Plus/Premium cancellation and no-show rules'},
  {label:'Square customer data export',url:'https://squareup.com/help/gb/en/article/7871-export-card-on-file-to-third-party-payment-processors',supports:'Customer Directory CSV export steps'},
  {label:'Square reports export',url:'https://squareup.com/help/gb/en/article/8362-print-export-or-email-your-reports',supports:'CSV report export'},
] as const;
export const SQUARE_UK_PLANS = [
 { name:'Free',monthlyGbp:0,description:'Single-location free scheduling plan; processing fees still apply.' },
 { name:'Plus',monthlyGbp:29,description:'Additional scheduling tools, waitlist, reports and cancellation policies.' },
 { name:'Premium',monthlyGbp:69,description:'Advanced access and staff/resource management capabilities.' }
] as const;
export const SQUARE_UK_PAYMENT_FACTS = {
 inPersonFreePercent:1.75,
 inPersonPaidPercent:1.6,
 onlineUkPercent:1.4,
 onlineUkFixedPence:25,
 onlineNonUkPercent:2.5,
 onlineNonUkFixedPence:25
} as const;
export const SQUARE_COMPARISON_FOOTNOTE = 'Square Appointments UK prices and features checked 8 October 2026 against official Square UK pages. Card-processing fees are separate. Prices and plan features may change.';
export const SQUARE_TRADEMARK_DISCLAIMER = 'Square and Square Appointments are trademarks of their respective owners. KERSIVO is not affiliated with, endorsed by or sponsored by Square.';
export const SQUARE_COMPARE_SECTIONS = [
 { id:'bookings',title:'Appointments & Scheduling',subtitle:'Staff calendars, booking websites and availability.',squareLead:'Appointments with unlimited staff calendars and online booking.',squarePoints:['Free, Plus and Premium offer unlimited staff calendars','Online booking website and social integrations','Automated email and text reminders on Free'],kersivoLead:'A booking system tailored to independent UK barbershops.',kersivoPoints:['Starter: hosted booking page, up to four active bookable barbers','Full: own-domain branded barbershop website','Email reminders on both plans; SMS reminders on Full'] },
 { id:'payments',title:'Payments & Deposits',subtitle:'What happens when your customers pay.',squareLead:'Integrated Square payment processing and configurable deposits.',squarePoints:['Free: 1.75% in-person card processing; Plus/Premium: 1.6%','UK online card transactions: 1.4% + 25p on published standard rates','Square offers fixed or percentage service deposits on all three plans'],kersivoLead:'Shop-connected Stripe payments and zero KERSIVO commission.',kersivoPoints:['Both plans: 0% KERSIVO commission; Stripe processing fees apply','Starter: £5 deposit or Pay in full required for public bookings','Full: configurable Pay at shop, £5 deposit or full prepayment'] },
 { id:'brand',title:'Brand & Website',subtitle:'How customers find and book your shop.',squareLead:'Square provides a customisable booking website and wider commerce ecosystem.',squarePoints:['Online booking website on Square','Bookings and payments integrated into Square’s services','Useful if Square POS is central to your shop'],kersivoLead:'Full KERSIVO focuses on your complete own-domain shop experience.',kersivoPoints:['Starter: simple KERSIVO-hosted booking page','Full: branded barbershop website with a standard domain','No consumer marketplace required for direct bookings'] },
 { id:'retail',title:'Retail & Point of Sale',subtitle:'The difference between POS and online pickup.',squareLead:'Broader integrated POS and payment hardware ecosystem.',squarePoints:['In-person checkout and payment hardware','Square can support wider retail workflows','May be better if your business needs integrated point-of-sale hardware'],kersivoLead:'Product pickup through your barbershop website on Full.',kersivoPoints:['Online retail orders paid through Stripe and collected in shop','Full product and order management','KERSIVO does not claim to replace Square POS hardware or stock control'] },
 { id:'clients',title:'Customer Records',subtitle:'Direct relationships and data portability.',squareLead:'Customer Directory and records across its tools.',squarePoints:['Customer Directory records and booking history','Customer Directory can be exported as CSV','Card-on-file migration is a separate PCI-compliant process'],kersivoLead:'Simple contacts in Starter, expanded client tools on Full.',kersivoPoints:['Starter: Clients Core plus a rolling 90 days of past booking history','Full: advanced client management and retained history','Migration assistance for usable supported CSV exports'] },
 { id:'reports',title:'Reporting & Business Tools',subtitle:'Understand operations and growth.',squareLead:'Appointment reports on Plus and more advanced tools on Premium.',squarePoints:['Waitlist and appointment reporting on Plus','Premium offers advanced staff and resource controls','Reports can be exported where supported'],kersivoLead:'Full business reporting alongside bookings and retail.',kersivoPoints:['Starter: essential Bookings, Team and Services','Full: Reports and retail Sales modules','Full is £39/month per physical location, subject to fair use'] }
] as const;
export type SquareCompareSectionId = (typeof SQUARE_COMPARE_SECTIONS)[number]['id'];
