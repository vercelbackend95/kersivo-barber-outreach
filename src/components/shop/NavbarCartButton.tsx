import { openCart, useCartSummary } from '@/lib/shop/cartStore';

type NavbarCartButtonProps = {
  className?: string;
};

export default function NavbarCartButton({ className }: NavbarCartButtonProps) {
  const { itemCount } = useCartSummary();

  const handleClick = () => {
    if (import.meta.env.DEV) {
      console.log('NAVBAR CART CLICK');
    }
    openCart();
  };

  return (
    <button type="button" className={className} onClick={handleClick} aria-label="Open cart">
      <span aria-hidden="true">🛒</span>
      <span>Cart</span>
      <span className={`navbar17__cart-badge ${itemCount === 0 ? 'is-empty' : ''}`}>{itemCount}</span>
    </button>
  );
}
