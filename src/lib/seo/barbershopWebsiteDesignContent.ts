/**
 * Copy for /barbershop-website-design (design-intent guide).
 *
 * Intent split: /barbershop-websites answers "do I need a website and what should it include";
 * this page answers "what makes a barbershop website look professional and convert": layout,
 * visual hierarchy, mobile UX, branding and photography. Do not repeat pillar content here.
 * British English. No invented numbers, reviews or customers. Heritage Grooming is the fictional demo shop.
 */

export const WD_HERO_EYEBROW = 'Barbershop website design guide';

/** H1 split for the display layout; the joined string is BARBERSHOP_WEBSITE_DESIGN_PAGE_H1. */
export const WD_HERO_TITLE_LINES = ['Barbershop website', 'design built to', 'get you booked'] as const;

export const WD_HERO_LEAD =
  'A client decides on your shop before they scroll. Layout, branding, photography and mobile design decide whether they tap Book or go back to Google. This guide shows what good looks like — and how KERSIVO designs it around your shop.';

export const WD_HERO_FACTS = ['Designed around your shop', 'Booking built into the design', 'Full KERSIVO £39/month per location'] as const;

/**
 * The short answer, shown under the hero and quoted by answer engines. One self-contained paragraph
 * that names the five design decisions this guide covers, in the order the page covers them.
 */
export const WD_SHORT_ANSWER = {
  question: 'What makes a good barbershop website design?',
  answer:
    'A good barbershop website design answers four questions on the first screen of a phone: is this my kind of shop, what does it cost, where and when is it open, and how do I book. It uses your real photos, your shop’s colours and type, prices in plain sight, and one Book button that stays within thumb reach on every screen.',
} as const;

/** Chapters of the guide, linked from the hero so a reader (and a search engine) can jump to each part. */
export const WD_CHAPTERS = [
  { id: 'first-glance', label: 'First glance' },
  { id: 'mobile-ux', label: 'Mobile UX' },
  { id: 'branding', label: 'Branding' },
  { id: 'photography', label: 'Photography' },
  { id: 'self-check', label: 'Self-check' },
  { id: 'kersivo', label: 'Full KERSIVO' },
] as const;

/**
 * The design inspector in the hero: each point frames a measured part of the real Heritage Grooming
 * phone page (src/lib/websiteDesign/inspectorCapture.json). `layer` is the label on the selection box.
 */
export const WD_INSPECTOR_POINTS = [
  {
    id: 'identity',
    layer: 'Brand',
    label: 'Your name, set large',
    body: 'Clients know they are in the right place the moment the page loads.',
  },
  {
    id: 'photo',
    layer: 'Hero photo',
    label: 'A real photo of your chair',
    body: 'Your shop, your light, your work. Stock photos make every shop look the same.',
  },
  {
    id: 'prices',
    layer: 'Price list',
    label: 'Prices in plain sight',
    body: 'No guessing and no phone call just to ask what a skin fade costs.',
  },
  {
    id: 'book',
    layer: 'Book bar',
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
    { q: 'How do I book?', a: 'One clear button, not a phone number in small print.' },
  ],
  beforeLabel: 'Generic template',
  afterLabel: 'Designed to book',
  missing: 'Not on screen',
  answered: 'Answered',
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
  zones: { easy: 'Easy reach', ok: 'Reachable', hard: 'Stretch' },
  /** The order the eye should take on the designed page, shown on the Hierarchy layer. */
  hierarchy: ['Name', 'Photo', 'Prices', 'Book'],
} as const;

