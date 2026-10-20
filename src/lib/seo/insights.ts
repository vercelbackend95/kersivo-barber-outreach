/**
 * Public KERSIVO Insights editorial registry.
 * Only owner-approved, actually published articles may be added here.
 * Notion remains authoritative for source copy; this file holds website metadata.
 */
import {
  getInsightsCategory,
  getInsightsCategoryName,
  getIndexableInsightsCategorySitemapEntries,
  type InsightsCategoryId,
} from '@/lib/insights/categories';
import { buildAbsoluteUrl } from './meta';

export const INSIGHTS_INDEX_PATH = '/insights';
export const INSIGHTS_INDEX_TITLE = 'Barbershop Business Insights & Guides UK | KERSIVO';
export const INSIGHTS_INDEX_DESCRIPTION =
  'Practical insights for independent UK barbershop owners: bookings, clients, business costs, branding and running a stronger shop.';

export const INSIGHTS_GOOGLE_REVIEWS = {
  slug: 'google-reviews-barbershop-uk-rules',
  path: '/insights/google-reviews-barbershop-uk-rules',
  headline: 'Google Reviews for Barbershops: Two Rulebooks, One Habit',
  seoTitle: "Google Reviews for Barbershops: What's Allowed in the UK",
  description:
    "How UK barbershops can get more Google reviews without breaking the DMCC Act or Google's stricter rules on incentives, review gating and staff targets.",
  categoryId: 'brand-marketing' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda8171bef0d462be52901f',
  lead:
    "What UK consumer law and Google's review policies actually mean for a barbershop asking clients for feedback.",
  heroImage:
    'https://images.unsplash.com/photo-1768678218016-6bed23a35116?auto=format&fit=crop&fm=jpg&q=75&w=1600',
  ogImage: '/images/insights/og/google-reviews-barbershop-uk-rules-1200x630.jpg',
  ogImageAlt: 'Barbers working in a barbershop in Aldershot, UK',
} as const;

export const INSIGHTS_LOCAL_CLIENTS = {
  slug: 'get-more-barbershop-clients-locally-uk',
  path: '/insights/get-more-barbershop-clients-locally-uk',
  headline: 'How to Get More Barbershop Clients Locally: Price the Channel Before You Pick It',
  seoTitle: 'How to Get More Barbershop Clients Locally (UK Guide)',
  description:
    'Judge every marketing channel by what a returning client costs. Referrals, lapsed clients, Google and leaflets, with the UK rules on texts and flyers.',
  categoryId: 'clients-growth' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda8163947eef1b68eb6b58',
  lead: 'Compare the real cost of a second-visit client across referrals, Google, local partnerships and promotional channels.',
  heroImage:
    'https://images.unsplash.com/photo-1781455793310-8427c96454c7?auto=format&fit=crop&fm=jpg&q=75&w=1600',
  ogImage: '/images/insights/og/get-more-barbershop-clients-locally-uk-1200x630.jpg',
  ogImageAlt: 'Empty barbershop with vintage leather barber chairs and mirrors',
} as const;

export const INSIGHTS_CARD_FEES = {
  slug: 'barbershop-card-payment-fees-uk',
  path: '/insights/barbershop-card-payment-fees-uk',
  headline: "The 20p You Don't Notice: How Card Fees Really Work for a Barbershop",
  seoTitle: 'Barbershop Card Fees: What You Really Pay per Payment',
  description:
    "Card fees cost a barbershop more than the headline rate suggests. How fixed fees, card mix and split payments add up, and why you can't surcharge.",
  categoryId: 'tools-payments' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda8170b7f1d8101223b50e',
  lead: 'Understand fixed fees, split payments and your blended processing rate before accepting a headline percentage.',
  heroImage: '/images/insights/card-fees/card-fees-hero.svg',
  ogImage: '/images/insights/og/barbershop-card-payment-fees-uk-1200x630.png',
  ogImageAlt: 'Original KERSIVO Insights illustration of a 20p fixed card-processing fee',
} as const;

