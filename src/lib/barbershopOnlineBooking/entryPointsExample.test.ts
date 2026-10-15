import { describe, expect, it } from 'vitest';
import { DEMO_SHOP_NAME } from '@/lib/demo/site';
import {
  ENTRY_BANNED_CLAIMS,
  ENTRY_CHANNELS,
  ENTRY_FULL_DESTINATION,
  ENTRY_QR_ILLUSTRATIVE_SRC,
  ENTRY_QR_PLACEMENTS,
  ENTRY_STARTER_DESTINATION,
  buildEntryPointsExample,
} from './entryPointsExample';

describe('Section 05 entry-points example', () => {
  const example = buildEntryPointsExample();

  it('exposes four channels converging on one Cutstate destination preview', () => {
    expect(example.channels.map((channel) => channel.id)).toEqual(['website', 'google', 'social', 'qr']);
    expect(example.destination.shopName).toBe(DEMO_SHOP_NAME);
    expect(example.destination.serviceName.length).toBeGreaterThan(0);
    expect(example.destination.barberName.length).toBeGreaterThan(0);
    expect(example.destination.hint.toLowerCase()).toContain('booking journey');
  });

  it('keeps Starter hosted and Full verified own-domain destinations distinct', () => {
    expect(example.starterDestination).toBe(ENTRY_STARTER_DESTINATION);
    expect(example.fullDestination).toBe(ENTRY_FULL_DESTINATION);
    expect(example.starterDestination.toLowerCase()).toContain('kersivo-hosted');
    expect(example.fullDestination.toLowerCase()).toContain('own-domain');
    expect(example.fullDestination.toLowerCase()).toContain('verified');
  });

  it('describes WINDOW and REBOOK QR placements without inventing fulfilment', () => {
    expect(ENTRY_QR_PLACEMENTS.map((placement) => placement.id)).toEqual(['window', 'rebook']);
    expect(example.qrPlacements[0]?.line).toBe('BOOK ONLINE');
    expect(example.qrPlacements[1]?.line).toBe('REBOOK BEFORE YOU LEAVE');
    expect(example.qrIllustrativeSrc).toBe(ENTRY_QR_ILLUSTRATIVE_SRC);
    expect(example.qrIllustrativeAlt.toLowerCase()).toContain('not a live');
    expect(example.disclosure.toLowerCase()).toContain('not a live shop code');
  });

  it('never elevates banned Google, social, QR or acquisition claims', () => {
    const corpus = [
      ...ENTRY_CHANNELS.map((channel) => `${channel.label} ${channel.body}`),
      example.starterDestination,
      example.fullDestination,
      example.bridge,
      example.disclosure,
      ...example.qrPlacements.map((placement) => `${placement.title} ${placement.line} ${placement.purpose}`),
    ]
      .join(' ')
      .toLowerCase();

    for (const banned of ENTRY_BANNED_CLAIMS) {
      expect(corpus).not.toContain(banned);
    }
    expect(corpus).not.toMatch(/automatically (sends|generates|ranks)/);
  });

  it('states Google is merchant-guided and social has no native Instagram booking product', () => {
    const google = example.channels.find((channel) => channel.id === 'google');
    const social = example.channels.find((channel) => channel.id === 'social');
    expect(google?.body.toLowerCase()).toContain('guided setup');
    expect(google?.body.toLowerCase()).toContain('google decides');
    expect(social?.body.toLowerCase()).toContain('does not offer a native instagram booking product');
  });
});
