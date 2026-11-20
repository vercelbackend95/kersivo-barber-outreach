/**
 * Heritage Grooming — the fictional barbershop KERSIVO uses as its live demo.
 *
 * The public site is served unchanged from `public/demo/heritage-grooming/` (static HTML/JS).
 * This module is the typed mirror of its own data files, used by the demo owner dashboard:
 *   - barbers, categories and the price list → `public/demo/heritage-grooming/js/data.js`
 *   - opening hours                          → `public/demo/heritage-grooming/js/house.js`
 *   - the retail shelf                       → `public/demo/heritage-grooming/js/shop-data.js`
 * `data.test.ts` fails when the two drift apart, so the site and the dashboard always agree.
 */
import type { ProductCategory } from '@/lib/shop/productPresentation';
import { HERITAGE_DEMO_BASE_PATH } from './links';

export const HERITAGE_SHOP_NAME = 'Heritage Grooming';

/** Site links live in ./links (shared with the marketing nav); re-exported here for the demo code. */
export {
  HERITAGE_DEMO_BASE_PATH,
  HERITAGE_DEMO_BOOK_HREF,
  HERITAGE_DEMO_SERVICES_HREF,
  HERITAGE_DEMO_SHOP_HREF,
  HERITAGE_DEMO_SITE_HREF,
  HERITAGE_DEMO_TEAM_HREF,
} from './links';
export const HERITAGE_ASSET_BASE = `${HERITAGE_DEMO_BASE_PATH}/assets/img` as const;
export const HERITAGE_SEAL_SRC = `${HERITAGE_ASSET_BASE}/seal-128.webp` as const;

/** Opening hours by weekday (0 = Sunday) → [open hour, close hour]; null = closed. Mirrors house.js HOURS. */
export const HERITAGE_HOURS: Readonly<Record<number, readonly [number, number] | null>> = {
  0: null,
  1: null,
  2: [9, 19],
  3: [9, 19],
  4: [9, 19],
  5: [9, 19],
  6: [9, 17],
};

export type HeritageSpecialty = 'fade' | 'scissor' | 'long' | 'beard' | 'shave' | 'lineup';

export type HeritageBarber = {
  /** Id used by the static site (`data.js`). */
  siteId: string;
  /** Id used by the KERSIVO dashboard fixtures. */
  id: string;
  name: string;
  first: string;
  role: string;
  since: number;
  /** Weekdays the barber is in (0 = Sunday), as on the site. */
  days: readonly number[];
  tags: readonly HeritageSpecialty[];
  /** Square-ish portrait crop for avatars. */
  avatarSrc: string;
};

function barberAvatar(photo: string): string {
  return `${HERITAGE_ASSET_BASE}/${photo}-500.webp`;
}

export const HERITAGE_BARBERS: readonly HeritageBarber[] = [
  {
    siteId: 'arthur',
    id: 'hg-barber-arthur',
    name: 'Arthur Penn',
    first: 'Arthur',
    role: 'Classic cuts and beard work',
    since: 2009,
    days: [2, 3, 4, 5, 6],
    tags: ['scissor', 'long', 'beard'],
    avatarSrc: barberAvatar('work-arthur-fade'),
  },
  {
    siteId: 'kit',
    id: 'hg-barber-kit',
    name: 'Kit Harlow',
    first: 'Kit',
    role: 'Skin fades and clipper work',
    since: 2015,
    days: [3, 4, 5, 6],
    tags: ['fade', 'lineup', 'scissor'],
    avatarSrc: barberAvatar('work-kit-scissors'),
  },
  {
    siteId: 'rafi',
    id: 'hg-barber-rafi',
    name: 'Rafi Mendes',
    first: 'Rafi',
    role: 'Hot-towel shaves and open razor',
    since: 2012,
    days: [2, 3, 4, 6],
    tags: ['shave', 'beard', 'long'],
    avatarSrc: barberAvatar('work-rafi-neckline'),
  },
  {
    siteId: 'owen',
    id: 'hg-barber-owen',
    name: 'Owen Clarke',
    first: 'Owen',
    role: 'Beard shaping and line-ups',
    since: 2018,
    days: [2, 4, 5, 6],
    tags: ['beard', 'lineup', 'fade', 'shave'],
    avatarSrc: barberAvatar('work-owen-razor'),
  },
];

export type HeritageServiceCategory = {
  siteId: string;
  /** Category key stored on services in the dashboard. */
  name: string;
};

