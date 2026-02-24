export const CART_STORAGE_KEY = 'kersivo_shop_cart_v2';
export const CART_OPEN_EVENT = 'kersivo:cart-open';
export const CART_CLOSE_EVENT = 'kersivo:cart-close';
export const CART_UPDATED_EVENT = 'kersivo:cart-updated';

export type CartItem = {
  productId: string;
  quantity: number;
};

let cartOpen = false;

function emit(eventName: string) {
  window.dispatchEvent(new CustomEvent(eventName));
}

export function readCart(): CartItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '[]') as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({ productId: String(item.productId), quantity: Math.max(0, Math.floor(item.quantity ?? 0)) }))
      .filter((item) => item.productId && item.quantity > 0);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  emit(CART_UPDATED_EVENT);
}

export function addItem(productId: string, qty = 1) {
  const quantity = Math.max(1, Math.floor(qty));
  const cart = readCart();
  const index = cart.findIndex((item) => item.productId === productId);
  if (index === -1) {
    cart.push({ productId, quantity });
  } else {
    cart[index].quantity += quantity;
  }
  writeCart(cart);
}

export function removeItem(productId: string) {
  writeCart(readCart().filter((item) => item.productId !== productId));
}

export function setQty(productId: string, qty: number) {
  const quantity = Math.floor(qty);
  const cart = readCart();
  const index = cart.findIndex((item) => item.productId === productId);
  if (index === -1) return;

  if (quantity <= 0) {
    cart.splice(index, 1);
  } else {
    cart[index].quantity = quantity;
  }
  writeCart(cart);
}

export function clearCart() {
  writeCart([]);
}

export function openCart() {
  cartOpen = true;
  emit(CART_OPEN_EVENT);
}

export function closeCart() {
  cartOpen = false;
  emit(CART_CLOSE_EVENT);
}

export function isCartOpen() {
  return cartOpen;
}