export const INSIGHTS_GIFT_VOUCHERS = {
  slug: 'barbershop-gift-vouchers-uk',
  path: '/insights/barbershop-gift-vouchers-uk',
  headline: 'Barbershop Gift Vouchers: Cash in December, a Haircut You Owe in March',
  seoTitle: 'Barbershop Gift Vouchers: Expiry Rules, VAT and Real Value',
  description:
    'Gift vouchers bring cash in December but you still owe the haircut. UK expiry rules, VAT on single-purpose vouchers, and how to tell if they make money.',
  categoryId: 'business-profit' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda817c8479e203928f3cba',
  lead: 'Cash in today is not always earned revenue. Understand the true cost of gift vouchers, UK expiry terms and VAT rules.',
  heroImage: '/images/insights/gift-vouchers/voucher-hero.svg',
  ogImage: '/images/insights/og/barbershop-gift-vouchers-uk-1200x630.png',
  ogImageAlt: 'Original KERSIVO editorial artwork of a fictional gift voucher',
} as const;

export const INSIGHTS_DECEMBER_HOURS = {
  slug: 'barbershop-christmas-opening-hours-planning',
  path: '/insights/barbershop-christmas-opening-hours-planning',
  headline: "The Extra Hour Test: Planning a Barbershop's December Without Fooling Yourself",
  seoTitle: 'Barbershop Christmas Opening Hours: Do Late Nights Pay?',
  description: 'Should your barbershop open late in December? A simple extra-hour test, 2026 bank holiday dates, staff rules, and how to fill January before it arrives.',
  categoryId: 'bookings-operations' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda81e9ae9eeadf5007f087',
  lead: 'Use break-even maths to decide whether longer December opening hours actually add revenue — and plan for January before it comes.',
  heroImage: 'https://images.unsplash.com/photo-1672257493626-038f96997ade?auto=format&fit=crop&q=78&w=2400',
  ogImage: 'https://images.unsplash.com/photo-1672257493626-038f96997ade?auto=format&fit=crop&q=78&w=1200&h=630',
  ogImageAlt: 'Empty vintage barbershop with chairs, mirrors and brick walls',
} as const;

export const INSIGHTS_HAIRCUT_PRICING = {
  slug: 'how-to-price-haircut-uk-barber',
  path: '/insights/how-to-price-haircut-uk-barber',
  headline: 'How to Price a Haircut in the UK: A Floor, a Ceiling and the Price List In Between',
  seoTitle: "How to Price a Haircut in the UK: A Barber's Method",
  description: 'Set haircut prices from your real cost per minute and the local range, test a price rise with break-even maths, and show prices the way UK law expects.',
  categoryId: 'business-profit' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda817688dee88a79cd9d00',
  lead: 'Find the cost-recovery floor, compare your local market, then test the numbers before you raise haircut prices.',
  heroImage: 'https://images.unsplash.com/photo-1769034260387-39fa07f0c0fa?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000',
  ogImage: 'https://images.unsplash.com/photo-1769034260387-39fa07f0c0fa?auto=format&fit=crop&fm=jpg&q=78&w=1200&h=630',
  ogImageAlt: 'Vintage barber chairs and mirrors in a classic barbershop',
} as const;

export const INSIGHTS_BARBERS_HANDS = {
  slug: 'barber-dermatitis-skin-care-hse',
  path: '/insights/barber-dermatitis-skin-care-hse',
  headline: "Barbers' Hands: The Skin Problem That Builds Slowly and Costs Quietly",
  seoTitle: "Dermatitis in Barbers: How to Protect Your Team's Hands",
  description: "Wet work, disinfectants and constant hand washing can damage barbers' skin. What HSE advises, employer duties, and a five-minute audit for your shop.",
  categoryId: 'industry-people' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda8188a0dcc982ec96541a',
  lead: "How UK barbers can protect their hands from work-related skin damage, and what responsible shops should put in place.",
  heroImage: 'https://images.unsplash.com/photo-1761931403671-d020a14928d9?auto=format&fit=crop&fm=jpg&ixid=NHwxMjA3fDA%3D&ixlib=rb-4.1.0&q=75&w=2400',
  ogImage: 'https://images.unsplash.com/photo-1761931403671-d020a14928d9?auto=format&fit=crop&fm=jpg&q=75&w=1200&h=630',
  ogImageAlt: "A barber's hands working with scissors and a comb",
} as const;

