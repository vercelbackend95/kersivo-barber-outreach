export const CART_STORAGE_KEY = 'kersivo_shop_cart_v2';


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

const state: CartState = {
  items: [],
  isOpen: false
};


const listeners = new Set<() => void>();
let isHydrated = false;
let storageListenerBound = false;

function emitChange() {
  for (const listener of listeners) {
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
    quantity
  };
}

function readFromStorage(): CartItem[] {
  if (typeof window === 'undefined') {
    return [];
  }


  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '[]') as Partial<CartItem>[];
    if (!Array.isArray(parsed)) {
      return [];
    }


    return parsed
      .map((item) => toSafeItem(item))
      .filter((item): item is CartItem => Boolean(item));

  } catch {
    return [];
  }
}

function writeToStorage(items: CartItem[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));

}

function ensureHydrated() {
  if (typeof window === 'undefined' || isHydrated) {
    return;

  }
  
  state.items = readFromStorage();
  isHydrated = true;

  if (!storageListenerBound) {
    window.addEventListener('storage', (event) => {
      if (event.key !== CART_STORAGE_KEY) {
        return;
      }
      state.items = readFromStorage();
      emitChange();
    });
    storageListenerBound = true;
  }
}

function updateItems(nextItems: CartItem[]) {
  state.items = nextItems;
  writeToStorage(state.items);
  emitChange();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getItems() {
  ensureHydrated();
  return state.items;
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

  const existingIndex = state.items.findIndex((item) => item.productId === safeProductId);
  if (existingIndex === -1) {
    updateItems([
      ...state.items,
      {
        productId: safeProductId,
        name: safeName,
        pricePence: safePrice,
        imageUrl: input.imageUrl,
        quantity
      }
    ]);
    return;
  }

  const nextItems = [...state.items];
  nextItems[existingIndex] = {
    ...nextItems[existingIndex],
    name: safeName,
    pricePence: safePrice,
    imageUrl: input.imageUrl ?? nextItems[existingIndex].imageUrl,
    quantity: nextItems[existingIndex].quantity + quantity
  };
  updateItems(nextItems);

}

export function removeItem(productId: string) {
  ensureHydrated();
  updateItems(state.items.filter((item) => item.productId !== productId));

}

export function setQuantity(productId: string, quantity: number) {
  ensureHydrated();
  const nextQuantity = Math.floor(Number(quantity));
  const nextItems = [...state.items];
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
    quantity: nextQuantity
  };
  updateItems(nextItems);
}

export function clear() {
  ensureHydrated();
  updateItems([]);

}

export function getSubtotalPence() {
  ensureHydrated();
  return state.items.reduce((sum, item) => sum + item.pricePence * item.quantity, 0);

}

export function openCart() {
  ensureHydrated();
  state.isOpen = true;
  emitChange();

}

export function closeCart() {
  ensureHydrated();
  state.isOpen = false;
  emitChange();

}

export function isOpen() {
  ensureHydrated();
  return state.isOpen;

}
