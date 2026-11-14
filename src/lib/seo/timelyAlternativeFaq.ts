import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
export const TIMELY_ALTERNATIVE_PAGE_PATH = '/timely-alternative';
export const TIMELY_ALTERNATIVE_TITLE = 'Timely Alternative UK for Barbers: Flat £39/month | KERSIVO';
export const TIMELY_ALTERNATIVE_DESCRIPTION = 'Timely now bills weekly, by bookings. KERSIVO is £39/month per location, flat, with your own website. Compare prices, fees and switching for UK barbershops.';
export const TIMELY_ALTERNATIVE_LAST_UPDATED_ISO = '2026-11-14';
export const TIMELY_ALTERNATIVE_LAST_UPDATED_LABEL = '14 November 2026';
export const TIMELY_ALTERNATIVE_FAQ_ITEMS = [
 {question:'What is the best Timely alternative for a UK barbershop?',answer:'If you run an independent barbershop and want a flat price, your own website and deposits on every booking, KERSIVO is built for exactly that. Full KERSIVO is £39/month per location, flat, with a branded barbershop website and your own domain. KERSIVO Starter is £0/month for up to four bookable barbers. Timely is broader salon, beauty and wellness software and may suit shops that need its waitlist, stock or consultation tools.'},
 {question:'How much does Timely cost in the UK?',answer:'Timely’s Great Britain pricing page lists three plans billed weekly: Run from £4 a week, Boost from £7 a week and Thrive from £9 a week, with unlimited team members. These are starting prices: Timely says the weekly bill adjusts with the number of bookings you take, and it does not publish how far it rises. Advanced team management is an extra £8 a week. Check your own invoice for your real cost.'},
 {question:'Why does my Timely bill change every week?',answer:'Timely calculates its UK bill from the number of bookings you take each week, so a busy week costs more than a quiet one. Full KERSIVO is a flat £39/month per location however many bookings you take.'},
 {question:'Is KERSIVO cheaper than Timely?',answer:'It depends on how busy you are and which features you need. At its lowest booking level Timely Boost starts at about £30.33 a month (£7 a week) and Thrive at about £39 a month (£9 a week), and both rise with bookings. Full KERSIVO stays at £39/month per location, and Starter is £0/month for up to four barbers. Compare your actual weekly Timely invoice, converted to a monthly figure, with KERSIVO’s price.'},
 {question:'Does Timely charge a booking commission?',answer:'Timely advertises no new-client fees. TimelyPay charges 1.85% + 30p for UK online card payments such as deposits, 3% + 30p for international cards, and 1.59% + 5p in the salon. KERSIVO charges 0% KERSIVO commission on bookings; Stripe processing fees apply.'},
 {question:'Does Timely include a website?',answer:'Timely lists a branded, customisable mini-website on its plans and can connect booking to sites such as Squarespace and Wix. Its pricing page does not say whether your own domain is included. Full KERSIVO includes a barbershop website and your own domain, set up for you; Starter uses a hosted booking page.'},
 {question:'Does KERSIVO charge per barber?',answer:'No. Full KERSIVO is £39/month per location with unlimited barbers in that location, subject to fair use. KERSIVO Starter is £0/month for up to four active bookable barbers at one location.'},
 {question:'Does KERSIVO take deposits like Timely?',answer:'Yes. Every public booking on KERSIVO Starter uses a £5 deposit towards the appointment or full payment online, paid into your own connected Stripe account. Full KERSIVO adds editable payment options, including Pay at shop.'},
 {question:'What Timely features does KERSIVO not have?',answer:'KERSIVO does not offer a waitlist, Reserve with Google, cancellation fees, rebooking reminders, staff targets, consultation forms, stock management or card terminals. If you rely on those, Timely may be the better fit. KERSIVO focuses on booking, deposits, your own website, reports and retail pickup for barbershops.'},
 {question:'Can I move my client list from Timely to KERSIVO?',answer:'Timely exports clients, appointments, services, client notes, products and product purchases when you ask its support team; it says requests can take up to 48 hours. KERSIVO reviews the files and helps migrate compatible data. Not every record or future appointment may transfer automatically.'},
 {question:'Can I keep Timely running while KERSIVO is set up?',answer:'Yes. Keep taking bookings on Timely while KERSIVO is prepared and checked. Switch your public booking links once you are happy, then give Timely the 14 days’ notice it asks for to cancel.'},
 {question:'Does Timely have a contract or a free trial?',answer:'Timely’s pricing page advertises a 14-day free trial, no contracts and 14 days’ notice to cancel. KERSIVO is billed monthly with no setup fee; you can cancel at any time and the service stays active until the end of the paid month.'},
 {question:'Can I try KERSIVO before I switch?',answer:'Yes. Explore the live demo of the booking journey and dashboard, ask for a free preview of your Full KERSIVO website, or start on the free Starter plan.'},
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