export const INSIGHTS_SECOND_VISIT = {
  slug: 'barbershop-client-retention-second-visit',
  path: '/insights/barbershop-client-retention-second-visit',
  headline: "The Second Visit: Why a Barbershop's Growth Is Decided After the First Haircut",
  seoTitle: 'Barbershop Client Retention: Why the Second Visit Matters',
  description: 'A barbershop grows when first-time clients come back. Three numbers to track, simple ways to lift rebooking, and the UK rules on reminder messages.',
  categoryId: 'clients-growth' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda8171a198c0ca613b14e0',
  lead: 'Learn to measure first-to-second visit retention, improve rebooking habits and distinguish service reminders from marketing texts.',
  heroImage: 'https://images.unsplash.com/photo-1772657850401-a15d99f505d4?auto=format&fit=crop&fm=jpg&q=75&w=2400',
  ogImage: 'https://images.unsplash.com/photo-1772657850401-a15d99f505d4?auto=format&fit=crop&fm=jpg&q=75&w=1200&h=630',
  ogImageAlt: 'Vintage barbershop chairs in Camberley, United Kingdom',
} as const;

export const INSIGHTS_MTD_BARBERS = {
  slug: 'making-tax-digital-barbers',
  path: '/insights/making-tax-digital-barbers',
  headline: 'Making Tax Digital for Barbers: What Changes When Your Takings Pass £30,000',
  seoTitle: 'Making Tax Digital for Barbers: The £30,000 Test Explained',
  description:
    'Making Tax Digital for Income Tax reaches self-employed barbers above £30,000 of takings from April 2027. Who is in scope, what to record, and the deadlines.',
  categoryId: 'tools-payments' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-19',
  verifiedDate: '2026-10-19',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda81b8a4d7eda56e2680c5',
  lead: 'Making Tax Digital for Income Tax uses gross qualifying income, not the profit a chair renter takes home. Check the £30,000 test and the 2027 deadlines.',
  heroImage:
    'https://images.unsplash.com/photo-1739302493888-6f96cbc37105?auto=format&fit=crop&fm=jpg&q=80&w=2400',
  ogImage:
    'https://images.unsplash.com/photo-1739302493888-6f96cbc37105?auto=format&fit=crop&fm=jpg&q=80&w=1200&h=630',
  ogImageAlt: "A barber cutting a client's hair under colourful lights in a Liverpool barbershop, photographed by Mitchell Orr",
} as const;

export const INSIGHTS_OWNER_EARNINGS = {
  slug: 'how-much-do-barbershop-owners-make-uk',
  path: '/insights/how-much-do-barbershop-owners-make-uk',
  headline: 'What Does a UK Barbershop Owner Actually Earn? A Model Profit and Loss, Chair by Chair',
  seoTitle: 'How Much Do Barbershop Owners Make in the UK? A Model P&L',
  description:
    'A transparent UK model of what barbershop owners earn at two, four and six chairs, and the three cost lines that decide whether the shop pays its owner.',
  categoryId: 'business-profit' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-19',
  verifiedDate: '2026-10-19',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda8181b1ffc7d5f1063a5d',
  lead: 'Two hypothetical four-chair UK barbershops make £180,000 in annual sales yet deliver very different owner cash after costs, taxes and debt.',
  heroImage:
    'https://images.pexels.com/photos/9703068/pexels-photo-9703068.jpeg?auto=compress&cs=tinysrgb&w=2400',
  ogImage:
    'https://images.pexels.com/photos/9703068/pexels-photo-9703068.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop',
  ogImageAlt: 'A red barber chair photographed in London by Jennifer Latham',
} as const;

