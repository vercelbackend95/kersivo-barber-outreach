// The shelf: every product sold over the counter at Heritage Grooming: the makers the barbers stock, each with its
// own photograph (assets/img/featured/<id>.webp, shown exactly as generated: cream paper ground, never cut out or edited).
// Every brand here is FICTITIOUS, invented for the preview; names, sizes, prices, scents and the hold / shine scores are
// ASSUMED (data-assumed on the page): replace with the shop's own.

export const CATS = [
  { id: 'hair',  name: 'Hair',  no: '01', shown: ['oakmoss-firm-pomade'],                          kinds: 'pomade, clay, spray, shampoo' },
  { id: 'beard', name: 'Beard', no: '02', shown: ['barrow-beard-oil', 'ashgrove-beard-balm'],      kinds: 'oil, balm, wash, comb' },
  { id: 'shave', name: 'Shave', no: '03', shown: ['thornbury-safety-razor', 'copperleaf-shaving-soap'], kinds: 'soap, razor, brush, balm' },
  { id: 'skin',  name: 'Skin',  no: '04', shown: ['harbour-lane-moisturiser', 'bramble-clay-mask'],   kinds: 'wash, mask, moisturiser' },
];

// the hair shelf is the biggest, so its tile splits it by kind: each chip previews its own photo and lowest price,
// and marks its products in the grid. `ids` must cover every hair product in SHOP (tools/build-shop.mjs checks).
export const HAIR_TYPES = [
  { id: 'pomade',  name: 'Pomade',  photo: 'oakmoss-firm-pomade',   ids: ['oakmoss-firm-pomade', 'blackthorn-styling-cream', 'harrow-oil-pomade'] },
  { id: 'clay',    name: 'Clay',    photo: 'kestrel-matte-clay',    ids: ['kestrel-matte-clay', 'corvid-fibre-paste', 'hollowmere-texture-powder'] },
  { id: 'spray',   name: 'Spray',   photo: 'halden-sea-salt-spray', ids: ['halden-sea-salt-spray', 'saltmarsh-hair-tonic'] },
  { id: 'shampoo', name: 'Shampoo', photo: 'old-quarry-shampoo',    ids: ['old-quarry-shampoo', 'fenwick-conditioner', 'ashdown-thickening-shampoo'] },
  { id: 'comb',    name: 'Combs',   photo: 'wren-pocket-comb',      ids: ['wren-pocket-comb', 'ashby-hair-brush'] },
];
export const typeOf = (id) => HAIR_TYPES.find((t) => t.ids.includes(id))?.id;

