/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HUB_ATTACH,
  HUB_CURRENT_LOGO,
  HUB_EMPTY_PHOTOS,
  HUB_UPLOAD_CHOOSE,
  HUB_UPLOAD_DROP,
} from '@/lib/freePreview/hubCopy';
import { HubUploader } from './HubUploader';
import { HubYourShop } from './HubYourShop';

afterEach(() => cleanup());

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
    expect(screen.getByText('On dark')).toBeTruthy();
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
    expect(screen.getByText(HUB_CURRENT_LOGO)).toBeTruthy();
    const current = document.querySelector('[data-testid="hub-logo-tile"][data-current="true"] img');
    expect(current?.getAttribute('src')).toBe('/api/admin-hub/assets/logo_b?size=thumb');
    expect(screen.getByText('a.png')).toBeTruthy();
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