export const INSIGHTS_UNFAIR_DISMISSAL = {
  slug: 'unfair-dismissal-six-months-barbershop-employers',
  path: '/insights/unfair-dismissal-six-months-barbershop-employers',
  headline: 'Six Months, Not Two Years: How the 2027 Unfair Dismissal Change Affects Barbershops That Employ Staff',
  seoTitle: 'Unfair Dismissal After 6 Months: What Barbershops Must Know',
  description:
    'From 1 January 2027, employees can claim unfair dismissal after six months, not two years. What it means for barbershop hiring, probation and records.',
  categoryId: 'industry-people' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-19',
  verifiedDate: '2026-10-19',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda8192882de0d7f653e7dc',
  lead: 'The 2027 change to six months of qualifying service brings dismissal-process and probation decisions forward for employers of small barbershop teams.',
  heroImage:
    'https://images.pexels.com/photos/35903164/pexels-photo-35903164.jpeg?auto=compress&cs=tinysrgb&w=2400',
  ogImage:
    'https://images.pexels.com/photos/35903164/pexels-photo-35903164.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop',
  ogImageAlt: 'Traditional barbershop sign in Abergele, Wales, photographed by Lisa from Pexels',
} as const;

export const INSIGHTS_APPRENTICE_BARBER = {
  slug: 'apprentice-barber-funding-costs-2026',
  path: '/insights/apprentice-barber-funding-costs-2026',
  headline: 'Is an Apprentice Barber Worth It? The 2026 Numbers for Small Shops in England',
  seoTitle: 'Apprentice Barber Costs and Funding in 2026: Is It Worth It?',
  description:
    'Training is fully funded and hiring payments are up to £2,000, but supervision time is the real cost. A 2026 guide for barbershops in England.',
  categoryId: 'industry-people' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-19',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda81419acde7a0f6e58dcf',
  lead: 'Weigh funding, wages and lost senior chair time before hiring an apprentice barber in a small England shop.',
  heroImage:
    'https://images.unsplash.com/photo-1640301133857-c4bc5789c1bb?auto=format&fit=crop&fm=jpg&q=78&w=2400',
  ogImage:
    'https://images.unsplash.com/photo-1640301133857-c4bc5789c1bb?auto=format&fit=crop&fm=jpg&q=78&w=1200&h=630',
  ogImageAlt: 'Barber and client in Liverpool, England, photographed by Mitchell Orr',
} as const;

export const INSIGHTS_BUSINESS_RATES = {
  slug: 'barbershop-business-rates-2026-england',
  path: '/insights/barbershop-business-rates-2026-england',
  headline: 'Lower Rates, Higher Bill? What the 2026 Business Rates Changes Mean for Barbershops in England',
  seoTitle: 'Barbershop Business Rates 2026: Three Checks for Owners',
  description:
    'The 2026 business rates changes cut the multiplier for barbershops in England, yet some bills rose. What changed, why, and three checks worth making.',
  categoryId: 'business-profit' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-19',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda81a89758c88641f937c9',
  lead: 'Why a lower business rates multiplier may still mean a bigger bill for an England barbershop, plus three practical checks owners can make.',
  heroImage:
    'https://images.pexels.com/photos/20692738/pexels-photo-20692738.jpeg?auto=compress&cs=tinysrgb&w=2400',
  ogImage:
    'https://images.pexels.com/photos/20692738/pexels-photo-20692738.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop',
  ogImageAlt: 'Barbershop on Liverpool Penny Lane, England, photographed by Phil Evenden',
} as const;

