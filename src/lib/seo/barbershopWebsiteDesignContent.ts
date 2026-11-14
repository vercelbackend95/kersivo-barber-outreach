/**
 * Copy for /barbershop-website-design (design-intent guide).
 *
 * Intent split: /barbershop-websites answers "do I need a website and what should it include";
 * this page answers "what makes a barbershop website look professional and convert": layout,
 * visual hierarchy, mobile UX, branding and photography. Do not repeat pillar content here.
 * British English. No invented numbers, reviews or customers. CUTSTATE is the fictional demo shop.
 */

export const WD_HERO_EYEBROW = 'Barbershop website design guide';

/** H1 split for the display layout; the joined string is BARBERSHOP_WEBSITE_DESIGN_PAGE_H1. */
export const WD_HERO_TITLE_LINES = ['Barbershop website', 'design built to', 'get you booked'] as const;

export const WD_HERO_LEAD =
  'A client decides on your shop before they scroll. Layout, branding, photography and mobile design decide whether they tap Book or go back to Google. This guide shows what good looks like — and how KERSIVO designs it around your shop.';

export const WD_HERO_FACTS = ['Designed around your shop', 'Booking built into the design', 'Full KERSIVO £39/month per location'] as const;

/** Hotspots on the hero phone: what each design decision does for the owner. */
export const WD_INSPECTOR_POINTS = [
  {
    id: 'identity',
    label: 'Your name, set large',
    body: 'Clients know they are in the right place the moment the page loads.',
  },
  {
    id: 'photo',
    label: 'A real photo of your chair',
    body: 'Your shop, your light, your work. Stock photos make every shop look the same.',
  },
  {
    id: 'prices',
    label: 'Prices in plain sight',
    body: 'No guessing and no phone call just to ask what a skin fade costs.',
  },
  {
    id: 'book',
    label: 'Book, always in thumb reach',
    body: 'One clear action that follows the client down the page.',
  },
] as const;

export const WD_GLANCE = {
  kicker: 'The first-glance test',
  heading: 'What a client decides before they scroll',
  lede: 'Drag the divider. Same shop, same services — one page makes the client work, the other answers their questions on the first screen.',
  questions: [
    { q: 'Is this my kind of shop?', a: 'Real photos and a confident name set the tone.' },
    { q: 'What will it cost?', a: 'Starting prices visible, not hidden in a PDF.' },
    { q: 'Where is it, and when is it open?', a: 'Area and today’s hours, one glance away.' },
    { q: 'How do I book?', a: 'One red button, not a phone number in small print.' },
  ],
  beforeLabel: 'Generic template',
  afterLabel: 'Designed to book',
} as const;

export const WD_MOBILE = {
  kicker: 'Mobile UX',
  heading: 'Design for the thumb, not the mouse',
  lede: 'Many clients find you on a phone, often one-handed between other things. A good barbershop website is laid out for that hand.',
  layers: [
    {
      id: 'thumb',
      label: 'Thumb zone',
      title: 'Put Book where the thumb already is',
      body: 'The bottom of the screen is the easiest place to reach. A sticky Book bar lives there, so the main action never needs a stretch or a scroll back up.',
    },
    {
      id: 'targets',
      label: 'Tap targets',
      title: 'Make every tap hard to miss',
      body: 'Buttons and links at least 44 pixels tall, with space between them. Small, crowded links are why clients tap the wrong service and give up.',
    },
    {
      id: 'hierarchy',
      label: 'Hierarchy',
      title: 'One job per screen',
      body: 'Size and contrast follow importance: the name, then the photo, then the prices, then Book. When everything shouts, nothing gets read.',
    },
  ],
} as const;

export const WD_BRAND = {
  kicker: 'Branding',
  heading: 'Your brand sets the look, not a template',
  lede: 'Try it. The layout stays fast and familiar; the colours, type and photos make it unmistakably one shop.',
  palettes: [
    { id: 'night', label: 'Night shift', note: 'Black, white and one hot accent' },
    { id: 'heritage', label: 'Heritage', note: 'Bottle green, cream and brass' },
    { id: 'clean', label: 'Clean studio', note: 'Bright white with a bold red' },
  ],
  typefaces: [
    { id: 'condensed', label: 'Condensed', note: 'Loud, modern, street' },
    { id: 'serif', label: 'Serif', note: 'Traditional, gentleman’s club' },
    { id: 'sans', label: 'Clean sans', note: 'Calm, minimal, precise' },
  ],
  principles: [
    {
      title: 'Start from what clients already know',
      body: 'Your shopfront colours, your logo and the name on your sign. The website should feel like walking through your door.',
    },
    {
      title: 'One accent colour does the work',
      body: 'Save your strongest colour for the things you want tapped. If everything is red, Book stops standing out.',
    },
    {
      title: 'Type is your tone of voice',
      body: 'A condensed headline reads loud and modern; a serif reads traditional. Pick one voice and use it everywhere.',
    },
  ],
} as const;

