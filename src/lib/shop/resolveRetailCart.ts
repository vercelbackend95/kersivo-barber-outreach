export const DEFAULT_MAX_CART_QUANTITY = 99;

export type RetailCartRequestItem = {
  productId: string;
  quantity: number;
};

export type RetailCatalogProduct = {
  id: string;
  name: string;
  pricePence: number;
  imageUrl?: string | null;
  active?: boolean;
};

export type ResolvedRetailCartItem = {
  productId: string;
  name: string;
  unitPricePence: number;
  quantity: number;
  lineTotalPence: number;
  imageUrl: string;
};

export type ResolvedRetailCart = {
  items: ResolvedRetailCartItem[];
  totalPence: number;
};

export type ResolveRetailCartResult =
  | { ok: true; cart: ResolvedRetailCart }
  | { ok: false; error: string };

export function normalizeRetailCartItems(
  raw: Array<{ productId?: unknown; quantity?: unknown }> | null | undefined,
): RetailCartRequestItem[] {
  return (raw ?? [])
    .map((item) => ({
      productId: String(item.productId ?? '').trim(),
      quantity: Math.floor(Number(item.quantity ?? 0)),
    }))
    .filter((item) => item.productId && item.quantity >= 1);
}

export function resolveRetailCartFromProducts(
  products: RetailCatalogProduct[],
  requestedItems: RetailCartRequestItem[],
  options?: { maxQuantity?: number; emptyError?: string },
): ResolveRetailCartResult {
  const maxQuantity = options?.maxQuantity ?? DEFAULT_MAX_CART_QUANTITY;
  const emptyError = options?.emptyError ?? 'Cart is empty.';

  if (requestedItems.length === 0) {
    return { ok: false, error: emptyError };
  }

  const quantityByProduct = new Map<string, number>();
  for (const item of requestedItems) {
    if (item.quantity > maxQuantity) {
      return { ok: false, error: 'Quantity is not available.' };
    }
    quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity);
  }

  for (const quantity of quantityByProduct.values()) {
    if (quantity > maxQuantity) {
      return { ok: false, error: 'Quantity is not available.' };
    }
  }

  const productById = new Map(
    products
      .filter((product) => product.active !== false)
      .map((product) => [product.id, product]),
  );

  if (productById.size !== quantityByProduct.size) {
    const missing = [...quantityByProduct.keys()].some((id) => !productById.has(id));
    if (missing) {
      return { ok: false, error: 'Some products are unavailable.' };
    }
  }

  const items: ResolvedRetailCartItem[] = [];
  for (const [productId, quantity] of quantityByProduct) {
    const product = productById.get(productId);
    if (!product) {
      return { ok: false, error: 'Some products are unavailable.' };
    }
    const unitPricePence = Math.max(0, Math.floor(Number(product.pricePence)));
    items.push({
      productId: product.id,
      name: product.name,
      unitPricePence,
      quantity,
      lineTotalPence: unitPricePence * quantity,
      imageUrl: product.imageUrl ?? '',
    });
  }

  const totalPence = items.reduce((sum, item) => sum + item.lineTotalPence, 0);
  if (totalPence <= 0) {
    return { ok: false, error: 'Cart total must be greater than zero.' };
  }

  return { ok: true, cart: { items, totalPence } };
}