export const INSIGHTS_LOYALTY_SCHEMES = {
  slug: 'barbershop-loyalty-scheme-uk',
  path: '/insights/barbershop-loyalty-scheme-uk',
  headline: 'Barbershop Loyalty Schemes: Who Are You Rewarding, and What Does It Buy?',
  seoTitle: 'Barbershop Loyalty Schemes: Do Stamp Cards Pay? (UK)',
  description:
    "A free tenth cut costs about 10% of a regular's spend. How to work out whether a barbershop loyalty scheme pays, the UK rules on 'free', and a better design.",
  categoryId: 'clients-growth' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-18',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda81cd91c8ef0c600aa094',
  lead: 'Why a free tenth cut may cost more than it earns, and a way to test whether the loyalty scheme changes real repeat-visit behaviour.',
  heroImage:
    'https://images.unsplash.com/photo-1640301133543-41fe25ad6450?auto=format&fit=crop&fm=jpg&q=80&w=2200',
  ogImage:
    'https://images.unsplash.com/photo-1640301133543-41fe25ad6450?auto=format&fit=crop&fm=jpg&q=78&w=1200&h=630',
  ogImageAlt: 'Barber cutting hair in Liverpool, England, photographed by Mitchell Orr',
} as const;

export const INSIGHTS_BUSY_DIARY = {
  slug: 'busy-barbershop-low-profit-chair-hour',
  path: '/insights/busy-barbershop-low-profit-chair-hour',
  headline: "Your Diary Is Full. So Why Isn't Your Barbershop Making More Money?",
  seoTitle: 'Busy Barbershop, Low Profit? Measure Earnings per Chair-Hour',
  description:
    "A full diary isn't the same as a profitable one. How UK barbershop owners can work out what each chair-hour earns, by service, and what to change.",
  categoryId: 'business-profit' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-18',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda812092c2c2eed8ea914d',
  lead: 'Why a full appointment diary can hide low contribution per chair-hour, and how service mix and unsold minutes change the result.',
  heroImage:
    'https://images.unsplash.com/photo-1786057424913-6954b0f424af?auto=format&fit=crop&fm=jpg&q=78&w=2200',
  ogImage:
    'https://images.unsplash.com/photo-1786057424913-6954b0f424af?auto=format&fit=crop&fm=jpg&q=75&w=1200&h=630',
  ogImageAlt: 'An Edinburgh barbershop worker cleaning the floor, photographed by Bruno BD',
} as const;

export const INSIGHTS_WALK_INS = {
  slug: 'barbershop-walk-ins-vs-appointments',
  path: '/insights/barbershop-walk-ins-vs-appointments',
  headline: 'Walk-Ins or Appointments? What the Queue Is Telling a Barbershop Owner',
  seoTitle: "Walk-Ins or Appointments? A Barbershop Owner's Guide",
  description:
    'Why barbershop waiting times grow so fast as the shop gets busy, what walk-aways and empty slots really cost, and how to choose walk-ins, bookings or both.',
  categoryId: 'bookings-operations' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-18',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda812e94a2f3175f1f1da4',
  lead: 'When a barbershop gets busier, queues and lost capacity do not rise evenly. Compare walk-ins, appointments and hybrid with a two-week owner audit.',
  heroImage:
    'https://images.unsplash.com/photo-1578853283498-cc994096481b?auto=format&fit=crop&fm=jpg&q=78&w=2200',
  ogImage:
    'https://images.unsplash.com/photo-1578853283498-cc994096481b?auto=format&fit=crop&fm=jpg&q=75&w=1200&h=630',
  ogImageAlt: 'People inside a barbershop in Manchester, UK, photographed by beth d',
} as const;

