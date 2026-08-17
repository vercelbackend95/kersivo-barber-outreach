// src/lib/shop/cartStore.ts
export const CART_STORAGE_KEY = 'kersivo_shop_cart_v2';

export function cartStorageKeyForShop(shopId?: string | null): string {
  const id = shopId?.trim();
  if (!id) return CART_STORAGE_KEY;
  return `${CART_STORAGE_KEY}:${id}`;
}

export type CartItem = {
  productId: string;
  name: string;
  pricePence: number;
  imageUrl?: string;
  quantity: number;
};

export type AddCartItemInput = {
  productId: string;
  name: string;
  pricePence: number;
  imageUrl?: string;
  quantity?: number;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
};

export type CartSnapshot = {
  items: CartItem[];
  isOpen: boolean;
  subtotalPence: number;
};

type CartStoreSingleton = {
  state: CartState;
  clientSnapshot: CartSnapshot;
  listeners: Set<() => void>;
  isHydrated: boolean;
  storageListenerBound: boolean;
  storageKey: string;
  allowedProductIds: Set<string> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __KERSIVO_CART_STORE__: CartStoreSingleton | undefined;
  interface Window {
    __KERSIVO_CART_NAMESPACE__?: {
      shopId?: string | null;
      allowedProductIds?: readonly string[];
    };
  }
}

const SERVER_SNAPSHOT: CartSnapshot = Object.freeze({
  items: [],
  isOpen: false,
  subtotalPence: 0,
});

const store: CartStoreSingleton =
  globalThis.__KERSIVO_CART_STORE__ ??
  {
    state: {
      items: [],
      isOpen: false,
    },
    clientSnapshot: SERVER_SNAPSHOT,
    listeners: new Set<() => void>(),
    isHydrated: false,
    storageListenerBound: false,
    storageKey: CART_STORAGE_KEY,
    allowedProductIds: null,
  };

store.storageKey ??= CART_STORAGE_KEY;
store.allowedProductIds ??= null;

globalThis.__KERSIVO_CART_STORE__ = store;

function emitChange() {
  store.clientSnapshot = {
    items: store.state.items,
    isOpen: store.state.isOpen,
    subtotalPence: store.state.items.reduce((sum, item) => sum + item.pricePence * item.quantity, 0),
  };

  for (const listener of store.listeners) {
    listener();
  }
}

function toSafeItem(item: Partial<CartItem>): CartItem | null {
  const productId = String(item.productId ?? '').trim();
  const name = String(item.name ?? '').trim();
  const pricePence = Math.max(0, Math.floor(Number(item.pricePence ?? 0)));
  const quantity = Math.max(1, Math.floor(Number(item.quantity ?? 1)));

  if (!productId || !name) {
    return null;
  }

  return {
    productId,
    name,
    pricePence,
    imageUrl: item.imageUrl ? String(item.imageUrl) : undefined,
    quantity,
  };
}

function filterAllowed(items: CartItem[]): CartItem[] {
  if (!store.allowedProductIds) return items;
  return items.filter((item) => store.allowedProductIds?.has(item.productId));
}

function readFromStorage(): CartItem[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(store.storageKey) ?? '[]') as Partial<CartItem>[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return filterAllowed(parsed.map((item) => toSafeItem(item)).filter((item): item is CartItem => Boolean(item)));
  } catch {
    return [];
  }
}

