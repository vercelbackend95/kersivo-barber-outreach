/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HUB_ATTACH,
  HUB_CURRENT_LOGO,
  HUB_EMPTY_LOGO,
  HUB_EMPTY_OTHER,
  HUB_EMPTY_PHOTOS,
  HUB_EMPTY_PRICE,
  HUB_REPLACE_LOGO,
  HUB_UPLOAD_CHOOSE,
  HUB_UPLOAD_DROP,
  HUB_UPLOAD_HINT_PHOTOS,
} from '@/lib/freePreview/hubCopy';
import { HubUploader } from './HubUploader';
import { HubYourShop } from './HubYourShop';

afterEach(() => cleanup());

function asset(
  id: string,
  kind: 'LOGO' | 'SHOP_PHOTO' | 'PRICE_LIST' | 'OTHER',
  originalFileName: string,
  createdAt = '2026-11-01T12:00:00.000Z',
) {
  return {
    id,
    kind,
    originalFileName,
    contentType: originalFileName.endsWith('.png') ? 'image/png' : 'image/jpeg',
    sizeBytes: 8,
    width: 300,
    height: 100,
    caption: null,
    sortOrder: 0,
    barberId: null,
    uploadedBy: 'OWNER' as const,
    createdAt,
    hasThumb: true,
  };
}

describe('HubUploader', () => {
  it('renders the empty drop zone and choose-files control', () => {
    render(<HubUploader token={'A'.repeat(43)} kind="SHOP_PHOTO" onUploaded={() => undefined} />);
    expect(screen.getByText(HUB_UPLOAD_DROP)).toBeTruthy();
    expect(screen.getByText(HUB_UPLOAD_CHOOSE)).toBeTruthy();
    expect(document.querySelector('input[type="file"]')?.getAttribute('accept')).toContain('image/jpeg');
  });

  it('renders a compact attach control for message attachments', () => {
    render(
      <HubUploader
        token={'A'.repeat(43)}
        kind="MESSAGE_ATTACHMENT"
        compact
        remaining={5}
        onUploaded={() => undefined}
      />,
    );
    expect(screen.getByText(HUB_ATTACH)).toBeTruthy();
    expect(screen.queryByText(HUB_UPLOAD_DROP)).toBeNull();
  });
});

