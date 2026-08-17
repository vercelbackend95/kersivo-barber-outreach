export const prerender = false;

import type { APIRoute } from 'astro';
import { getBlacklineRetailProducts } from '@/lib/demo/blacklineShop';
import { BLACKLINE_MAX_QUANTITY } from '@/lib/demo/products';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';
import {
  normalizeRetailCartItems,
  resolveRetailCartFromProducts,
} from '@/lib/shop/resolveRetailCart';

type CompleteInput = {
  items?: Array<{ productId?: unknown; quantity?: unknown }>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async (ctx) => {
  const limited = await enforceIpRateLimit(ctx.request, 'blackline_shop_complete', 10, 15 * 60 * 1000);
  if (limited) return limited;

  const body = (await ctx.request.json().catch(() => null)) as CompleteInput | null;
  const requestedItems = normalizeRetailCartItems(body?.items);
  const products = await getBlacklineRetailProducts();
  const resolved = resolveRetailCartFromProducts(
    products.map((product) => ({
      id: product.id,
      name: product.name,
      pricePence: product.pricePence,
      imageUrl: product.image.src,
      active: product.active,
    })),
    requestedItems,
    {
      maxQuantity: BLACKLINE_MAX_QUANTITY,
      emptyError: 'Your bag is empty. Add products before completing the demo.',
    },
  );

  if (!resolved.ok) {
    return json({ error: resolved.error }, 400);
  }

  return json({
    ok: true,
    order: {
      items: resolved.cart.items,
      totalPence: resolved.cart.totalPence,
      collectionMethod: 'Collect in shop',
      createdAt: new Date().toISOString(),
    },
  });
};