export const INSIGHTS_BOOKING_LINK = {
  slug: 'google-business-profile-booking-link-barbershop',
  path: '/insights/google-business-profile-booking-link-barbershop',
  headline: 'Your Google Profile Has a Booking Button. Do You Know Where It Sends People?',
  seoTitle: "Google Business Profile Booking Link: A Barbershop Owner's Check",
  description:
    "Your Google profile's Book button may send new clients to a system you don't use. How UK barbershops can check, choose and measure their booking link.",
  categoryId: 'bookings-operations' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-18',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fa7dbe5bbda81b780dcf7a9ae55f731',
  lead: 'Check whether your Google booking button sends clients to the right system, which providers control the links, and how to measure completed bookings.',
  heroImage:
    'https://images.pexels.com/photos/35430743/pexels-photo-35430743.jpeg?auto=compress&cs=tinysrgb&w=2400',
  ogImage:
    'https://images.pexels.com/photos/35430743/pexels-photo-35430743.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop',
  ogImageAlt: 'London barbershop seen through its front window, photographed by pierre matile',
} as const;

export const INSIGHTS_WEBSITE_NEED = {
  slug: 'do-barbers-need-a-website-uk',
  path: '/insights/do-barbers-need-a-website-uk',
  headline: 'Do Barbers Need a Website? A Test for Shops That Already Have Instagram and Google',
  seoTitle: 'Do Barbers Need a Website? An Honest UK Test',
  description:
    "Some barbershops don't need a website. A four-question test, what Google and Instagram already cover, and the UK rules on prices and company details online.",
  categoryId: 'tools-payments' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-18',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda81938916eff2052db502',
  lead: 'A four-question test for UK barbershops deciding whether Google, Instagram and a booking page already do enough.',
  heroImage: 'https://images.pexels.com/photos/5464697/pexels-photo-5464697.jpeg?auto=compress&cs=tinysrgb&w=2400',
  ogImage: 'https://images.pexels.com/photos/5464697/pexels-photo-5464697.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop',
  ogImageAlt: 'Barbershop frontage with warm lights and neon signage in Manchester, England',
} as const;

export const INSIGHTS_COMMISSION_PAY = {
  slug: 'barber-commission-pay-minimum-wage-uk',
  path: '/insights/barber-commission-pay-minimum-wage-uk',
  headline: 'Commission Pay for Barbers: The Minimum Wage Line Under Every Percentage',
  seoTitle: 'Commission Pay for Barbers: UK Minimum Wage Rules (2026)',
  description: 'Commission-only or a base plus percentage? Check UK minimum wage rates, hours and pay reference periods for employed barbers — with a worked £2,198.83 example.',
  categoryId: 'industry-people' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda813c8ce9e6758d32585d',
  lead: 'What commission-based pay means for employed UK barbers, with the minimum wage test across busy and quiet months.',
  heroImage: 'https://images.unsplash.com/photo-1722635255984-827851ba91be?auto=format&fit=crop&fm=jpg&q=75&w=2400',
  ogImage: 'https://images.unsplash.com/photo-1722635255984-827851ba91be?auto=format&fit=crop&fm=jpg&q=75&w=1200&h=630',
  ogImageAlt: 'Barber at work with a client in a hair salon in Doncaster, United Kingdom',
} as const;

export const INSIGHTS_NO_SHOW_DEPOSITS = {
  slug: 'barbershop-no-show-cost-when-deposit-makes-sense',
  path: '/insights/barbershop-no-show-cost-when-deposit-makes-sense',
  headline: 'What a No-Show Really Costs a Barbershop — and When a Deposit Makes Sense',
  seoTitle: 'Barbershop No-Shows: True Cost & When Deposits Make Sense',
  description:
    'What a no-show really costs a UK barbershop once refills, card fees and deposits are counted, and when a deposit is fair, useful and worth asking for.',
  categoryId: 'bookings-operations' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-20',
  verifiedDate: '2026-10-20',
  notionUrl: 'https://app.notion.com/p/3fa7dbe5bbda81e2982bc9c20f746a2d',
  lead: 'Use realistic refill and card-fee maths to decide when a barbershop deposit protects income, and what UK cancellation rules require.',
  heroImage:
    'https://images.unsplash.com/photo-1569832947682-77c9164611df?auto=format&fit=crop&fm=jpg&q=78&w=2200',
  ogImage:
    'https://images.unsplash.com/photo-1569832947682-77c9164611df?auto=format&fit=crop&fm=jpg&q=78&w=1200&h=630',
  ogImageAlt: 'Unoccupied leather barber chairs in a barbershop, photographed by Jarrod Reed',
} as const;