export const WD_PHOTO = {
  kicker: 'Photography',
  heading: 'Real photos do the selling',
  lede: 'Clients choose a barber with their eyes. Your own photos, even from a good phone, beat any stock image — because they show the shop the client will actually walk into.',
  shotList: [
    { id: 'chair', title: 'The chair and the room', body: 'Wide, in daylight, tidy. It answers “what is it like in there?”' },
    { id: 'work', title: 'Finished cuts, close up', body: 'Fades, lines and beard work. This is your portfolio.' },
    { id: 'hands', title: 'Barbers at work', body: 'Hands, clippers, focus. It shows skill, not just a result.' },
    { id: 'detail', title: 'The details', body: 'Tools, products, the station. Small things that say you care.' },
  ],
  teamHeading: 'Put faces to the names',
  teamBody:
    'Clients book a person, not a chair. A portrait and a short line about each barber make choosing easy — and bring regulars back to the same chair.',
} as const;

/** Self-audit: each item is a design detail the owner can check on their current site. */
export const WD_AUDIT = {
  kicker: 'Self-check',
  heading: 'Score your current website',
  lede: 'Tick what your website does today. Be honest — nobody else sees this.',
  items: [
    'My shop name and area are visible without scrolling',
    'The first photo is my real shop or my real work',
    'Prices are visible before a client books',
    'There is one obvious Book button on every screen',
    'Book is easy to reach with a thumb on a phone',
    'Every barber has a photo and their own booking choice',
    'Opening hours and the area are on the home page',
    'Colours and fonts match my shopfront and logo',
  ],
  results: [
    { min: 0, title: 'Your website is making clients work hard', body: 'Most of what a client needs is missing or hidden. A redesign will change more than the look.' },
    { min: 4, title: 'Good bones, missing details', body: 'The basics are there, but small gaps make clients hesitate. Those are the details KERSIVO designs in by default.' },
    { min: 7, title: 'Your website is in good shape', body: 'You already know what good looks like. If booking still runs through a third-party app, that is where KERSIVO helps next.' },
  ],
} as const;

/** The KERSIVO close: outcomes for the owner, from approved claims only. */
export const WD_OFFER = {
  kicker: 'Full KERSIVO',
  heading: 'Let KERSIVO design it for you',
  lede: 'Everything on this page, done for your shop. You send your details and photos; we design the website around your brand, with booking built in.',
  outcomes: [
    {
      title: 'A website that looks like your shop',
      body: 'Designed around your name, logo, photos, barbers and style — not a template with your name dropped in.',
    },
    {
      title: 'Booking designed in, not bolted on',
      body: 'Clients pick a service, a barber and a time on your own website, under your own brand.',
    },
    {
      title: 'Mobile-first by default',
      body: 'Thumb-reach Book bar, readable prices and fast pages on every phone.',
    },
    {
      title: 'Ready in a few days',
      body: 'Typically ready in a few days once we receive all the required information.',
    },
  ],
} as const;

export type WdFaq = { id: string; question: string; answer: string };

export const WD_FAQS: readonly WdFaq[] = [
  {
    id: 'cost',
    question: 'How much does a barbershop website design cost with KERSIVO?',
    answer:
      'Full KERSIVO is £39/month per location, with no setup fee. That covers a standard website designed around your shop’s brand, online booking, your own domain, hosting and platform updates.',
  },
  {
    id: 'template',
    question: 'Will my website look like a template?',
    answer:
      'No. Each website is designed around your shop — your name, photos, barbers, services and style. It runs on the KERSIVO platform so booking and payments work reliably, but it is not an unlimited bespoke build: redesigns and custom features are not included.',
  },
  {
    id: 'photos',
    question: 'Do I need professional photos?',
    answer:
      'No. Good phone photos in daylight work well. If you do not have photos of something yet, that section can be left out until you do. KERSIVO never uses stock photos in a way that suggests they show your real shop, staff or clients.',
  },
  {
    id: 'brand',
    question: 'Can you match my existing logo and colours?',
    answer:
      'Yes. Your logo, colours and the feel of your shopfront are the starting point. If you do not have a logo, your shop name is set as a clean typographic wordmark.',
  },
  {
    id: 'changes',
    question: 'Can I ask for changes before the website goes live?',
    answer:
      'Yes. You get a private preview to check the design, photos, prices and booking journey. Reasonable corrections are made before you approve launch, and nothing goes live without your approval.',
  },
  {
    id: 'updates',
    question: 'Can I update prices and barbers myself after launch?',
    answer:
      'Yes. Barbers, services, prices, working hours and basic shop details are managed in your dashboard. Reasonable changes to text and photos are covered by standard support.',
  },
];
