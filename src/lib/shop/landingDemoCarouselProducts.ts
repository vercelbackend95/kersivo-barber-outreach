import {
  expandCarouselProducts,
  type CarouselProduct,
} from '@/lib/shop/carouselProducts';

const LANDING_DEMO_PRODUCTS: CarouselProduct[] = [
  {
    id: 'landing-demo-matte-clay',
    name: 'Matte Clay',
    category: 'POMADES_AND_CLAYS',
    pricePence: 1600,
    imageUrl: null,
  },
  {
    id: 'landing-demo-sea-salt-spray',
    name: 'Sea Salt Spray',
    category: 'STYLING',
    pricePence: 1400,
    imageUrl: null,
  },
  {
    id: 'landing-demo-beard-oil',
    name: 'Beard Oil',
    category: 'BEARD_CARE',
    pricePence: 1800,
    imageUrl: null,
  },
  {
    id: 'landing-demo-styling-powder',
    name: 'Styling Powder',
    category: 'STYLING',
    pricePence: 1500,
    imageUrl: null,
  },
  {
    id: 'landing-demo-pomade',
    name: 'Pomade',
    category: 'POMADES_AND_CLAYS',
    pricePence: 1700,
    imageUrl: null,
  },
];

export function getLandingDemoCarouselProducts(): CarouselProduct[] {
  return expandCarouselProducts(LANDING_DEMO_PRODUCTS);
}