export const HERITAGE_SERVICE_CATEGORIES: readonly HeritageServiceCategory[] = [
  { siteId: 'cuts', name: 'Haircuts' },
  { siteId: 'beards', name: 'Beards' },
  { siteId: 'shaves', name: 'Straight razor' },
  { siteId: 'combos', name: 'Combinations' },
  { siteId: 'young', name: 'Under twelves' },
];

export type HeritageService = {
  siteId: string;
  id: string;
  /** `HeritageServiceCategory.siteId`. */
  cat: string;
  category: string;
  name: string;
  mins: number;
  /** Whole pounds, as on the site. */
  price: number;
  pricePence: number;
  desc: string;
  displayOrder: number;
  /** The six on the home page price list (data.js SERVICES). */
  featured: boolean;
};

type ServiceDraft = Pick<HeritageService, 'siteId' | 'cat' | 'name' | 'mins' | 'price' | 'desc'>;

const SERVICE_DRAFTS: readonly ServiceDraft[] = [
  { siteId: 'haircut', cat: 'cuts', name: 'Haircut', mins: 45, price: 26, desc: 'Scissor or clipper cut, washed and styled.' },
  { siteId: 'skin-fade', cat: 'cuts', name: 'Skin fade', mins: 45, price: 29, desc: 'Taken down to the skin and blended by hand.' },
  { siteId: 'long-hair', cat: 'cuts', name: 'Longer hair', mins: 60, price: 34, desc: 'Scissors only, for hair past the collar.' },
  { siteId: 'clipper-cut', cat: 'cuts', name: 'Clipper cut', mins: 20, price: 16, desc: 'One grade all over, neckline tidied with the razor.' },
  { siteId: 'beard-trim', cat: 'beards', name: 'Beard trim', mins: 20, price: 15, desc: 'Shaped, lined up with a razor and oiled.' },
  { siteId: 'beard-sculpt', cat: 'beards', name: 'Beard and hot towel', mins: 30, price: 22, desc: 'A hot towel first, then shaped by hand and lined with the razor.' },
  { siteId: 'line-up', cat: 'beards', name: 'Line-up', mins: 15, price: 12, desc: 'Hairline, cheeks and neck edged with the open razor.' },
  { siteId: 'hot-towel-shave', cat: 'shaves', name: 'Hot-towel shave', mins: 40, price: 32, desc: 'Hot towels, brushed lather and an open razor.' },
  { siteId: 'head-shave', cat: 'shaves', name: 'Head shave', mins: 40, price: 30, desc: 'Clippered down, hot towel, then the razor over the whole head.' },
  { siteId: 'haircut-beard', cat: 'combos', name: 'Haircut and beard', mins: 60, price: 38, desc: 'Both, in one sitting.' },
  { siteId: 'fade-beard', cat: 'combos', name: 'Skin fade and beard', mins: 60, price: 41, desc: 'The fade, then the beard blended into it.' },
  { siteId: 'the-heritage', cat: 'combos', name: 'The Heritage', mins: 90, price: 56, desc: 'Haircut, beard trim and a hot-towel shave.' },
  { siteId: 'child-cut', cat: 'young', name: 'Children’s haircut', mins: 30, price: 18, desc: 'Under twelve. Scissors or clippers, no product unless asked.' },
  { siteId: 'child-fade', cat: 'young', name: 'Children’s fade', mins: 30, price: 21, desc: 'Under twelve. Faded and blended, finished with a comb-through.' },
  { siteId: 'father-son', cat: 'young', name: 'Parent and child', mins: 75, price: 40, desc: 'Two haircuts, one after the other in the same chair.' },
];

/** data.js SERVICES — the six printed on the home page. */
export const HERITAGE_HOME_SERVICE_SITE_IDS = [
  'haircut',
  'skin-fade',
  'beard-trim',
  'haircut-beard',
  'hot-towel-shave',
  'the-heritage',
] as const;

const HOME_SERVICE_SET = new Set<string>(HERITAGE_HOME_SERVICE_SITE_IDS);

function categoryName(siteId: string): string {
  const category = HERITAGE_SERVICE_CATEGORIES.find((row) => row.siteId === siteId);
  if (!category) throw new Error(`Unknown Heritage service category: ${siteId}`);
  return category.name;
}

