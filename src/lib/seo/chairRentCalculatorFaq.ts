import { EMPLOYER_NATIONAL_INSURANCE, UK_RATES_TAX_YEAR } from '@/data/uk-rates-2026-27';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { CHAIR_RENT_CALCULATOR_PAGE_PATH } from './chairRentCalculatorPage';

export type ChairRentFaqItem = { question: string; answer: string };

const niRate = `${Math.round(EMPLOYER_NATIONAL_INSURANCE.rate * 100)}%`;
const niThreshold = `£${EMPLOYER_NATIONAL_INSURANCE.secondaryThresholdAnnualGbp.toLocaleString('en-GB')}`;

/** Visible FAQ and FAQPage schema share this list, so the answers always match. */
export const CHAIR_RENT_FAQ_ITEMS: readonly ChairRentFaqItem[] = [
  {
    question: 'Is chair rent or commission better for a barbershop?',
    answer:
      'It depends on how much the chair takes, the commission rate and rent you agree, and how much control you need over the rota, prices and standards. Busy chairs tend to favour commission; quiet ones favour a fixed rent. The calculator shows the break-even rent at which both leave the shop the same.',
  },
  {
    question: 'Does the minimum wage apply to barbers on commission?',
    answer:
      'Yes, for employees and workers. It is checked for each pay reference period (usually the month) by dividing the pay that counts by the hours that count, and tips don’t count towards it. Genuinely self-employed chair renters aren’t covered. Our article on commission pay and the minimum wage explains the rules.',
  },
  {
    question: 'How do I work out a fair chair rent?',
    answer:
      'Start from the break-even rent, which shows what the chair would leave the shop if you employed a barber on commission instead. Then consider what the renter needs to earn after their own costs. Turn on the barber’s side to see both views together.',
  },
  {
    question: 'Do I pay employer’s National Insurance on commission?',
    answer: `Yes. Commission is pay, so employer’s National Insurance applies to earnings above the secondary threshold: ${niRate} above ${niThreshold} a year in ${UK_RATES_TAX_YEAR}. Lower rates apply for employees under 21 and apprentices under 25, and Employment Allowance can reduce the bill if you are eligible.`,
  },
  {
    question: 'Is chair rent income subject to VAT?',
    answer:
      'It depends on whether your shop is VAT registered and on exactly what the arrangement includes. Check the VAT treatment of your chair rental with your accountant.',
  },
  {
    question: 'Is my data stored?',
    answer: 'No. Everything is worked out in your browser and nothing you enter is stored or sent. A share link only puts your inputs in the address after the # sign.',
  },
];

export function buildChairRentFaqJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${siteUrl}${CHAIR_RENT_CALCULATOR_PAGE_PATH}#faq`,
    mainEntity: CHAIR_RENT_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}