/**
 * Single source of publication for owner-approved Insights articles.
 * Sitemap, hub cards and indexability must derive from this list only.
 * Order matches Latest Thinking / CollectionPage ItemList (newest-first editorial order).
 */
export const INSIGHTS_PUBLISHED_ARTICLES = [
  INSIGHTS_NO_SHOW_DEPOSITS,
  INSIGHTS_MTD_BARBERS,
  INSIGHTS_OWNER_EARNINGS,
  INSIGHTS_UNFAIR_DISMISSAL,
  INSIGHTS_APPRENTICE_BARBER,
  INSIGHTS_BUSINESS_RATES,
  INSIGHTS_LOYALTY_SCHEMES,
  INSIGHTS_BUSY_DIARY,
  INSIGHTS_WALK_INS,
  INSIGHTS_BOOKING_LINK,
  INSIGHTS_WEBSITE_NEED,
  INSIGHTS_COMMISSION_PAY,
  INSIGHTS_SECOND_VISIT,
  INSIGHTS_BARBERS_HANDS,
  INSIGHTS_DECEMBER_HOURS,
  INSIGHTS_HAIRCUT_PRICING,
  INSIGHTS_GIFT_VOUCHERS,
  INSIGHTS_CARD_FEES,
  INSIGHTS_LOCAL_CLIENTS,
  INSIGHTS_GOOGLE_REVIEWS,
] as const;

export type InsightsPublishedArticle = (typeof INSIGHTS_PUBLISHED_ARTICLES)[number] & {
  /** Set only when an editorial revision meaningfully changes published copy. */
  modifiedDate?: string;
};

export function getInsightsArticleCategoryId(article: { categoryId: InsightsCategoryId }): InsightsCategoryId {
  return article.categoryId;
}

export function getInsightsArticleCategoryLabel(article: { categoryId: InsightsCategoryId }): string {
  return getInsightsCategoryName(article.categoryId);
}

export function isInsightsArticlePublished(slug: string): boolean {
  return INSIGHTS_PUBLISHED_ARTICLES.some((article) => article.slug === slug);
}

export function getInsightsPublishedArticle(slug: string): InsightsPublishedArticle | undefined {
  return INSIGHTS_PUBLISHED_ARTICLES.find((article) => article.slug === slug);
}

export function getPublishedArticlesByCategory(
  categoryId: InsightsCategoryId,
): InsightsPublishedArticle[] {
  return INSIGHTS_PUBLISHED_ARTICLES.filter((article) => article.categoryId === categoryId);
}

export function formatInsightsDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function absoluteAssetUrl(src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  return buildAbsoluteUrl(src.startsWith('/') ? src : `/${src}`);
}

/** Newest editorial publishedDate among live articles — used for hub sitemap lastmod. */
export function getInsightsIndexLastmod(): string {
  return INSIGHTS_PUBLISHED_ARTICLES.reduce<string>(
    (newest, article) => (article.publishedDate > newest ? article.publishedDate : newest),
    INSIGHTS_PUBLISHED_ARTICLES[0].publishedDate,
  );
}

export function buildInsightsSitemapEntries(): Array<{ path: string; lastmod?: string }> {
  return [
    { path: INSIGHTS_INDEX_PATH, lastmod: getInsightsIndexLastmod() },
    ...INSIGHTS_PUBLISHED_ARTICLES.map((article) => {
      const modified =
        'modifiedDate' in article && typeof article.modifiedDate === 'string'
          ? article.modifiedDate
          : undefined;
      return {
        path: article.path,
        lastmod: modified && modified.length > 0 ? modified : article.publishedDate,
      };
    }),
    ...getIndexableInsightsCategorySitemapEntries(),
  ];
}