export const HERITAGE_SERVICES: readonly HeritageService[] = SERVICE_DRAFTS.map((draft, index) => ({
  ...draft,
  id: `hg-svc-${draft.siteId}`,
  category: categoryName(draft.cat),
  pricePence: draft.price * 100,
  displayOrder: index,
  featured: HOME_SERVICE_SET.has(draft.siteId),
}));

export type HeritageProductShelf = 'hair' | 'beard' | 'shave' | 'skin';

export type HeritageProduct = {
  siteId: string;
  id: string;
  cat: HeritageProductShelf;
  brand: string;
  /** Product name on the site; the dashboard shows `${brand} ${productName}` like the site's bag. */
  productName: string;
  name: string;
  size: string;
  price: number;
  pricePence: number;
  line: string;
  description: string;
  imageSrc: string;
  category: ProductCategory;
  featured: boolean;
  sortOrder: number;
};

type ProductDraft = {
  siteId: string;
  cat: HeritageProductShelf;
  brand: string;
  productName: string;
  size: string;
  price: number;
  line: string;
  desc?: string;
};

/** shop-data.js COUNTER, in the same order. */
const PRODUCT_DRAFTS: readonly ProductDraft[] = [
  { siteId: 'oakmoss-firm-pomade', cat: 'hair', brand: 'Oakmoss & Iron', productName: 'Firm Pomade', size: '100 ml', price: 18, line: 'Firm hold, low shine', desc: 'Water-based, so it rinses out with plain water. Holds a side parting or a slick-back from the morning to the evening.' },
  { siteId: 'kestrel-matte-clay', cat: 'hair', brand: 'Kestrel Supply Co.', productName: 'Matte Clay', size: '75 g', price: 19, line: 'Strong hold, matte finish', desc: 'Kaolin clay for texture that looks like nothing is in it. The one we use on short crops and messy fringes.' },
  { siteId: 'corvid-fibre-paste', cat: 'hair', brand: 'Corvid & Co.', productName: 'Fibre Paste', size: '85 g', price: 17, line: 'Pliable hold, natural finish', desc: 'A stretchy paste that works through longer hair and can be restyled with the fingers through the day.' },
  { siteId: 'halden-sea-salt-spray', cat: 'hair', brand: 'Halden Brothers', productName: 'Sea Salt Spray', size: '200 ml', price: 16, line: 'Texture and volume', desc: 'A few sprays into damp hair before the dryer. Gives fine hair body and a loose, worn-in texture.' },
  { siteId: 'hollowmere-texture-powder', cat: 'hair', brand: 'Hollowmere', productName: 'Texture Powder', size: '20 g', price: 14, line: 'Lift at the root' },
  { siteId: 'saltmarsh-hair-tonic', cat: 'hair', brand: 'Saltmarsh', productName: 'Hair Tonic', size: '250 ml', price: 21, line: 'Daily tonic for the scalp' },
  { siteId: 'old-quarry-shampoo', cat: 'hair', brand: 'Old Quarry', productName: 'Daily Shampoo', size: '300 ml', price: 15, line: 'Gentle everyday wash' },
  { siteId: 'fenwick-conditioner', cat: 'hair', brand: 'Fenwick & Vale', productName: 'Conditioner', size: '300 ml', price: 15, line: 'Softens without weight' },
  { siteId: 'barrow-beard-oil', cat: 'beard', brand: 'Barrow & Pike', productName: 'Beard Oil', size: '30 ml', price: 20, line: 'Softens the beard and the skin', desc: 'Three drops a day softens the beard and stops the itch on the skin underneath. What we finish every beard trim with.' },
  { siteId: 'ashgrove-beard-balm', cat: 'beard', brand: 'Ashgrove', productName: 'Beard Balm', size: '60 ml', price: 18, line: 'Shapes and conditions', desc: 'Holds stray hairs in place and shapes the moustache. Warm a little between the fingers first.' },
  { siteId: 'blackthorn-styling-cream', cat: 'hair', brand: 'Blackthorn', productName: 'Styling Cream', size: '100 ml', price: 17, line: 'Light hold, soft shine' },
  { siteId: 'wren-pocket-comb', cat: 'hair', brand: 'Wren & Hollis', productName: 'Pocket Comb', size: 'Acetate', price: 12, line: 'Hand-cut, fits a shirt pocket' },
  { siteId: 'ashby-hair-brush', cat: 'hair', brand: 'Ashby', productName: 'Boar Bristle Brush', size: 'Beech', price: 26, line: 'Smooths and spreads product' },
  { siteId: 'harrow-oil-pomade', cat: 'hair', brand: 'Harrow', productName: 'Oil Pomade', size: '100 g', price: 18, line: 'Medium hold, high shine' },
  { siteId: 'ashdown-thickening-shampoo', cat: 'hair', brand: 'Ashdown', productName: 'Thickening Shampoo', size: '250 ml', price: 17, line: 'Body for fine hair' },
  { siteId: 'tanners-moustache-wax', cat: 'beard', brand: "Tanner's Row", productName: 'Moustache Wax', size: '15 g', price: 11, line: 'Holds a curl all day' },
  { siteId: 'merrow-beard-wash', cat: 'beard', brand: 'Merrow', productName: 'Beard Wash', size: '150 ml', price: 16, line: 'Cleans without drying' },
  { siteId: 'hartwell-beard-comb', cat: 'beard', brand: 'Hartwell', productName: 'Beard Comb', size: 'Pearwood', price: 14, line: 'Fine and wide teeth' },
  { siteId: 'oxley-beard-brush', cat: 'beard', brand: 'Oxley', productName: 'Beard Brush', size: 'Walnut', price: 22, line: 'Trains the beard into shape' },
  { siteId: 'ferris-beard-conditioner', cat: 'beard', brand: 'Ferris', productName: 'Beard Conditioner', size: '100 ml', price: 18, line: 'Leave-in, softens coarse hair' },
  { siteId: 'linden-beard-butter', cat: 'beard', brand: 'Linden', productName: 'Beard Butter', size: '50 g', price: 15, line: 'Shea and cocoa, light hold' },
  { siteId: 'sheffield-beard-scissors', cat: 'beard', brand: 'Sheffield', productName: 'Beard Scissors', size: 'Steel', price: 28, line: 'Short blades for the moustache' },
  { siteId: 'copperleaf-shaving-soap', cat: 'shave', brand: 'Copperleaf', productName: 'Shaving Soap', size: '110 g', price: 22, line: 'Rich lather in a walnut bowl' },
  { siteId: 'northwick-shaving-cream', cat: 'shave', brand: 'Northwick', productName: 'Shaving Cream', size: '150 ml', price: 19, line: 'Cushioning for a close shave' },
  { siteId: 'ludlow-pre-shave-oil', cat: 'shave', brand: 'Ludlow', productName: 'Pre-shave Oil', size: '50 ml', price: 17, line: 'Softens stubble before the blade' },
  { siteId: 'greyfriars-aftershave', cat: 'shave', brand: 'Greyfriars', productName: 'Aftershave Tonic', size: '100 ml', price: 24, line: 'Cools and closes the skin' },
  { siteId: 'aldridge-post-shave-balm', cat: 'shave', brand: 'Aldridge', productName: 'Post-shave Balm', size: '100 ml', price: 21, line: 'Calms razor burn' },
  { siteId: 'kerne-alum-block', cat: 'shave', brand: 'Kerne', productName: 'Alum Block', size: '75 g', price: 10, line: 'Stops nicks, tones the skin' },
  { siteId: 'kingsley-razor-blades', cat: 'shave', brand: 'Kingsley', productName: 'Razor Blades', size: '10 blades', price: 8, line: 'Double-edge refills' },
  { siteId: 'brackley-shaving-stand', cat: 'shave', brand: 'Brackley', productName: 'Shaving Stand', size: 'Brass', price: 24, line: 'Dries the brush, holds the razor' },
  { siteId: 'pemberton-shaving-brush', cat: 'shave', brand: 'Pemberton', productName: 'Badger Brush', size: 'Rosewood', price: 38, line: 'Whips soap into lather' },
  { siteId: 'thornbury-safety-razor', cat: 'shave', brand: 'Thornbury', productName: 'Safety Razor', size: 'Brass', price: 45, line: 'Double-edge, built to last' },
  { siteId: 'ravensworth-face-wash', cat: 'skin', brand: 'Ravensworth', productName: 'Face Wash', size: '150 ml', price: 16, line: 'Daily wash for every skin' },
  { siteId: 'elmstead-face-scrub', cat: 'skin', brand: 'Elmstead', productName: 'Charcoal Scrub', size: '100 ml', price: 14, line: 'Clears ingrown hairs' },
  { siteId: 'bramble-clay-mask', cat: 'skin', brand: 'Bramble', productName: 'Clay Mask', size: '100 ml', price: 22, line: 'Weekly deep clean' },
  { siteId: 'harbour-lane-moisturiser', cat: 'skin', brand: 'Harbour Lane', productName: 'Daily Moisturiser', size: '75 ml', price: 20, line: 'Light, absorbs fast' },
  { siteId: 'cobbold-lip-balm', cat: 'skin', brand: 'Cobbold', productName: 'Lip Balm', size: '15 ml', price: 7, line: 'Beeswax for wind and cold' },
  { siteId: 'saltash-body-wash', cat: 'skin', brand: 'Saltash', productName: 'Body Wash', size: '250 ml', price: 14, line: 'Cedar and sea salt' },
  { siteId: 'grantley-eye-balm', cat: 'skin', brand: 'Grantley', productName: 'Eye Balm', size: '15 ml', price: 19, line: 'Cools tired eyes' },
  { siteId: 'westerly-bar-soap', cat: 'skin', brand: 'Westerly', productName: 'Bar Soap', size: '150 g', price: 9, line: 'Oatmeal, made by hand' },
  { siteId: 'marlowe-cologne', cat: 'skin', brand: 'Marlowe', productName: 'Eau de Cologne', size: '50 ml', price: 32, line: 'Vetiver, bergamot and oak' },
];

