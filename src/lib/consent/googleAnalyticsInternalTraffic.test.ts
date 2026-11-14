/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://kersivo.co.uk/"}
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/** Runs the real inline bootstrap from GoogleAnalytics.astro (define:vars passed as arguments). */
const here = dirname(fileURLToPath(import.meta.url));
const astro = readFileSync(join(here, '../../components/seo/GoogleAnalytics.astro'), 'utf8');
const scriptStart = astro.indexOf('(function () {', astro.indexOf('define:vars'));
const scriptEnd = astro.indexOf('</script>', scriptStart);
const bootstrap = astro.slice(scriptStart, scriptEnd);

type DataLayer = unknown[][];

const registered: Array<[string, EventListenerOrEventListenerObject]> = [];

function runBootstrap(): DataLayer {
  const add = document.addEventListener.bind(document);
  document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject) => {
    registered.push([type, listener]);
    add(type, listener);
  }) as typeof document.addEventListener;
  const layer: unknown[] = [];
  (window as unknown as { dataLayer: unknown[] }).dataLayer = layer;
  (globalThis as unknown as { dataLayer: unknown[] }).dataLayer = layer;
  delete (window as { gtag?: unknown }).gtag;
  new Function('gaMeasurementId', 'googleAdsId', 'gaSiteSection', 'consentCookieName', 'consentVersion', bootstrap)(
    'G-TEST',
    '',
    '',
    'kersivo_consent',
    3,
  );
  document.addEventListener = add;
  return layer as unknown as DataLayer;
}

function hits(layer: DataLayer): unknown[][] {
  return layer.map((entry) => Array.from(entry as ArrayLike<unknown>));
}

function internalSets(layer: DataLayer): number {
  return hits(layer).filter(
    (args) => args[0] === 'set' && (args[1] as { traffic_type?: string })?.traffic_type === 'internal',
  ).length;
}

function clearCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

describe('GoogleAnalytics.astro internal traffic', () => {
  beforeEach(() => {
    clearCookies();
    history.replaceState(null, '', '/');
  });

  afterEach(() => {
    clearCookies();
    for (const [type, listener] of registered.splice(0)) document.removeEventListener(type, listener);
  });

  it('sends nothing extra for a normal visitor on the production host', () => {
    const layer = runBootstrap();
    expect(internalSets(layer)).toBe(0);
  });

  it('?internal=1 marks the device, strips the parameter and tags every later hit', () => {
    history.replaceState(null, '', '/pricing?plan=full&internal=1');
    const layer = runBootstrap();
    expect(document.cookie).toContain('kersivo_internal=1');
    expect(window.location.pathname + window.location.search).toBe('/pricing?plan=full');
    expect(internalSets(layer)).toBe(1);
  });

  it('a marked device is tagged on every full page load', () => {
    document.cookie = 'kersivo_internal=1; Path=/';
    const layer = runBootstrap();
    expect(internalSets(layer)).toBe(1);
  });

  it('re-applies the tag after each ClientRouter navigation', () => {
    document.cookie = 'kersivo_internal=1; Path=/';
    const layer = runBootstrap();
    document.dispatchEvent(new Event('astro:page-load'));
    document.dispatchEvent(new Event('astro:page-load'));
    expect(internalSets(layer)).toBe(3);
  });

  it('a ClientRouter link to /?internal=1 marks the device before the new page view', () => {
    const layer = runBootstrap();
    expect(internalSets(layer)).toBe(0);
    const event = Object.assign(new Event('astro:before-preparation'), {
      to: new URL('https://kersivo.co.uk/?internal=1'),
    });
    document.dispatchEvent(event);
    expect(document.cookie).toContain('kersivo_internal=1');
    expect(internalSets(layer)).toBe(1);
  });

  it('?internal=0 unmarks the device for later page loads', () => {
    document.cookie = 'kersivo_internal=1; Path=/';
    history.replaceState(null, '', '/?internal=0');
    const layer = runBootstrap();
    expect(document.cookie).not.toContain('kersivo_internal=1');
    expect(internalSets(layer)).toBe(0);
  });
});
