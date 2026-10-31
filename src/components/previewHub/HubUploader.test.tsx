/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HUB_ATTACH, HUB_EMPTY_PHOTOS, HUB_UPLOAD_CHOOSE, HUB_UPLOAD_DROP } from '@/lib/freePreview/hubCopy';
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
