import { describe, expect, it } from 'vitest';
import { buildHubChecklist, checklistFlagsFromAssets } from './hubChecklist';
import { HUB_CHECKLIST_ON_PREVIEW } from './hubCopy';

describe('buildHubChecklist', () => {
  it('counts logo and photos as to-do until files exist', () => {
    const { items, done, total } = buildHubChecklist({
      stage: 'requested',
      hasLogo: false,
      hasPhotos: false,
      hasPriceList: false,
      hasAbout: false,
    });
    expect(total).toBe(7);
    expect(done).toBe(0);
    expect(items.find((item) => item.id === 'logo')?.status).toBe('todo');
    expect(items.find((item) => item.id === 'services')?.hint).toBe(HUB_CHECKLIST_ON_PREVIEW);
  });

  it('marks completed owner items and shows On your preview for catalogue cards', () => {
    const { items, done } = buildHubChecklist({
      stage: 'review',
      hasLogo: true,
      hasPhotos: true,
      hasPriceList: true,
      hasAbout: true,
    });
    expect(done).toBe(4);
    expect(items.find((item) => item.id === 'hours')?.hint).toBe(HUB_CHECKLIST_ON_PREVIEW);
  });

  it('reads flags from assets and about text', () => {
    expect(
      checklistFlagsFromAssets([{ kind: 'LOGO' }, { kind: 'SHOP_PHOTO' }], '  Family shop '),
    ).toEqual({ hasLogo: true, hasPhotos: true, hasPriceList: false, hasAbout: true });
  });
});
