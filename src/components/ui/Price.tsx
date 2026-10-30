import { cn } from '@/lib/utils';
import '@/styles/components/price.css';

type PriceSize = 'md' | 'lg' | 'xl';

export interface PriceProps {
  /** Pounds, without the £ sign. Rendered as £39/month with no space around the slash. */
  amount: number | string;
  /** Optional line under the price, such as "per location". */
  qualifier?: string;
  size?: PriceSize;
  className?: string;
  amountClassName?: string;
}

export function Price({ amount, qualifier, size = 'lg', className, amountClassName }: PriceProps) {
  return (
    <span className={cn('price', `price--${size}`, className)}>
      <span className={cn('price__amount', amountClassName)}>£{amount}</span>
      <span className="price__period">/month</span>
      {qualifier ? <span className="price__qualifier">{qualifier}</span> : null}
    </span>
  );
}