export function buildInsightsBreadcrumbs(options?: {
  path?: string;
  headline?: string;
  categoryId?: InsightsCategoryId;
}) {
  const items: Array<{ '@type': 'ListItem'; position: number; name: string; item: string }> = [
    { '@type': 'ListItem', position: 1, name: 'KERSIVO', item: buildAbsoluteUrl('/') },
    { '@type': 'ListItem', position: 2, name: 'Insights', item: buildAbsoluteUrl(INSIGHTS_INDEX_PATH) },
  ];
  if (options?.categoryId) {
    const category = getInsightsCategory(options.categoryId);
    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: category.name,
      item: buildAbsoluteUrl(category.path),
    });
  }
  if (options?.path && options.headline) {
    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: options.headline,
      item: buildAbsoluteUrl(options.path),
    });
  }
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
}

export function buildInsightsIndexJsonLd() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': buildAbsoluteUrl(INSIGHTS_INDEX_PATH) + '#webpage',
      url: buildAbsoluteUrl(INSIGHTS_INDEX_PATH),
      name: INSIGHTS_INDEX_TITLE,
      description: INSIGHTS_INDEX_DESCRIPTION,
      inLanguage: 'en-GB',
      isPartOf: { '@id': buildAbsoluteUrl('/') + '#website' },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: INSIGHTS_PUBLISHED_ARTICLES.length,
        itemListElement: INSIGHTS_PUBLISHED_ARTICLES.map((article, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: article.headline,
          url: buildAbsoluteUrl(article.path),
        })),
      },
    },
    buildInsightsBreadcrumbs(),
  ];
}

export function buildInsightsCategoryJsonLd(options: {
  categoryId: InsightsCategoryId;
  articles: readonly InsightsPublishedArticle[];
  indexable: boolean;
}) {
  const category = getInsightsCategory(options.categoryId);
  const url = buildAbsoluteUrl(category.path);
  const page: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': url + '#webpage',
    url,
    name: category.seoTitle,
    description: category.seoDescription,
    inLanguage: 'en-GB',
    isPartOf: { '@id': buildAbsoluteUrl('/') + '#website' },
  };
  if (options.indexable && options.articles.length > 0) {
    page.mainEntity = {
      '@type': 'ItemList',
      numberOfItems: options.articles.length,
      itemListElement: options.articles.map((article, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: article.headline,
        url: buildAbsoluteUrl(article.path),
      })),
    };
  }
  return [page, buildInsightsBreadcrumbs({ categoryId: options.categoryId })];
}

export function buildInsightsArticleJsonLd(article: {
  path: string;
  headline: string;
  description: string;
  publishedDate: string;
  verifiedDate: string;
  modifiedDate?: string;
  heroImage: string;
  ogImage?: string;
  categoryId: InsightsCategoryId;
}) {
  const url = buildAbsoluteUrl(article.path);
  const imageUrl = absoluteAssetUrl(article.ogImage ?? article.heroImage);
  const categoryName = getInsightsCategoryName(article.categoryId);
  const payload: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': url + '#article',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: article.headline,
    description: article.description,
    image: [imageUrl],
    datePublished: article.publishedDate,
    inLanguage: 'en-GB',
    author: { '@type': 'Organization', name: 'KERSIVO', url: buildAbsoluteUrl('/') },
    publisher: {
      '@type': 'Organization',
      name: 'KERSIVO',
      url: buildAbsoluteUrl('/'),
      logo: {
        '@type': 'ImageObject',
        url: buildAbsoluteUrl('/images/logo-kersivo.png'),
      },
    },
    articleSection: categoryName,
    isAccessibleForFree: true,
  };
  if (article.modifiedDate && article.modifiedDate !== article.publishedDate) {
    payload.dateModified = article.modifiedDate;
  }
  return [
    payload,
    buildInsightsBreadcrumbs({
      path: article.path,
      headline: article.headline,
      categoryId: article.categoryId,
    }),
  ];
}
