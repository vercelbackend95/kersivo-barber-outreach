import { PREVIEW_TURNAROUND_TEXT_SHORT } from '@/lib/freePreview/config';
import { FREE_PREVIEW_NOT_A_TEMPLATE_CLAIM } from '@/lib/pricing/claimsPolicy';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { HOME_CHECKLIST_FAQ_ANSWER, HOME_CHECKLIST_FAQ_QUESTION } from '@/lib/seo/homeBookingChecklist';
import { KERSIVO_CONTACT_EMAIL } from '@/lib/seo/footerSocialLinks';
import { SAAS_EXPORT_RETENTION_DAYS } from '@/lib/setup/saasEntitlement';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

type LandingFaqItem = {
  question: string;
  answer: string;
};

export const BARBERSHOP_BOOKING_FAQ_ITEMS: LandingFaqItem[] = [
  {
    question: 'What is barbershop software?',
    answer:
      'Barbershop software helps a shop manage day-to-day tasks such as online bookings, appointment scheduling, barbers, services, clients, reminders and payments. KERSIVO Starter covers the core booking operation, while Full KERSIVO adds the branded website, own domain, Reports, Retail and wider business tools.',
  },
  {
    question: 'What should a barber booking system include?',
    answer:
      'A barber booking system should make it easy for clients to choose a service, barber and available time while giving the shop control over appointments, availability, client records, payments and reminders. KERSIVO also gives the shop an admin dashboard, with a hosted booking page on Starter and a complete own-domain customer experience on Full.',
  },
  {
    question: 'How much does KERSIVO cost?',
    answer: `KERSIVO Starter is £0/month for the core booking operation, with up to 4 active bookable barbers. Public Starter bookings require a connected Stripe account and are paid with a £5 deposit or in full. Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per physical location and adds your branded website, own domain and the wider business toolkit. There is no setup fee and KERSIVO takes 0% commission on booking payments on both plans. Standard Stripe processing fees apply to online card payments.`,
  },
  {
    question: 'Do you take commission on bookings or retail sales?',
    answer:
      'KERSIVO takes 0% commission on booking payments on Starter and Full KERSIVO, and 0% on retail sales processed through Full KERSIVO. Standard Stripe payment-processing fees still apply to online card payments.',
  },
  {
    question: `What is included in the £${SAAS_MONTHLY_GBP}/month Full KERSIVO plan?`,
    answer:
      'Full KERSIVO includes a branded barbershop website on your own domain, online booking, editable booking-payment controls including Pay at shop, £5 deposit or full payment, Advanced Clients, email confirmations, SMS appointment reminders, an admin dashboard, Retail pickup, Reports, hosting, SSL, maintenance and support.',
  },
  {
    question: 'Does KERSIVO charge more when I add more barbers?',
    answer: `Starter supports up to 4 active bookable barbers at £0/month. Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per physical location rather than per barber; additional barbers within that location are included subject to reasonable fair use.`,
  },
  {
    question: 'Is the website fully bespoke?',
    answer:
      'No. Full KERSIVO includes a professional website configured around your barbershop’s brand and content, but it is not a fully bespoke design project built from scratch. Unlimited redesigns and custom development are not included. KERSIVO Starter uses a hosted booking page rather than a full website.',
  },
  {
    question: 'Is my own domain included?',
    answer:
      'Yes, with Full KERSIVO. One standard domain is included for each physical location while Full is active. We can register a new standard domain or help connect an existing one. Premium or unusually expensive domains may require an additional charge. Starter uses a KERSIVO-hosted booking page.',
  },
  {
    question: 'How long does setup take?',
    answer:
      'Starter is self-serve: create the workspace, add your team, services and availability, then connect Stripe before public bookings go live. For Full KERSIVO, timing depends on the completeness of your materials and any migration work; you review a private preview before the Full website goes live.',
  },
  {
    question: 'What happens after I choose a KERSIVO plan?',
    answer:
      'With Starter, you configure the core booking workspace and connect Stripe to launch public bookings. With Full KERSIVO, you complete client onboarding and KERSIVO prepares the wider branded setup for review. Starter has no monthly software fee; Full billing begins when you subscribe.',
  },
  {
    question: 'Can you migrate me from Booksy, Fresha or another booking platform?',
    answer:
      'Full KERSIVO includes migration assistance for usable business data available from your current booking system, including supported CSV exports. The exact data that can be moved depends on what your current provider makes available and how complete the export is.',
  },
  {
    question: 'Will my clients need to download an app?',
    answer:
      'No. On Starter, clients book through your KERSIVO-hosted booking page in their browser. On Full KERSIVO, they book through your branded website and own domain. No customer app download is required.',
  },
  {
    question: 'What can I manage from the dashboard?',
    answer:
      'Starter includes bookings, team, services, availability, manual bookings, Clients Core and rolling 90-day booking history. Full KERSIVO adds the wider tools including Advanced Clients, full booking history, Reports, Retail, products and orders.',
  },
  {
    question: 'Can I cancel Full KERSIVO, and what happens afterwards?',
    answer:
      'Yes. Full remains active until the end of the paid billing period. You then explicitly choose whether to continue on KERSIVO Starter or leave KERSIVO. If you continue on Starter, the Starter workspace and eligible data remain active while Full-only features and the Full website/domain experience end. If you leave completely, the departure, export and retention rules in the Terms apply.',
  },
  {
    question: 'Do I need to be technical to use KERSIVO?',
    answer:
      'No. Starter guides you through the core setup and Stripe connection from the dashboard. With Full KERSIVO, KERSIVO also handles the standard website, hosting, SSL and domain setup. Day-to-day bookings, barbers, services, prices, working hours and clients are managed from the admin dashboard.',
  },
];

