import { describe, expect, it } from 'vitest';
import {
  ENTRY_BANNED_CLAIMS,
  ENTRY_CHANNELS,
  ENTRY_QR_CARD_SRC,
  buildEntryPointsExample,
} from './entryPointsExample';

describe('Section 05 entry-points example', () => {
  const example = buildEntryPointsExample();

  it('exposes four channels with the correct visual kinds', () => {
    expect(example.channels.map((channel) => channel.id)).toEqual(['website', 'google', 'social', 'qr']);
    expect(example.channels.find((channel) => channel.id === 'website')?.visual.kind).toBe('website');
    expect(example.channels.find((channel) => channel.id === 'google')?.visual).toMatchObject({
      kind: 'google',
      markSrc: '/images/starter/google-g-192.webp',
    });
    expect(example.channels.find((channel) => channel.id === 'social')?.visual).toMatchObject({
      kind: 'instagram',
      avatarSrc: '/demo/cutstate-logo.png',
      handle: '@cutstatebarbers',
      bookLabel: 'Book',
    });
    const social = example.channels.find((channel) => channel.id === 'social')?.visual;
    expect(social?.kind === 'instagram' && social.gridSrcs).toHaveLength(3);
    expect(example.channels.find((channel) => channel.id === 'qr')?.visual).toMatchObject({
      kind: 'qr',
      src: ENTRY_QR_CARD_SRC,
    });
  });

  it('keeps QR art claim-safe and drops the lower close/destination model', () => {
    expect(example.qrCardSrc).toBe(ENTRY_QR_CARD_SRC);
    expect(example.qrCardAlt.toLowerCase()).toContain('not a live');
    expect(example).not.toHaveProperty('destination');
    expect(example).not.toHaveProperty('disclosure');
    expect(example).not.toHaveProperty('unity');
  });

  it('never elevates banned Google, social, QR or acquisition claims', () => {
    const corpus = ENTRY_CHANNELS.map((channel) => `${channel.label} ${channel.shortLabel}`)
      .concat([example.qrCardAlt])
      .join(' ')
      .toLowerCase();

    for (const banned of ENTRY_BANNED_CLAIMS) {
      expect(corpus).not.toContain(banned);
    }
    expect(corpus).not.toMatch(/automatically (sends|generates|ranks)/);
  });
});
