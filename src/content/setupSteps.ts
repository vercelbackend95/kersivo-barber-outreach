/**
 * One four-step setup process for every marketing surface.
 * Preview-first copy is used while FREE_PREVIEW_FLOW_ENABLED is on;
 * subscribe-first copy is the flag-off fallback (same four stages).
 */
import { PREVIEW_TURNAROUND_TEXT_CAPITALISED } from '@/lib/freePreview/config';
import { offer } from '@/content/offer';

export type SetupStepOwner = 'You' | 'KERSIVO';

export type SetupStep = {
  title: string;
  body: string;
  owner: SetupStepOwner;
};

/** Preview-first journey (homepage, /free-preview, /barbershop-websites). */
export const FREE_PREVIEW_STEPS: readonly SetupStep[] = [
  {
    title: 'Request your free preview',
    body: 'Send your shop name and a link to your current booking page, Instagram, Google listing or website. No card, no call.',
    owner: 'You',
  },
  {
    title: 'We design your website',
    body: `We build a private preview individually for your shop — your services, barbers, photos and style. ${PREVIEW_TURNAROUND_TEXT_CAPITALISED}.`,
    owner: 'KERSIVO',
  },
  {
    title: 'Review it and ask for changes',
    body: 'Open your private link, try the booking flow and tell us what to change. One round of changes is included before you decide.',
    owner: 'You',
  },
  {
    title: 'Subscribe and launch',
    body: `Happy with it? Subscribe for ${offer.price.full} and we'll turn your preview into your live website, connect your domain and go live once you approve. Not for you? You owe nothing.`,
    owner: 'You',
  },
];

/** Subscribe-first journey when the free-preview flow is off. */
export const FULL_SETUP_STEPS: readonly SetupStep[] = [
  {
    title: 'Start your Full KERSIVO subscription',
    body: `Subscribe for ${offer.price.full} through Stripe. ${offer.fees.setup}. Your first payment is taken at checkout.`,
    owner: 'You',
  },
  {
    title: 'Tell us about your shop',
    body: 'Share your shop details, branding, team, services and opening hours. Missing a few photos? We can still get started.',
    owner: 'You',
  },
  {
    title: 'We prepare your KERSIVO setup',
    body: 'We configure your branded website, bookings, payments and domain. Keep taking bookings on your current system while we work.',
    owner: 'KERSIVO',
  },
  {
    title: 'Review, approve and launch',
    body: 'Check your private preview and confirm the details. Nothing goes live until you approve it.',
    owner: 'You',
  },
];

export function getSetupSteps(freePreview: boolean): readonly SetupStep[] {
  return freePreview ? FREE_PREVIEW_STEPS : FULL_SETUP_STEPS;
}