/**
 * Homepage FAQ. Question 1 is renamed from the brief's "How much does KERSIVO cost?"
 * because `/pricing` already uses that question verbatim.
 * The contact answer adds the claims-policy line that the one-business-day figure is a response target.
 */
export const HOMEPAGE_FAQ_ITEMS: LandingFaqItem[] = [
  {
    question: 'How much does Full KERSIVO cost a shop?',
    answer: `Full KERSIVO is £${SAAS_MONTHLY_GBP} a month per physical location and includes your branded website, your own domain and every barber at that location, subject to fair use. There's no setup fee, no VAT added and no KERSIVO commission. Stripe charges its standard processing fees on online payments. If you only need online bookings for up to 4 barbers, KERSIVO Starter is £0 a month.`,
  },
  {
    question: 'When do I pay, and how long until my website is live?',
    answer: `Your first £${SAAS_MONTHLY_GBP} payment is taken when you subscribe, then monthly on the same day. Your website is typically ready in a few days once we receive all the required information — that's an estimate, not a guaranteed date. You review a private preview, and nothing goes live until you approve it.`,
  },
  {
    question: 'Can I choose how clients pay when they book?',
    answer: `Yes. On Full KERSIVO you choose Pay at shop, a required £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or full payment upfront. Online payments go through your own connected Stripe account.`,
  },
  {
    question: 'Who pays the Stripe fees?',
    answer: 'Your shop does, through its own connected Stripe account, at the rates on your Stripe agreement. KERSIVO adds no commission on top.',
  },
  {
    question: HOME_CHECKLIST_FAQ_QUESTION,
    answer: HOME_CHECKLIST_FAQ_ANSWER,
  },
  {
    question: 'Can I switch from Booksy, Fresha or Treatwell without losing bookings?',
    answer:
      "Yes. Keep taking bookings on your current system while we set up KERSIVO. We help migrate the usable business data available from your current system, including supported CSV exports — what can be moved depends on what your current provider lets you export. You switch your booking links once you've approved the preview.",
  },
  {
    question: 'Is the website custom-designed?',
    answer:
      'It\'s a professional website configured around your shop\'s brand, photos and team — not an unlimited bespoke build. Reasonable small website updates are included; redesigns and custom features aren\'t. Your site carries a subtle "Powered by KERSIVO" mark.',
  },
  {
    question: 'Do I keep my domain?',
    answer:
      'Yes. Your business owns its domain. One standard domain is included while Full KERSIVO is active, or we connect the one you already have. If you leave, the domain can be transferred or pointed elsewhere; the KERSIVO platform and code stay with KERSIVO.',
  },
  {
    question: 'Do my clients need an app?',
    answer:
      "No. Clients book in their browser on your website. There's nothing to download and no account to create.",
  },
  {
    question: 'Can I cancel?',
    answer: `Yes, anytime. Full KERSIVO stays active until the end of the paid month. You then choose to continue on KERSIVO Starter or leave. If you leave completely, a free CSV export of client contact details and booking history is available for ${SAAS_EXPORT_RETENTION_DAYS} days, and Full KERSIVO owners can also download it once from the dashboard settings.`,
  },
  {
    question: 'How do I contact KERSIVO?',
    answer: `Email ${KERSIVO_CONTACT_EMAIL}, or use the form below. Full KERSIVO subscribers have a first-response target of one business day. This is a response target, not a guaranteed resolution time.`,
  },
];

/** Homepage FAQ answers that change while FREE_PREVIEW_FLOW_ENABLED is on (docs/free-preview-spec.md §10.3). */
const HOMEPAGE_FREE_PREVIEW_ANSWERS: Readonly<Record<string, string>> = {
  'When do I pay, and how long until my website is live?': `You don't pay anything for your preview, which we usually send ${PREVIEW_TURNAROUND_TEXT_SHORT}. If you decide to launch, your first £${SAAS_MONTHLY_GBP} payment is taken when you subscribe, then monthly on the same day. We then connect your domain and payments — typically within a few days of receiving everything we need, which is an estimate, not a guaranteed date — and nothing goes live until you approve it.`,
  'Is the website custom-designed?': FREE_PREVIEW_NOT_A_TEMPLATE_CLAIM,
};

