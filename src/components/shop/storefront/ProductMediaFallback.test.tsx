/**
 * @vitest-environment jsdom
 */
import React from 'react';
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
});
