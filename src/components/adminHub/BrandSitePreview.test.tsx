/**
 * @vitest-environment jsdom
 */
import { cleanup, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { betterButtonText, neutralHeroHex, siteBackgroundHex, sitePreviewColours } from '@/lib/adminHub/colour';
import { ADMIN_HUB_COLOURS_BOOK } from '@/lib/adminHub/copy';
import { BrandSitePreview, brandSiteSlug } from './BrandSitePreview';

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

afterEach(cleanup);

function tile(props: Partial<Parameters<typeof BrandSitePreview>[0]> = {}) {
  const { container } = render(
    <BrandSitePreview
      size="tile"
      shop="Fade Room"
      mainHex="#1F6F6B"
      accentHex="#C9A24A"
      tone="DARK"
      testId="preview"
      {...props}
    />,
  );
  return container.querySelector<HTMLElement>('[data-testid="preview"]')!;
}

describe('BrandSitePreview', () => {
  it('tile: decorative browser frame with a slug, header, hero, services and slots', () => {
    const root = tile();
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.className).toBe('admin-hub-livep admin-hub-livep--tile');
    expect(root.querySelectorAll('.admin-hub-livep__dots i')).toHaveLength(3);
    expect(root.querySelector('.admin-hub-livep__url')?.textContent).toBe('fade-room');
    expect(root.textContent).not.toMatch(/\.co\.uk|https?:|www\./);
    // No logo: the shop name in the header.
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('.admin-hub-livep__brand')?.textContent).toBe('Fade Room');
    expect(root.querySelector('.admin-hub-livep__h')?.textContent).toBe('Fade Room');
    const book = root.querySelector<HTMLElement>('.admin-hub-livep__book')!;
    expect(book.textContent).toBe(ADMIN_HUB_COLOURS_BOOK);
    expect(book.style.background).toBe(rgb('#C9A24A'));
    expect(book.style.color).toBe(rgb(betterButtonText('#C9A24A')));
    // Placeholder services, styled as placeholders; three slots, the first in Main.
    const rows = Array.from(root.querySelectorAll('.admin-hub-livep__svc'));
    expect(rows.map((row) => row.textContent?.replace('·', ''))).toEqual(['Haircut', 'Beard trim']);
    expect(rows.every((row) => row.classList.contains('admin-hub-livep__svc--placeholder'))).toBe(true);
    const slots = root.querySelectorAll<HTMLElement>('.admin-hub-livep__slots span');
    expect(slots).toHaveLength(3);
    expect(slots[0]!.style.background).toBe(rgb('#1F6F6B'));
    expect(root.querySelector<HTMLElement>('.admin-hub-livep__site')!.style.background).toBe(
      rgb(siteBackgroundHex('DARK', '#1F6F6B')),
    );
    // Nothing focusable inside the tile link.
    expect(root.querySelectorAll('a, button, [tabindex]')).toHaveLength(0);
  });

  it('tile with a logo: HubLogoMark (max 20 px) instead of the name; real services when given', () => {
    const root = tile({
      logo: { src: '/api/admin-hub/assets/logo_1?size=thumb', width: 400, height: 200 },
      services: [{ name: 'Skin fade' }, { name: 'Hot towel shave' }, { name: 'Kids cut' }],
    });
    const img = root.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/api/admin-hub/assets/logo_1?size=thumb');
    expect(img.className).toContain('hub-logo-mark');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.style.getPropertyValue('--hub-logo-max-h')).toBe('20px');
    expect(root.querySelector('.admin-hub-livep__brand')).toBeNull();
    const rows = Array.from(root.querySelectorAll('.admin-hub-livep__svc'));
    expect(rows.map((row) => row.textContent?.replace('·', ''))).toEqual(['Skin fade', 'Hot towel shave']);
    expect(root.querySelector('.admin-hub-livep__svc--placeholder')).toBeNull();
  });

  it('no Main: neutral greys only, never a made-up colour', () => {
    const root = tile({ mainHex: null });
    const hero = root.querySelector<HTMLElement>('.admin-hub-livep__hero')!;
    expect(hero.getAttribute('style')).toContain(rgb(neutralHeroHex('DARK')));
    expect(hero.getAttribute('style')).not.toContain(rgb('#1F6F6B'));
    expect(root.querySelector<HTMLElement>('.admin-hub-livep__site')!.style.background).toBe(
      rgb(siteBackgroundHex('DARK', null)),
    );
    // First slot: outline only.
    expect(root.querySelector<HTMLElement>('.admin-hub-livep__slot')!.style.background).toBe('');
  });

  it('no Accent: the Book button falls back exactly like the app (site background on the Main hero)', () => {
    const root = tile({ accentHex: null, tone: 'LIGHT' });
    const book = root.querySelector<HTMLElement>('.admin-hub-livep__book')!;
    const expected = sitePreviewColours({ mainHex: '#1F6F6B', accentHex: null, tone: 'LIGHT' }).button;
    expect(book.style.background).toBe(rgb(expected.background));
    expect(book.style.color).toBe(rgb(expected.color));
    expect(root.querySelector<HTMLElement>('.admin-hub-livep__hero')!.getAttribute('style')).not.toContain('radial-gradient');
  });

  it('tile and full share the same hero and button paint for the same colours', () => {
    const html = (size: 'tile' | 'full' | 'compact') =>
      renderToString(<BrandSitePreview size={size} shop="Fade Room" mainHex="#8A2D2D" accentHex="#C9A24A" tone="LIGHT" />);
    const heroStyle = (markup: string) => /class="admin-hub-livep__hero" style="([^"]+)"/.exec(markup)?.[1];
    const bookStyle = (markup: string) => /class="admin-hub-livep__book" style="([^"]+)"/.exec(markup)?.[1];
    expect(heroStyle(html('tile'))).toBe(heroStyle(html('full')));
    expect(heroStyle(html('tile'))).toBe(heroStyle(html('compact')));
    expect(bookStyle(html('tile'))).toBe(bookStyle(html('full')));
    // Full keeps "Our prices" and the plain frame; compact has no body.
    expect(html('full')).toContain('Our prices');
    expect(html('tile')).not.toContain('Our prices');
    expect(html('compact')).not.toContain('admin-hub-livep__body');
    expect(html('compact')).toContain('admin-hub-livep--compact');
  });

  it('slug: lower-case, ASCII, no domain', () => {
    expect(brandSiteSlug('Fade Room')).toBe('fade-room');
    expect(brandSiteSlug("  Joe's Barbers & Co. ")).toBe('joe-s-barbers-and-co');
    expect(brandSiteSlug('Café Señor')).toBe('cafe-senor');
    expect(brandSiteSlug('   ')).toBe('your-shop');
    expect(brandSiteSlug('A'.repeat(80)).length).toBeLessThanOrEqual(32);
  });
});
