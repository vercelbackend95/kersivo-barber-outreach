import { offer } from '@/content/offer';
import { STRIPE_FEES_NOTE } from '@/lib/pricing/claimsPolicy';
import { SAAS_MONTHLY_GBP } from './defaults';
import { KERSIVO_ENTITY_DESCRIPTION } from './kersivoEntityJsonLd';

/**
 * "In short" answer shown directly under the hero on /compare and every alternative page.
 * Written so an AI assistant can quote it word for word: what KERSIVO is, the price, the
 * commission with the Stripe qualifier in the same sentence pair, who it suits and who it does not.
 * Every fact comes from claimsPolicy / offer / the entity description, so it cannot drift.
 */
export const IN_SHORT_HEADING = 'In short';

export const IN_SHORT_PRICE = `Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location and includes a branded website on the shop’s own domain with online booking. KERSIVO Starter is £0/month for up to 4 bookable barbers. ${offer.fees.commission} on booking payments. ${STRIPE_FEES_NOTE}`;

export const IN_SHORT_NOT_FOR_LABEL = 'Who it does not suit';

/** Who KERSIVO does not suit, as a noun phrase (used on its own in /llms.txt and /about). */
export const KERSIVO_NOT_FOR =
  'shops that rely on a marketplace or a customer app to find new clients, and salons or spas that want one system for a wide range of beauty and wellness services.';

export const IN_SHORT_NOT_FOR = `KERSIVO is not the right fit for ${KERSIVO_NOT_FOR}`;

export type InShortAnswer = {
  heading: string;
  /** One paragraph: definition, price and commission, who it suits. */
  summary: string;
  notForLabel: string;
  notFor: string;
};

export function buildInShortAnswer(competitor?: string): InShortAnswer {
  const suits = competitor
    ? `As a ${competitor} alternative, it suits independent UK barbershops that want clients to book on the shop’s own website rather than through a marketplace, with one flat price per location instead of per-barber fees.`
    : 'It suits independent UK barbershops that want clients to book on the shop’s own website rather than through a marketplace, with one flat price per location instead of per-barber fees.';
  return {
    heading: IN_SHORT_HEADING,
    summary: `${KERSIVO_ENTITY_DESCRIPTION} ${IN_SHORT_PRICE} ${suits}`,
    notForLabel: IN_SHORT_NOT_FOR_LABEL,
    notFor: IN_SHORT_NOT_FOR,
  };
}