function writeToStorage(items: CartItem[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(store.storageKey, JSON.stringify(items));
}

function applyDocumentNamespace() {
  if (typeof window === 'undefined') {
    return;
  }

  const pending = window.__KERSIVO_CART_NAMESPACE__;
  if (!pending?.shopId) {
    return;
  }

  store.storageKey = cartStorageKeyForShop(pending.shopId);
  store.allowedProductIds = pending.allowedProductIds ? new Set(pending.allowedProductIds) : null;
}

function ensureHydrated() {
  if (typeof window === 'undefined' || store.isHydrated) {
    return;
  }

  applyDocumentNamespace();
  store.state.items = readFromStorage();
  store.isHydrated = true;

  emitChange();

  if (!store.storageListenerBound) {
    window.addEventListener('storage', (event) => {
      if (event.key !== store.storageKey) {
        return;
      }
      store.state.items = readFromStorage();
      emitChange();
    });
    store.storageListenerBound = true;
  }
}

function updateItems(nextItems: CartItem[]) {
  store.state.items = nextItems;
  writeToStorage(store.state.items);

  emitChange();
}

export function bindCartNamespace(options?: {
  shopId?: string | null;
  allowedProductIds?: readonly string[];
}) {
  const nextKey = cartStorageKeyForShop(options?.shopId);
  const nextAllowed = options?.allowedProductIds ? new Set(options.allowedProductIds) : null;
  const keyChanged = store.storageKey !== nextKey;
  store.storageKey = nextKey;
  store.allowedProductIds = nextAllowed;

  if (typeof window === 'undefined') {
    return;
  }

  if (!store.isHydrated) {
    return;
  }

  if (keyChanged) {
    store.state.items = readFromStorage();
    writeToStorage(store.state.items);
    emitChange();
    return;
  }

  const filtered = filterAllowed(store.state.items);
  if (filtered.length !== store.state.items.length) {
    updateItems(filtered);
  }
}

export function subscribe(listener: () => void) {
  ensureHydrated();
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

export function getSnapshot(): CartSnapshot {
  ensureHydrated();
  return store.clientSnapshot;
}

export function getServerSnapshot(): CartSnapshot {
  return SERVER_SNAPSHOT;
}

export function getItems() {
  ensureHydrated();
  return store.state.items;
}

export function getItemCount() {
  ensureHydrated();
  return store.state.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function addItem(input: AddCartItemInput) {
  ensureHydrated();

  const safeProductId = String(input.productId).trim();
  const safeName = String(input.name).trim();
  const safePrice = Math.max(0, Math.floor(Number(input.pricePence)));
  const quantity = Math.max(1, Math.floor(Number(input.quantity ?? 1)));

  if (!safeProductId || !safeName) {
    return;
  }

  if (store.allowedProductIds && !store.allowedProductIds.has(safeProductId)) {
    return;
  }

  const existingIndex = store.state.items.findIndex((item) => item.productId === safeProductId);
  if (existingIndex === -1) {
    updateItems([
      ...store.state.items,
      {
        productId: safeProductId,
        name: safeName,
        pricePence: safePrice,
        imageUrl: input.imageUrl,
        quantity,
      },
    ]);
    return;
  }

  const nextItems = [...store.state.items];
  nextItems[existingIndex] = {
    ...nextItems[existingIndex],
    name: safeName,
    pricePence: safePrice,
    imageUrl: input.imageUrl ?? nextItems[existingIndex].imageUrl,
    quantity: nextItems[existingIndex].quantity + quantity,
  };
  updateItems(nextItems);
}

export function removeItem(productId: string) {
  ensureHydrated();
  updateItems(store.state.items.filter((item) => item.productId !== productId));
}

export function setQuantity(productId: string, quantity: number) {
  ensureHydrated();
  const nextQuantity = Math.floor(Number(quantity));
  const nextItems = [...store.state.items];
  const itemIndex = nextItems.findIndex((item) => item.productId === productId);
  if (itemIndex === -1) {
    return;
  }

  if (nextQuantity <= 0) {
    nextItems.splice(itemIndex, 1);
    updateItems(nextItems);
    return;
  }

  nextItems[itemIndex] = {
    ...nextItems[itemIndex],
    quantity: nextQuantity,
  };
  updateItems(nextItems);
}

export function clear() {
  ensureHydrated();
  updateItems([]);
}

export function getSubtotalPence() {
  ensureHydrated();
  return store.state.items.reduce((sum, item) => sum + item.pricePence * item.quantity, 0);
}

export function openCart() {
  ensureHydrated();
  store.state.isOpen = true;
  emitChange();
}

export function closeCart() {
  ensureHydrated();
  store.state.isOpen = false;
  emitChange();
}

export function isOpen() {
  ensureHydrated();
  return store.state.isOpen;
}