/** Visible homepage FAQ and its FAQPage JSON-LD; with the flag off this is HOMEPAGE_FAQ_ITEMS unchanged. */
export function getHomepageFaqItems(freePreview = false): LandingFaqItem[] {
  if (!freePreview) return HOMEPAGE_FAQ_ITEMS;
  return HOMEPAGE_FAQ_ITEMS.map((item) => {
    const answer = HOMEPAGE_FREE_PREVIEW_ANSWERS[item.question];
    return answer ? { ...item, answer } : item;
  });
}

/**
 * FAQ for /barbershop-online-booking: the questions owners search for, answered in two to four
 * sentences each so the visible answer and the FAQPage JSON-LD can be quoted as they are.
 */
export const ONLINE_BOOKING_FAQ_ITEMS: LandingFaqItem[] = [
  {
    question: 'What is barbershop online booking?',
    answer:
      'Barbershop online booking lets clients book an appointment themselves, at any time, from a link on your website, Google Business Profile or social media. They choose a service, a barber and a free time, and the appointment goes straight into the shop diary without a phone call or message.',
  },
  {
    question: 'How does online booking work for a barbershop?',
    answer: `The client picks a service, a barber and a start time that is free in that barber's diary, enters their name and email, and pays a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or the full price if your shop asks for it. They get a confirmation email, and the booking appears as Booked on the barber's timeline so the time is no longer offered to anyone else.`,
  },
  {
    question: 'Do my clients need to download an app?',
    answer:
      'No. Clients book in the browser on a phone, tablet or computer. There is nothing to download and no account to create.',
  },
  {
    question: 'Can clients choose their barber?',
    answer: `Yes. Clients choose a barber who offers the selected service and has a free appointment. KERSIVO Starter supports up to 4 active bookable barbers; Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location rather than per barber, subject to fair use.`,
  },
  {
    question: 'How are the available times worked out?',
    answer:
      "From each barber's working hours, breaks and time off, the length of the chosen service and the appointments already in the diary. A start time is only offered when the whole service fits before the next appointment and before closing.",
  },
  {
    question: 'Can I take deposits for barber appointments online?',
    answer: `Yes. On Full KERSIVO you choose Pay at shop, a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or payment in full. On KERSIVO Starter every public booking is paid online, with the client choosing a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or the full price. Payments go through your own connected Stripe account and a deposit counts towards the service price.`,
  },
  {
    question: 'Does KERSIVO take commission on bookings?',
    answer:
      'No. KERSIVO takes 0% commission on booking payments on both Starter and Full KERSIVO. Standard Stripe payment-processing fees apply to online card payments.',
  },
  {
    question: 'Can clients book from Google, Instagram or TikTok?',
    answer:
      'Yes, through your booking link. You can add it to your Google Business Profile with guided setup, paste it into your Instagram or TikTok bio, or print it as a QR code. The Google setup is a booking link, not a native Google booking integration.',
  },
  {
    question: 'Do clients get booking confirmations and reminders?',
    answer:
      'Yes. Clients get a confirmation email and an automatic email reminder on both plans. Full KERSIVO adds SMS appointment reminders within a monthly allowance.',
  },
  {
    question: 'Can clients cancel or change a booking online?',
    answer:
      "Clients can request a change or cancellation through the links in their confirmation email. Requests follow your shop's booking, cancellation and payment policy; free changes and refunds are not automatic.",
  },
  {
    question: 'What is the difference between KERSIVO Starter and Full KERSIVO for online booking?',
    answer: `Starter is £0/month for up to 4 barbers, with a KERSIVO-hosted booking page and an online payment on every public booking. Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location and adds your own branded website and domain, Pay at shop as an option, SMS reminders within a monthly allowance, Reports, Retail and full booking history.`,
  },
  BARBERSHOP_BOOKING_FAQ_ITEMS[10],
  BARBERSHOP_BOOKING_FAQ_ITEMS[12],
  BARBERSHOP_BOOKING_FAQ_ITEMS[13],
  {
    question: 'Does KERSIVO replace my card reader?',
    answer:
      "No. KERSIVO isn't a till or card-reader system. Any balance after a deposit is paid in the shop the way you take payments today.",
  },
  BARBERSHOP_BOOKING_FAQ_ITEMS[14],
];

export function buildOnlineBookingFaqJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${siteUrl}/barbershop-online-booking#faq`,
    mainEntity: ONLINE_BOOKING_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function buildBarbershopBookingFaqJsonLd(freePreview = false): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${siteUrl}/#faq`,
    mainEntity: getHomepageFaqItems(freePreview).map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
