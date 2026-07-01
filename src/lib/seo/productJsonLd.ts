import { buildAbsoluteUrl } from './meta';
import { SITE_NAME } from './defaults';

type ProductJsonLdInput = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  pricePence: number;
  inStock: boolean;
};

function breadcrumbItem(position: number, name: string, path: string) {
  return {
    '@type': 'ListItem',
    position,
    name,
    item: buildAbsoluteUrl(path),
  };
}

export function buildShopBreadcrumbJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      breadcrumbItem(1, 'Home', '/'),
      breadcrumbItem(2, 'Shop', '/shop'),
    ],
  };
}

export function buildProductPageJsonLd(input: ProductJsonLdInput): Record<string, unknown>[] {
  const productPath = `/shop/${input.id}`;
  const productUrl = buildAbsoluteUrl(productPath);
  const image =
    input.imageUrl && /^https?:\/\//.test(input.imageUrl)
      ? input.imageUrl
      : input.imageUrl?.startsWith('/')
        ? buildAbsoluteUrl(input.imageUrl)
        : undefined;

  const product: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name: input.name,
    description: input.description,
    sku: input.id,
    productID: input.id,
    brand: {
      '@type': 'Brand',
      name: SITE_NAME,
    },
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'GBP',
      price: (input.pricePence / 100).toFixed(2),
      availability: input.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };

  if (image) {
    product.image = image;
  }

  const breadcrumb: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      breadcrumbItem(1, 'Home', '/'),
      breadcrumbItem(2, 'Shop', '/shop'),
      breadcrumbItem(3, input.name, productPath),
    ],
  };

  return [product, breadcrumb];
}