describe('HubYourShop', () => {
  it('shows empty states and placeholder review cards', () => {
    render(
      <HubYourShop
        token={'A'.repeat(43)}
        canUpload
        canEditDetails
        details={{ brandPrimaryColour: null, brandSecondaryColour: null, styleNotes: null, aboutText: null }}
        assets={[]}
      />,
    );
    expect(screen.getByText(HUB_EMPTY_PHOTOS)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Services & prices' })).toBeTruthy();
    expect(screen.getAllByText(/we'll fill these from your links/i)).toHaveLength(3);
  });

  it('can show only the logo tiles without the colour fields', () => {
    render(
      <HubYourShop
        token={'A'.repeat(43)}
        canUpload
        canEditDetails
        focus="logo"
        details={{ brandPrimaryColour: null, brandSecondaryColour: null, styleNotes: null, aboutText: null }}
        assets={[]}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Logo' })).toBeTruthy();
    expect(screen.queryByText('On dark')).toBeNull();
    expect(screen.queryByText('On light')).toBeNull();
    expect(screen.getByText(HUB_EMPTY_LOGO)).toBeTruthy();
    expect(screen.getByText('Not added yet')).toBeTruthy();
    expect(screen.queryByText('Primary colour')).toBeNull();
    expect(screen.queryByText(HUB_EMPTY_PHOTOS)).toBeNull();
  });

  it('scrolls the materials app to the requested block', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    render(
      <HubYourShop
        token={'A'.repeat(43)}
        canUpload
        canEditDetails
        focus="materials"
        highlight="photos"
        details={{ brandPrimaryColour: null, brandSecondaryColour: null, styleNotes: null, aboutText: null }}
        assets={[]}
      />,
    );
    expect(document.getElementById('photos')).toBeTruthy();
    expect(document.getElementById('logo')).toBeTruthy();
    expect(document.getElementById('text')).toBeTruthy();
    expect(document.getElementById('team-photos')).toBeNull();
    expect(document.getElementById('price-list')).toBeTruthy();
    expect(document.getElementById('other')).toBeTruthy();
    expect(document.getElementById('photos')?.className).toContain('is-hub-add-target');
    expect(scrollIntoView).toHaveBeenCalled();
    expect(screen.getByTestId('hub-jump').textContent).toMatch(/Photos/);
    expect(screen.getByRole('heading', { name: 'Text for your website' })).toBeTruthy();
    expect(screen.getByLabelText('About your shop')).toBeTruthy();
    expect(screen.getByLabelText('Instagram')).toBeTruthy();
    expect(screen.getByLabelText('Anything else for your website')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Other files' })).toBeTruthy();
  });

  it('shows chip counts and a check when a section has content', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    render(
      <HubYourShop
        token={'A'.repeat(43)}
        canUpload
        canEditDetails
        focus="materials"
        details={{
          brandPrimaryColour: null,
          brandSecondaryColour: null,
          styleNotes: null,
          aboutText: 'Family shop',
          instagramUrl: 'https://www.instagram.com/sharp/',
          websiteExtraText: null,
        }}
        assets={[
          {
            id: 'a1',
            kind: 'SHOP_PHOTO',
            originalFileName: 'shop.jpg',
            contentType: 'image/jpeg',
            sizeBytes: 12,
            width: 10,
            height: 10,
            caption: null,
            sortOrder: 0,
            barberId: null,
            uploadedBy: 'OWNER',
            createdAt: '2026-11-01T12:00:00.000Z',
            hasThumb: true,
          },
          {
            id: 'a2',
            kind: 'LOGO',
            originalFileName: 'logo.png',
            contentType: 'image/png',
            sizeBytes: 8,
            width: 10,
            height: 10,
            caption: null,
            sortOrder: 0,
            barberId: null,
            uploadedBy: 'OWNER',
            createdAt: '2026-11-01T12:00:00.000Z',
            hasThumb: true,
          },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Photos 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Logo ✓' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Text ✓' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Team photos/ })).toBeNull();
  });

  it('shows only unassigned legacy team photos under Shop photos, without an uploader (O8)', () => {
    const teamPhoto = (id: string, barberId: string | null, caption: string | null) => ({
      id,
      kind: 'TEAM_PHOTO' as const,
      originalFileName: `${id}.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: 12,
      width: 10,
      height: 10,
      caption,
      sortOrder: 0,
      barberId,
      uploadedBy: 'OWNER' as const,
      createdAt: '2026-10-01T12:00:00.000Z',
      hasThumb: true,
    });
    const details = { brandPrimaryColour: null, brandSecondaryColour: null, styleNotes: null, aboutText: null };
    for (const focus of ['materials', undefined] as const) {
      render(
        <HubYourShop
          token={'A'.repeat(43)}
          apiBase="/api/admin-hub"
          canUpload
          canEditDetails
          focus={focus}
          details={details}
          assets={[teamPhoto('legacy', null, 'Whole team'), teamPhoto('barber', 'barber_1', null)]}
        />,
      );
      expect(document.getElementById('team-photos')).toBeNull();
      const earlier = screen.getByTestId('hub-earlier-team-photos');
      expect(document.getElementById('photos')?.contains(earlier)).toBe(true);
      expect(screen.getByRole('heading', { name: 'Earlier team photos' })).toBeTruthy();
      expect(earlier.querySelectorAll('img')).toHaveLength(1);
      expect(earlier.querySelector('img')?.getAttribute('src')).toBe('/api/admin-hub/assets/legacy?size=thumb');
      expect(document.querySelector('img[src*="/assets/barber"]')).toBeNull();
      expect(earlier.querySelector('input[type="file"]')).toBeNull();
      expect((earlier.querySelector('input.input') as HTMLInputElement).value).toBe('Whole team');
      expect(earlier.querySelectorAll('button')).toHaveLength(1);
      expect(earlier.querySelector('button')?.textContent).toBe('Delete');
      cleanup();
    }

    render(
      <HubYourShop
        token={'A'.repeat(43)}
        canUpload
        canEditDetails
        focus="materials"
        details={details}
        assets={[teamPhoto('barber', 'barber_1', null)]}
      />,
    );
    expect(screen.queryByTestId('hub-earlier-team-photos')).toBeNull();
    expect(screen.queryByText('Earlier team photos')).toBeNull();
  });

  it('marks the newest logo as current', () => {
    render(
      <HubYourShop
        token={'A'.repeat(43)}
        apiBase="/api/admin-hub"
        canUpload
        canEditDetails
        focus="logo"
        details={{ brandPrimaryColour: null, brandSecondaryColour: null, styleNotes: null, aboutText: null }}
        assets={[
          {
            id: 'logo_a',
            kind: 'LOGO',
            originalFileName: 'a.png',
            contentType: 'image/png',
            sizeBytes: 8,
            width: 10,
            height: 10,
            caption: null,
            sortOrder: 0,
            barberId: null,
            uploadedBy: 'OWNER',
            createdAt: '2026-11-01T10:00:00.000Z',
            hasThumb: true,
          },
          {
            id: 'logo_b',
            kind: 'LOGO',
            originalFileName: 'b.png',
            contentType: 'image/png',
            sizeBytes: 8,
            width: 10,
            height: 10,
            caption: null,
            sortOrder: 1,
            barberId: null,
            uploadedBy: 'OWNER',
            createdAt: '2026-11-01T12:00:00.000Z',
            hasThumb: true,
          },
        ]}
      />,
    );
    const logoCard = document.getElementById('logo')!;
    expect(screen.getByText(HUB_CURRENT_LOGO)).toBeTruthy();
    const current = screen.getByTestId('hub-logo-current');
    expect(current.querySelector('img')?.getAttribute('src')).toBe('/api/admin-hub/assets/logo_b?size=thumb');
    expect(current.textContent).toContain('b.png');
    // The current logo is shown once; earlier ones sit in a collapsed list without it.
    expect(logoCard.querySelectorAll('img[src*="logo_b"]')).toHaveLength(1);
    expect(logoCard.querySelector('.hub-swatch')).toBeNull();
    const earlier = logoCard.querySelector('details.hub-earlier') as HTMLDetailsElement;
    expect(earlier.open).toBe(false);
    expect(earlier.querySelector('summary')?.textContent).toBe('Earlier logos (1)');
    expect(earlier.querySelectorAll('img')).toHaveLength(1);
    expect(earlier.querySelector('img')?.getAttribute('src')).toBe('/api/admin-hub/assets/logo_a?size=thumb');
    expect(earlier.textContent).toContain('a.png');
    expect(earlier.textContent).not.toContain('b.png');
    expect(screen.getByRole('link', { name: /Brand colours/ }).getAttribute('href')).toBe('/admin?app=colours');
    expect(screen.getByText(HUB_REPLACE_LOGO)).toBeTruthy();
  });

  it('hides the earlier logos list when there is only one logo', () => {
    render(
      <HubYourShop
        token={'A'.repeat(43)}
        apiBase="/api/admin-hub"
        canUpload
        canEditDetails
        focus="materials"
        details={{ brandPrimaryColour: null, brandSecondaryColour: null, styleNotes: null, aboutText: null }}
        assets={[asset('logo_only', 'LOGO', 'only.png')]}
      />,
    );
    expect(document.querySelector('#logo details')).toBeNull();
    expect(document.querySelectorAll('#logo img')).toHaveLength(1);
  });

  it('gives every materials card the same header: title, status pill and one hint', () => {
    render(
      <HubYourShop
        token={'A'.repeat(43)}
        apiBase="/api/admin-hub"
        canUpload
        canEditDetails
        focus="materials"
        details={{ brandPrimaryColour: null, brandSecondaryColour: null, styleNotes: null, aboutText: 'Family shop' }}
        assets={[
          asset('p1', 'SHOP_PHOTO', 'one.jpg'),
          asset('p2', 'SHOP_PHOTO', 'two.jpg'),
          asset('p3', 'SHOP_PHOTO', 'three.jpg'),
          asset('l1', 'LOGO', 'logo.png'),
        ]}
      />,
    );
    const ids = Array.from(document.querySelectorAll('section.hub-card[id]')).map((el) => el.id);
    expect(ids).toEqual(['photos', 'logo', 'text', 'price-list', 'other']);
    const status = (id: string) => document.querySelector(`#${id} .hub-card__head .hub-status`)?.textContent;
    expect(status('photos')).toBe('3 added');
    expect(status('logo')).toBe('Added');
    expect(status('text')).toBe('Added');
    expect(status('price-list')).toBe('Not added yet');
    expect(status('other')).toBe('Not added yet');
    for (const id of ids) {
      const card = document.getElementById(id)!;
      expect(card.querySelectorAll(':scope > .hub-card__head h2')).toHaveLength(1);
      expect(card.querySelectorAll(':scope > .hub-card__hint')).toHaveLength(1);
    }
    expect(document.querySelector('#photos .hub-card__hint')?.textContent).toBe(HUB_UPLOAD_HINT_PHOTOS);
    expect(document.querySelector('#price-list .hub-empty')?.textContent).toBe(HUB_EMPTY_PRICE);
    expect(document.querySelector('#other .hub-empty')?.textContent).toBe(HUB_EMPTY_OTHER);
    expect(document.querySelector('.hub-materials__main #photos')).toBeTruthy();
    expect(Array.from(document.querySelectorAll('.hub-materials__side > section')).map((el) => el.id)).toEqual([
      'logo',
      'text',
      'price-list',
      'other',
    ]);
  });

  it('moves focus to the section heading and marks the chip current', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
    });
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(
      <HubYourShop
        token={'A'.repeat(43)}
        canUpload
        canEditDetails
        focus="materials"
        details={{ brandPrimaryColour: null, brandSecondaryColour: null, styleNotes: null, aboutText: null }}
        assets={[]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Photos' }).getAttribute('aria-current')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Price list' }));
    expect(document.activeElement?.id).toBe('hub-price-title');
    expect(screen.getByRole('button', { name: 'Price list' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: 'Photos' }).getAttribute('aria-current')).toBeNull();
  });

  it('keeps the full Your shop page: every card, brand extras under one logo, no jump chips', () => {
    render(
      <HubYourShop
        token={'A'.repeat(43)}
        canUpload
        canEditDetails
        details={{ brandPrimaryColour: '#D72638', brandSecondaryColour: null, styleNotes: null, aboutText: null }}
        assets={[asset('l1', 'LOGO', 'logo.png'), asset('l2', 'LOGO', 'older.png', '2026-10-01T12:00:00.000Z')]}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Your shop' })).toBeTruthy();
    for (const name of ['Shop photos', 'Logo', 'Text for your website', 'Price list', 'Services & prices', 'Team', 'Opening hours']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy();
    }
    expect(screen.queryByTestId('hub-jump')).toBeNull();
    expect(document.querySelector('.hub-materials')).toBeNull();
    expect(screen.queryByRole('link', { name: /Brand colours/ })).toBeNull();
    const logoCard = document.getElementById('logo')!;
    expect(logoCard.querySelectorAll('img[src*="l1"]')).toHaveLength(1);
    expect(logoCard.querySelector('#hub-primary')).toBeTruthy();
    expect(logoCard.querySelector('#hub-style')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pick from my logo' })).toBeTruthy();
  });

  it('hides uploaders when the owner cannot upload', () => {
    render(
      <HubYourShop
        token={'A'.repeat(43)}
        canUpload={false}
        canEditDetails={false}
        details={{ brandPrimaryColour: '#D72638', brandSecondaryColour: null, styleNotes: null, aboutText: null }}
        assets={[]}
      />,
    );
    expect(screen.queryByText(HUB_UPLOAD_CHOOSE)).toBeNull();
  });
});
