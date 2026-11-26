/**
 * Site-wide owner of each FAQ question that is answered visibly on more than one page.
 *
 * Google's FAQPage guidelines ask for a question to be marked up once per site. Every page keeps
 * its visible FAQ unchanged; only the owner page below emits that question as a `Question` in its
 * FAQPage JSON-LD. Questions not listed here appear on one page only and are always marked up.
 *
 * Adding the same question to a second page's FAQ? Add it here with the page that owns the topic.
 * `faqSchemaOwners.test.ts` fails when any question is marked up on two pages.
 */
export const FAQ_SCHEMA_OWNERS: Readonly<Record<string, string>> = {
  'Can clients book from Google, Instagram or TikTok?': '/barbershop-online-booking',
  'Do clients get booking confirmations and reminders?': '/barbershop-online-booking',
  'Can you migrate me from Booksy, Fresha or another booking platform?': '/pricing',
  'Do clients need to download an app to book with KERSIVO?': '/compare',
  'How much does Booksy cost in the UK?': '/booksy-alternative',
  'Does KERSIVO charge per barber?': '/booksy-alternative',
  'Does KERSIVO charge commission on bookings?': '/fresha-alternative',
  'Does KERSIVO have a marketplace?': '/nearcut-alternative',
  'How much does Square Appointments cost in the UK?': '/square-appointments-alternative',
  'Is Nearcut free for barbershops?': '/nearcut-alternative',
  'Is KERSIVO Starter really free?': '/treatwell-alternative',
  'Is Booksy or Fresha cheaper for a barbershop?': '/booksy-vs-fresha',
};

/** Filter for FAQ items going into a page's FAQPage JSON-LD: drops questions another page owns. */
export function ownedFaqSchemaItem(path: string) {
  return (item: { question: string }): boolean => {
    const owner = FAQ_SCHEMA_OWNERS[item.question.trim()];
    return owner === undefined || owner === path;
  };
}
