/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import ProductMediaFallback from './ProductMediaFallback';

describe('ProductMediaFallback', () => {
  it('renders product initials and alt text when src is empty', () => {
    const { getByRole, container } = render(
      <ProductMediaFallback
        image={{ src: '', alt: 'Shave Cream in the fictional BLACKLINE shop.' }}
        name="Shave Cream"
        shopName="BLACKLINE"
        fallback="wordmark"
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    const media = getByRole('img', { name: /shave cream in the fictional blackline shop/i });
    expect(media.querySelector('.sf-media-initial')?.textContent).toBe('SC');
    expect(media.querySelector('.sf-media-soon')?.textContent).toBe('Image coming soon');
    expect(media.querySelector('.sf-media-mark')?.textContent).toBe('BL');
  });

  it('uses a configurable brand mark for wordmark fallback', () => {
    const { getByRole } = render(
      <ProductMediaFallback
        image={{ src: '   ', alt: 'Pomade' }}
        name="Ironclad Pomade"
        shopName="KERSIVO"
        fallback="wordmark"
        brandMark="KV"
      />,
    );
    const media = getByRole('img', { name: /pomade/i });
    expect(media.querySelector('.sf-media-mark')?.textContent).toBe('KV');
  });

  it('renders a single full-bleed image for featured-product presentation', () => {
    const { container } = render(
      <ProductMediaFallback
        image={{
          src: '/demo/products/barber-wash.webp',
          alt: 'Barber Wash',
          focalPoint: { x: 50, y: 44 },
        }}
        name="Barber Wash"
        shopName="BLACKLINE"
        fallback="wordmark"
        presentation="featured-product"
        className="sf-featured-media"
      />,
    );
    expect(container.querySelector('.sf-featured-media-ambient')).toBeNull();
    expect(container.querySelector('.sf-featured-media-scrim')).toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(1);
    const product = container.querySelector('.sf-featured-media-product') as HTMLImageElement | null;
    expect(product?.alt).toBe('Barber Wash');
    const wrapper = container.querySelector('.sf-featured-media--product') as HTMLElement | null;
    expect(wrapper?.style.getPropertyValue('--sf-featured-object-position')).toBe('50% 44%');
  });

  it('defaults featured focal position to center when omitted', () => {
    const { container } = render(
      <ProductMediaFallback
        image={{ src: '/demo/products/pomade.webp', alt: 'Pomade' }}
        name="Pomade"
        shopName="BLACKLINE"
        fallback="wordmark"
        presentation="featured-product"
      />,
    );
    const wrapper = container.querySelector('.sf-featured-media--product') as HTMLElement | null;
    expect(wrapper?.style.getPropertyValue('--sf-featured-object-position')).toBe('50% 50%');
  });

  it('keeps a single image for the default presentation', () => {
    const { container } = render(
      <ProductMediaFallback
        image={{ src: '/demo/products/pomade.webp', alt: 'Pomade' }}
        name="Pomade"
        shopName="BLACKLINE"
        fallback="wordmark"
      />,
    );
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(container.querySelector('.sf-featured-media-ambient')).toBeNull();
    expect(container.querySelector('.sf-featured-media--product')).toBeNull();
  });
});
