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
      breadcrumbItem(2, 'Retail Demo', '/shop'),
    ],
  };
}

/** Public demo PDP: breadcrumbs only — no Product/Offer (simulation, not a real sale). */
export function buildDemoProductBreadcrumbJsonLd(productName: string, productPath: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      breadcrumbItem(1, 'Home', '/'),
      breadcrumbItem(2, 'Retail Demo', '/shop'),
      breadcrumbItem(3, productName, productPath),
    ],
  };
}

function resolveImageUrl(imageUrl?: string | null): string | undefined {
  if (!imageUrl) return undefined;
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith('/')) return buildAbsoluteUrl(imageUrl);
  return undefined;
}

export function buildProductPageJsonLd(input: ProductJsonLdInput): Record<string, unknown>[] {
  const productPath = `/shop/demo/${input.id}`;
  const productUrl = buildAbsoluteUrl(productPath);
  const image = resolveImageUrl(input.imageUrl);

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

  return [product, buildDemoProductBreadcrumbJsonLd(input.name, productPath)];
}

type TenantProductJsonLdInput = ProductJsonLdInput & {
  shopId: string;
  shopName: string;
};

export function buildTenantShopItemListJsonLd(input: {
  shopId: string;
  shopName: string;
  products: Array<{ id: string; name: string }>;
}): Record<string, unknown> {
  const shopPath = `/shop/${input.shopId}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${input.shopName} shop`,
    url: buildAbsoluteUrl(shopPath),
    numberOfItems: input.products.length,
    itemListElement: input.products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: product.name,
      url: buildAbsoluteUrl(`${shopPath}/${product.id}`),
    })),
  };
}

export function buildTenantProductPageJsonLd(input: TenantProductJsonLdInput): Record<string, unknown>[] {
  const productPath = `/shop/${input.shopId}/${input.id}`;
  const productUrl = buildAbsoluteUrl(productPath);
  const image = resolveImageUrl(input.imageUrl);

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
      name: input.shopName,
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

  return [
    product,
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        breadcrumbItem(1, input.shopName, `/shop/${input.shopId}`),
        breadcrumbItem(2, input.name, productPath),
      ],
    },
  ];
}