export const WD_BRAND = {
  kicker: 'Branding',
  heading: 'Your brand sets the look, not a template',
  lede: 'Try it. The layout stays fast and familiar; the colours, type and photos make it unmistakably one shop.',
  palettes: [
    { id: 'night', label: 'Night shift', note: 'Black, white and one hot accent', swatches: ['#0b0b0c', '#f4f2ee', '#e23b3b'] },
    { id: 'heritage', label: 'Heritage', note: 'Bottle green, cream and brass', swatches: ['#0f1716', '#efe8d8', '#c6a766'] },
    { id: 'clean', label: 'Clean studio', note: 'Bright white with a bold red', swatches: ['#fbfaf7', '#141414', '#d7262e'] },
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
  tips: [
    { title: 'Shoot in daylight', body: 'Turn off the overhead tubes and stand with the window behind you.' },
    { title: 'Clear the counter', body: 'Ten seconds of tidying makes the room look ready for the client.' },
    { title: 'Hold the phone level', body: 'Straight verticals make the room look calm; tilted ones look rushed.' },
  ],
  teamHeading: 'Put faces to the names',
  teamBody:
    'Clients book a person, not a chair. A portrait and a short line about each barber make choosing easy — and bring regulars back to the same chair.',
} as const;

/**
 * Self-check: each item is a design detail the owner can check on their current site. When an item
 * is not ticked, its fix links to the KERSIVO guide or free tool that helps with it.
 */
export type WdAuditItem = {
  id: string;
  text: string;
  fix: { label: string; href: string };
};

export const WD_AUDIT = {
  kicker: 'Self-check',
  heading: 'Score your current website',
  lede: 'Tick what your website does today. Be honest — nobody else sees this. Every gap comes with a free fix.',
  groups: [
    {
      id: 'first-screen',
      title: 'First screen',
      items: [
        { id: 'name', text: 'My shop name and area are visible without scrolling', fix: { label: 'See the first-glance test', href: '#first-glance' } },
        { id: 'photo', text: 'The first photo is my real shop or my real work', fix: { label: 'Use the photo shot list', href: '#photography' } },
        { id: 'hours', text: 'Opening hours and the area are on the home page', fix: { label: 'See what a website should include', href: '/barbershop-websites' } },
      ],
    },
    {
      id: 'booking',
      title: 'Booking',
      items: [
        { id: 'prices', text: 'Prices are visible before a client books', fix: { label: 'Make a free price list', href: '/barbershop-price-list-template' } },
        { id: 'book', text: 'There is one obvious Book button on every screen', fix: { label: 'Read the online booking guide', href: '/barbershop-online-booking' } },
        { id: 'barbers', text: 'Every barber has a photo and their own booking choice', fix: { label: 'See the team page in the demo', href: '/demo/heritage-grooming/team.html' } },
        { id: 'policy', text: 'My cancellation policy is shown before a client books', fix: { label: 'Write a cancellation policy', href: '/barbershop-cancellation-policy-template' } },
        { id: 'deposit', text: 'Bookings take a deposit, so a no-show still pays', fix: { label: 'Work out what no-shows cost', href: '/barbershop-no-show-calculator' } },
      ],
    },
    {
      id: 'mobile',
      title: 'Mobile',
      items: [{ id: 'thumb', text: 'Book is easy to reach with a thumb on a phone', fix: { label: 'See the thumb zone', href: '#mobile-ux' } }],
    },
    {
      id: 'brand',
      title: 'Brand',
      items: [{ id: 'brand', text: 'Colours and fonts match my shopfront and logo', fix: { label: 'Try the brand tuner', href: '#branding' } }],
    },
  ] as const satisfies readonly { id: string; title: string; items: readonly WdAuditItem[] }[],
  results: [
    { min: 0, title: 'Your website is making clients work hard', body: 'Most of what a client needs is missing or hidden. A redesign will change more than the look.' },
    { min: 5, title: 'Good bones, missing details', body: 'The basics are there, but small gaps make clients hesitate. Those are the details KERSIVO designs in by default.' },
    { min: 9, title: 'Your website is in good shape', body: 'You already know what good looks like. If booking still runs through a third-party app, that is where KERSIVO helps next.' },
  ],
  fixHeading: 'Your free fix list',
  fixEmpty: 'Nothing to fix. Tick the boxes as you check your site.',
  toolsHeading: 'More free tools for barbershops',
  tools: [
    { label: 'Price list template', href: '/barbershop-price-list-template', note: 'A clean price list for the wall and the website' },
    { label: 'Barber price calculator', href: '/barber-price-calculator', note: 'Price a cut from your time and costs' },
    { label: 'No-show calculator', href: '/barbershop-no-show-calculator', note: 'What missed appointments cost you a year' },
    { label: 'Cancellation policy template', href: '/barbershop-cancellation-policy-template', note: 'A fair policy, ready to publish' },
    { label: 'Software cost calculator', href: '/barber-software-cost-calculator', note: 'Booking software costs by team size' },
    { label: 'All free tools', href: '/free-tools', note: 'Every KERSIVO tool in one place' },
  ],
} as const;

/** Flat list of the self-check items, in the order they appear. */
export const WD_AUDIT_ITEMS: readonly WdAuditItem[] = WD_AUDIT.groups.flatMap((group): readonly WdAuditItem[] => group.items);

/** The KERSIVO close: outcomes for the owner, from approved claims only. */
export const WD_OFFER = {
  kicker: 'Full KERSIVO',
  heading: 'Let KERSIVO design it for you',
  lede: 'Everything on this page, done for your shop. You send your details and photos; we design the website around your brand, with booking built in.',
  steps: [
    { title: 'Send your details', body: 'Name, logo, photos, barbers, services and hours.' },
    { title: 'We design it', body: 'Around your brand, with booking built in.' },
    { title: 'Check the preview', body: 'A private preview of the design, prices and booking.' },
    { title: 'Approve and go live', body: 'Nothing goes live without your approval.' },
  ],
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
    id: 'good-design',
    question: 'What makes a good barbershop website design?',
    answer: WD_SHORT_ANSWER.answer,
  },
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
    id: 'mobile',
    question: 'Why does mobile design matter so much for a barbershop?',
    answer:
      'Many clients find a barber on a phone, often one-handed. A mobile-first design keeps the shop name, a real photo, prices and a Book button on the first screen, with Book in a sticky bar at the bottom where the thumb already is.',
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