// Featured makers: the brands the barbers stock. Those with a photo are on sale (PRODUCTS); `photo: false` ones wait for
// their photograph (prompts in tools/featured-prompts.json) and stay off the page until it is dropped in and the flag removed.
// The hair stylers carry `hold` and `shine` (0..5) for the "Which pomade" picker; the counter's six carry `desc` and `scent`.
export const COUNTER = [
  { id: 'oakmoss-firm-pomade',       cat: 'hair',  brand: 'Oakmoss & Iron',     name: 'Firm Pomade',       size: '100 ml',   price: 18, line: 'Firm hold, low shine', hold: 4, shine: 3,
    desc: 'Water-based, so it rinses out with plain water. Holds a side parting or a slick-back from the morning to the evening.',
    scent: 'Vetiver and tobacco leaf' },
  { id: 'kestrel-matte-clay',        cat: 'hair',  brand: 'Kestrel Supply Co.', name: 'Matte Clay',        size: '75 g',     price: 19, line: 'Strong hold, matte finish', hold: 5, shine: 0.5,
    desc: 'Kaolin clay for texture that looks like nothing is in it. The one we use on short crops and messy fringes.',
    scent: 'Cedar and sage' },
  { id: 'corvid-fibre-paste',        cat: 'hair',  brand: 'Corvid & Co.',       name: 'Fibre Paste',       size: '85 g',     price: 17, line: 'Pliable hold, natural finish', hold: 3, shine: 2,
    desc: 'A stretchy paste that works through longer hair and can be restyled with the fingers through the day.',
    scent: 'Neroli and green tea' },
  { id: 'halden-sea-salt-spray',     cat: 'hair',  brand: 'Halden Brothers',    name: 'Sea Salt Spray',    size: '200 ml',   price: 16, line: 'Texture and volume', hold: 1.5, shine: 1,
    desc: 'A few sprays into damp hair before the dryer. Gives fine hair body and a loose, worn-in texture.',
    scent: 'Sea salt and citrus' },
  { id: 'hollowmere-texture-powder', cat: 'hair',  brand: 'Hollowmere',         name: 'Texture Powder',    size: '20 g',     price: 14, line: 'Lift at the root', hold: 2, shine: 0.2 },
  { id: 'saltmarsh-hair-tonic',      cat: 'hair',  brand: 'Saltmarsh',          name: 'Hair Tonic',        size: '250 ml',   price: 21, line: 'Daily tonic for the scalp' },
  { id: 'old-quarry-shampoo',        cat: 'hair',  brand: 'Old Quarry',         name: 'Daily Shampoo',     size: '300 ml',   price: 15, line: 'Gentle everyday wash' },
  { id: 'fenwick-conditioner',       cat: 'hair',  brand: 'Fenwick & Vale',     name: 'Conditioner',       size: '300 ml',   price: 15, line: 'Softens without weight' },
  { id: 'barrow-beard-oil',          cat: 'beard', brand: 'Barrow & Pike',      name: 'Beard Oil',         size: '30 ml',    price: 20, line: 'Softens the beard and the skin',
    desc: 'Three drops a day softens the beard and stops the itch on the skin underneath. What we finish every beard trim with.',
    scent: 'Cedarwood and bergamot' },
  { id: 'ashgrove-beard-balm',       cat: 'beard', brand: 'Ashgrove',           name: 'Beard Balm',        size: '60 ml',    price: 18, line: 'Shapes and conditions',
    desc: 'Holds stray hairs in place and shapes the moustache. Warm a little between the fingers first.',
    scent: 'Sandalwood' },
  { id: 'blackthorn-styling-cream',  cat: 'hair',  brand: 'Blackthorn',         name: 'Styling Cream',     size: '100 ml',   price: 17, line: 'Light hold, soft shine', hold: 2, shine: 2.5 },
  { id: 'wren-pocket-comb',          cat: 'hair',  brand: 'Wren & Hollis',      name: 'Pocket Comb',       size: 'Acetate',  price: 12, line: 'Hand-cut, fits a shirt pocket' },
  { id: 'ashby-hair-brush',          cat: 'hair',  brand: 'Ashby',              name: 'Boar Bristle Brush', size: 'Beech',   price: 26, line: 'Smooths and spreads product' },
  { id: 'harrow-oil-pomade',         cat: 'hair',  brand: 'Harrow',             name: 'Oil Pomade',        size: '100 g',    price: 18, line: 'Medium hold, high shine', hold: 3, shine: 4.5 },
  { id: 'ashdown-thickening-shampoo', cat: 'hair', brand: 'Ashdown',            name: 'Thickening Shampoo', size: '250 ml',  price: 17, line: 'Body for fine hair' },
  { id: 'tanners-moustache-wax',     cat: 'beard', brand: "Tanner's Row",       name: 'Moustache Wax',     size: '15 g',     price: 11, line: 'Holds a curl all day' },
  { id: 'merrow-beard-wash',         cat: 'beard', brand: 'Merrow',             name: 'Beard Wash',        size: '150 ml',   price: 16, line: 'Cleans without drying' },
  { id: 'hartwell-beard-comb',       cat: 'beard', brand: 'Hartwell',           name: 'Beard Comb',        size: 'Pearwood', price: 14, line: 'Fine and wide teeth' },
  { id: 'oxley-beard-brush',         cat: 'beard', brand: 'Oxley',              name: 'Beard Brush',       size: 'Walnut',   price: 22, line: 'Trains the beard into shape' },
  { id: 'ferris-beard-conditioner',  cat: 'beard', brand: 'Ferris',             name: 'Beard Conditioner', size: '100 ml',   price: 18, line: 'Leave-in, softens coarse hair' },
  { id: 'linden-beard-butter',       cat: 'beard', brand: 'Linden',             name: 'Beard Butter',      size: '50 g',     price: 15, line: 'Shea and cocoa, light hold' },
  { id: 'sheffield-beard-scissors',  cat: 'beard', brand: 'Sheffield',          name: 'Beard Scissors',    size: 'Steel',    price: 28, line: 'Short blades for the moustache' },
  { id: 'copperleaf-shaving-soap',   cat: 'shave', brand: 'Copperleaf',         name: 'Shaving Soap',      size: '110 g',    price: 22, line: 'Rich lather in a walnut bowl' },
  { id: 'northwick-shaving-cream',   cat: 'shave', brand: 'Northwick',          name: 'Shaving Cream',     size: '150 ml',   price: 19, line: 'Cushioning for a close shave' },
  { id: 'ludlow-pre-shave-oil',      cat: 'shave', brand: 'Ludlow',             name: 'Pre-shave Oil',     size: '50 ml',    price: 17, line: 'Softens stubble before the blade' },
  { id: 'greyfriars-aftershave',     cat: 'shave', brand: 'Greyfriars',         name: 'Aftershave Tonic',  size: '100 ml',   price: 24, line: 'Cools and closes the skin' },
  { id: 'aldridge-post-shave-balm',  cat: 'shave', brand: 'Aldridge',           name: 'Post-shave Balm',   size: '100 ml',   price: 21, line: 'Calms razor burn' },
  { id: 'kerne-alum-block',          cat: 'shave', brand: 'Kerne',              name: 'Alum Block',        size: '75 g',     price: 10, line: 'Stops nicks, tones the skin' },
  { id: 'kingsley-razor-blades',     cat: 'shave', brand: 'Kingsley',           name: 'Razor Blades',      size: '10 blades', price: 8, line: 'Double-edge refills' },
  { id: 'brackley-shaving-stand',    cat: 'shave', brand: 'Brackley',           name: 'Shaving Stand',     size: 'Brass',    price: 24, line: 'Dries the brush, holds the razor' },
  { id: 'pemberton-shaving-brush',   cat: 'shave', brand: 'Pemberton',          name: 'Badger Brush',      size: 'Rosewood', price: 38, line: 'Whips soap into lather' },
  { id: 'thornbury-safety-razor',    cat: 'shave', brand: 'Thornbury',          name: 'Safety Razor',      size: 'Brass',    price: 45, line: 'Double-edge, built to last' },
  { id: 'ravensworth-face-wash',     cat: 'skin',  brand: 'Ravensworth',        name: 'Face Wash',         size: '150 ml',   price: 16, line: 'Daily wash for every skin' },
  { id: 'elmstead-face-scrub',       cat: 'skin',  brand: 'Elmstead',           name: 'Charcoal Scrub',    size: '100 ml',   price: 14, line: 'Clears ingrown hairs' },
  { id: 'bramble-clay-mask',         cat: 'skin',  brand: 'Bramble',            name: 'Clay Mask',         size: '100 ml',   price: 22, line: 'Weekly deep clean' },
  { id: 'harbour-lane-moisturiser',  cat: 'skin',  brand: 'Harbour Lane',       name: 'Daily Moisturiser', size: '75 ml',    price: 20, line: 'Light, absorbs fast' },
  { id: 'cobbold-lip-balm',          cat: 'skin',  brand: 'Cobbold',            name: 'Lip Balm',          size: '15 ml',    price: 7,  line: 'Beeswax for wind and cold' },
  { id: 'saltash-body-wash',         cat: 'skin',  brand: 'Saltash',            name: 'Body Wash',         size: '250 ml',   price: 14, line: 'Cedar and sea salt' },
  { id: 'grantley-eye-balm',         cat: 'skin',  brand: 'Grantley',           name: 'Eye Balm',          size: '15 ml',    price: 19, line: 'Cools tired eyes' },
  { id: 'westerly-bar-soap',         cat: 'skin',  brand: 'Westerly',           name: 'Bar Soap',          size: '150 g',    price: 9,  line: 'Oatmeal, made by hand' },
  { id: 'marlowe-cologne',           cat: 'skin',  brand: 'Marlowe',            name: 'Eau de Cologne',    size: '50 ml',    price: 32, line: 'Vetiver, bergamot and oak' },
];

// everything on sale: the makers that have their photo
export const PRODUCTS = COUNTER.filter((p) => p.photo !== false);
export const SHOP = PRODUCTS;

// the six on the counter (the pinned row), from the hair and beard shelves
export const FEATURED = ['oakmoss-firm-pomade', 'kestrel-matte-clay', 'corvid-fibre-paste', 'halden-sea-salt-spray', 'barrow-beard-oil', 'ashgrove-beard-balm'];

export const byId = (id) => COUNTER.find((p) => p.id === id);
// the packshot for any product (pending.svg until a maker's photo is in)
export const imgOf = (p) => `assets/img/featured/${p.photo === false ? 'pending.svg' : `${p.id}.webp`}`;
// the bag's line label carries the maker's name
export const labelOf = (p) => `${p.brand} ${p.name}`;
export const money = (n) => `£${n % 1 ? n.toFixed(2) : n}`;