/** shop-data.js FEATURED — the six on the counter. */
export const HERITAGE_FEATURED_PRODUCT_SITE_IDS = [
  'oakmoss-firm-pomade',
  'kestrel-matte-clay',
  'corvid-fibre-paste',
  'halden-sea-salt-spray',
  'barrow-beard-oil',
  'ashgrove-beard-balm',
] as const;

const FEATURED_PRODUCT_SET = new Set<string>(HERITAGE_FEATURED_PRODUCT_SITE_IDS);

const POMADES_AND_CLAYS = new Set([
  'oakmoss-firm-pomade',
  'kestrel-matte-clay',
  'corvid-fibre-paste',
  'hollowmere-texture-powder',
  'blackthorn-styling-cream',
  'harrow-oil-pomade',
]);
const HAIR_WASH = new Set(['old-quarry-shampoo', 'fenwick-conditioner', 'ashdown-thickening-shampoo']);
const TOOLS = new Set([
  'wren-pocket-comb',
  'ashby-hair-brush',
  'hartwell-beard-comb',
  'oxley-beard-brush',
  'sheffield-beard-scissors',
  'kingsley-razor-blades',
  'brackley-shaving-stand',
  'pemberton-shaving-brush',
  'thornbury-safety-razor',
]);

/** Maps the site's shelves onto KERSIVO's retail categories. */
export function heritageProductCategory(draft: Pick<ProductDraft, 'siteId' | 'cat'>): ProductCategory {
  if (TOOLS.has(draft.siteId)) return 'TOOLS';
  if (POMADES_AND_CLAYS.has(draft.siteId)) return 'POMADES_AND_CLAYS';
  if (HAIR_WASH.has(draft.siteId)) return 'HAIR_WASH';
  if (draft.cat === 'hair') return 'STYLING';
  if (draft.cat === 'beard') return 'BEARD_CARE';
  return 'SHAVE_AND_SKIN';
}

export const HERITAGE_PRODUCTS: readonly HeritageProduct[] = PRODUCT_DRAFTS.map((draft, index) => ({
  siteId: draft.siteId,
  id: `hg-product-${draft.siteId}`,
  cat: draft.cat,
  brand: draft.brand,
  productName: draft.productName,
  name: `${draft.brand} ${draft.productName}`,
  size: draft.size,
  price: draft.price,
  pricePence: draft.price * 100,
  line: draft.line,
  description: draft.desc ?? `${draft.line}. ${draft.size}.`,
  imageSrc: `${HERITAGE_ASSET_BASE}/featured/${draft.siteId}.webp`,
  category: heritageProductCategory(draft),
  featured: FEATURED_PRODUCT_SET.has(draft.siteId),
  sortOrder: index,
}));

export function getHeritageBarber(id: string): HeritageBarber | undefined {
  return HERITAGE_BARBERS.find((row) => row.id === id || row.siteId === id);
}

export function getHeritageService(id: string): HeritageService | undefined {
  return HERITAGE_SERVICES.find((row) => row.id === id || row.siteId === id);
}

export function getHeritageProduct(id: string): HeritageProduct | undefined {
  return HERITAGE_PRODUCTS.find((row) => row.id === id || row.siteId === id);
}
