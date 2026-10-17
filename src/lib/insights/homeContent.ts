/**
 * KERSIVO Insights homepage discovery catalogue.
 *
 * Editorial articles are added only once they have been approved and published
 * in the Notion Editorial Pipeline. Supplementary KERSIVO guides/tools are
 * explicitly labelled, never represented as Notion-published articles.
 */
import { INSIGHTS_GOOGLE_REVIEWS } from '@/lib/seo/insights';
import { BARBERSHOP_WEBSITE_DESIGN_PAGE_H1, BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH } from '@/lib/seo/barbershopWebsiteDesignPage';
import { BARBERSHOP_ONLINE_BOOKING_PAGE_H1, BARBERSHOP_ONLINE_BOOKING_PAGE_PATH } from '@/lib/seo/barbershopOnlineBookingPage';
import { BARBER_COST_CALCULATOR_PAGE_PATH } from '@/lib/seo/barberCostCalculatorPage';
import { ALTERNATIVES_HUB_PAGE_PATH } from '@/lib/seo/alternativesHubSeo';

export const INSIGHTS_HOME_TOPICS = [
  {
    id: 'business',
    name: 'Business & Revenue',
    iconPath: 'M3 21h18M5 21V9l7-6 7 6v12M9 13h6M9 17h6',
  },
  {
    id: 'bookings',
    name: 'Bookings & Clients',
    iconPath: 'M7 3v4M17 3v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 15l2 2 5-5',
  },
  {
    id: 'brand',
    name: 'Brand & Marketing',
    iconPath: 'm12 3 2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3ZM19 18l.9 1.9L22 21l-2.1 1.1L19 24l-.9-1.9L16 21l2.1-1.1L19 18Z',
  },
  {
    id: 'software',
    name: 'Software & Costs',
    iconPath: 'M4 5h16v14H4zM4 10h16M9 15h3M15 15h1',
  },
  {
    id: 'industry',
    name: 'Industry & People',
    iconPath: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  },
] as const;

export type InsightsHomeTopic = (typeof INSIGHTS_HOME_TOPICS)[number]['id'];

type DiscoveryCard = {
  title: string;
  href: string;
  description: string;
  type: 'article' | 'guide' | 'tool';
  typeLabel: string;
  categories: readonly InsightsHomeTopic[];
  artwork: 'photo' | 'design' | 'booking' | 'costs' | 'compare';
  image?: string;
  imageAlt?: string;
};

/** The first item is the ONLY published Insights editorial story. */
export const INSIGHTS_HOME_READING: readonly DiscoveryCard[] = [
  {
    title: INSIGHTS_GOOGLE_REVIEWS.headline,
    href: INSIGHTS_GOOGLE_REVIEWS.path,
    description: INSIGHTS_GOOGLE_REVIEWS.lead,
    type: 'article',
    typeLabel: 'KERSIVO INSIGHTS / ARTICLE',
    categories: ['brand'],
    artwork: 'photo',
    image: INSIGHTS_GOOGLE_REVIEWS.heroImage,
    imageAlt: 'British barbershop interior with barbers and clients',
  },
  {
    title: BARBERSHOP_WEBSITE_DESIGN_PAGE_H1,
    href: BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH,
    description: 'The role of identity, photography and mobile design in a barbershop website.',
    type: 'guide',
    typeLabel: 'KERSIVO / PRACTICAL GUIDE',
    categories: ['brand'],
    artwork: 'design',
  },
  {
    title: BARBERSHOP_ONLINE_BOOKING_PAGE_H1,
    href: BARBERSHOP_ONLINE_BOOKING_PAGE_PATH,
    description: 'From choosing a barber to confirming a time: explore the client booking journey.',
    type: 'guide',
    typeLabel: 'KERSIVO / PRACTICAL GUIDE',
    categories: ['bookings'],
    artwork: 'booking',
  },
  {
    title: 'What Is Your Booking Software Really Costing?',
    href: BARBER_COST_CALCULATOR_PAGE_PATH,
    description: 'Use the live calculator to explore subscriptions, fees and different team sizes.',
    type: 'tool',
    typeLabel: 'KERSIVO / INTERACTIVE TOOL',
    categories: ['business', 'software'],
    artwork: 'costs',
  },
  {
    title: 'Compare Booking Systems for Your Barbershop',
    href: ALTERNATIVES_HUB_PAGE_PATH,
    description: 'Review the options side by side before deciding what suits your shop.',
    type: 'tool',
    typeLabel: 'KERSIVO / COMPARISON TOOL',
    categories: ['software', 'business'],
    artwork: 'compare',
  },
];
