import { offer } from '@/content/offer';
import { FREE_PREVIEW_PAGE_PATH } from '@/lib/freePreview/config';
import { KERSIVO_COMMISSION_WITH_STRIPE } from '@/lib/pricing/claimsPolicy';
import { KERSIVO_BOOKING_DEPOSIT_GBP } from '@/lib/seo/defaults';

/**
 * Homepage buyer checklist (docs/seo/content-plan-buying-searches.md, piece 6).
 * The home page owns "barber booking system uk"; this section deepens it for
 * "barber booking system uk checklist" and "how to choose barber booking software".
 *
 * The checklist itself is neutral: no platform names and no competitor figures.
 * KERSIVO wording in the answer comes from claimsPolicy / offer only.
 */
export const HOME_CHECKLIST_SECTION_ID = 'booking-system-checklist';

export const HOME_CHECKLIST_HEADING = 'What to check before you choose a barber booking system';

export const HOME_CHECKLIST_LEAD =
  'Eight questions to ask any UK barber booking system before you sign up, and why each one matters to your shop.';

export type HomeChecklistItem = {
  /** The thing to check, phrased as the question an owner asks a provider. */
  check: string;
  /** One sentence on why it matters. */
  why: string;
};

export const HOME_CHECKLIST_ITEMS: readonly HomeChecklistItem[] = [
  {
    check: 'Do you pay a fee for new clients from a marketplace?',
    why: 'A fee on a new client’s first booking comes straight out of that cut, so check when it applies and who counts as new.',
  },
  {
    check: 'What are the card fees, and who pays them?',
    why: 'Card processing is charged on every online payment, so know the rate and whether it comes off your takings or is added to the client’s bill.',
  },
  {
    check: 'Is the price per barber or per shop?',
    why: 'With per-barber pricing your software bill goes up every time you fill another chair.',
  },
  {
    check: 'Who owns the client list, and can you export it?',
    why: 'If you cannot take names, numbers and booking history with you, changing systems later means rebuilding your client list.',
  },
  {
    check: 'Can you take deposits and set your own no-show policy?',
    why: 'A deposit or a clear cancellation rule is what protects a barber’s time when a client does not turn up.',
  },
  {
    check: 'Do clients book on your own website and domain, or on a platform profile?',
    why: 'Your own domain shows clients only your shop, while a platform profile can sit beside other shops in the same app.',
  },
  {
    check: 'Do clients have to install an app or create an account?',
    why: 'Every extra step before a booking is a chance for a new client to give up and go elsewhere.',
  },
  {
    check: 'What is the contract length and notice period?',
    why: 'A minimum term or a long notice period keeps you paying after you have decided to leave, so read it before you sign.',
  },
];

export const HOME_CHECKLIST_ANSWER_LABEL = 'How Full KERSIVO answers them';

/** KERSIVO's own answers to the eight checks. Approved wording only. */
export const HOME_CHECKLIST_ANSWER = `${offer.plans.full} is ${offer.price.full} ${offer.price.fullQualifier}, not per barber. ${KERSIVO_COMMISSION_WITH_STRIPE} Clients book on your own website and domain with no app download, and you choose Pay at shop, a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or full payment upfront. You can cancel anytime, with a free CSV export of client contact details and booking history.`;

/** The only links out of the section (plan: /compare, /pricing#plan, /free-preview). */
export const HOME_CHECKLIST_LINKS = {
  compare: { href: '/compare', label: 'Compare UK barber booking systems side by side' },
  pricing: { href: '/pricing#plan', label: 'See Full KERSIVO pricing' },
  preview: { href: FREE_PREVIEW_PAGE_PATH, label: offer.cta.primary },
} as const;

/** Homepage FAQ entry that summarises the checklist (also in the FAQPage JSON-LD). */
export const HOME_CHECKLIST_FAQ_QUESTION = 'How do I choose a barber booking system in the UK?';

export const HOME_CHECKLIST_FAQ_ANSWER =
  'Check eight things before you sign up: whether you pay a fee for new clients from a marketplace, what the card fees are and who pays them, whether the price is per barber or per shop, who owns the client list and whether you can export it, how deposits and no-shows are handled, whether clients book on your own website and domain or on a platform profile, whether they need an app, and the contract length and notice period.';
