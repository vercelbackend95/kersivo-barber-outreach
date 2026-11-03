/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HubLogoMark, __resetHubLogoMarkForTests } from './HubLogoMark';

function pixels(fill: (x: number, y: number) => [number, number, number, number], width = 10, height = 10) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data.set(fill(x, y), (y * width + x) * 4);
  }
  return { data, width, height };
}

/** jsdom has no canvas: stub getContext so the component reads the given pixels. */
function stubCanvas(image: ReturnType<typeof pixels> | 'throws') {
  return vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({
    drawImage: () => undefined,
    getImageData: () => {
      if (image === 'throws') throw new DOMException('tainted', 'SecurityError');
      return image;
    },
  })) as unknown as HTMLCanvasElement['getContext']);
}

function loaded(img: HTMLImageElement) {
  Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 480 });
  Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 240 });
  act(() => {
    img.dispatchEvent(new Event('load'));
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  __resetHubLogoMarkForTests();
});

describe('HubLogoMark', () => {
  it('server-renders one plain img with its intrinsic size and no plate', () => {
    const html = renderToString(<HubLogoMark src="/logo.webp" width={480} height={240} maxHeight="64px" />);
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toContain('width="480"');
    expect(html).toContain('height="240"');
    expect(html).toContain('alt=""');
    expect(html).toContain('data-look="plain"');
    expect(html).not.toContain('hub-logo-mark--plate');
    // Definite box before load: never wider than natural, as tall as maxHeight allows.
    expect(html).toContain('width:min(calc(64px * 2), 480px)');
    expect(html).toContain('aspect-ratio:480 / 240');
  });

  it('an opaque logo (its own background) gets rounded corners, never a plate', () => {
    stubCanvas(pixels(() => [12, 12, 13, 255]));
    const { container } = render(<HubLogoMark src="/opaque.webp" width={480} height={240} maxHeight="64px" />);
    const img = container.querySelector('img')!;
    loaded(img);
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(img.getAttribute('data-look')).toBe('opaque');
    expect(img.classList.contains('hub-logo-mark--plate')).toBe(false);
  });

  it('a black logo on transparency gets the light plate', () => {
    stubCanvas(pixels((x, y) => (x > 2 && x < 7 && y > 2 && y < 7 ? [0, 0, 0, 255] : [0, 0, 0, 0])));
    const { container } = render(<HubLogoMark src="/black.webp" width={480} height={240} maxHeight="64px" />);
    const img = container.querySelector('img')!;
    loaded(img);
    expect(img.classList.contains('hub-logo-mark--plate')).toBe(true);
  });

  it('stays plain when the canvas is tainted', () => {
    stubCanvas('throws');
    const { container } = render(<HubLogoMark src="/tainted.webp" width={480} height={240} maxHeight="64px" />);
    const img = container.querySelector('img')!;
    loaded(img);
    expect(img.getAttribute('data-look')).toBe('plain');
  });
});
