import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  HERITAGE_BARBERS,
  HERITAGE_FEATURED_PRODUCT_SITE_IDS,
  HERITAGE_HOME_SERVICE_SITE_IDS,
  HERITAGE_HOURS,
  HERITAGE_PRODUCTS,
  HERITAGE_SERVICE_CATEGORIES,
  HERITAGE_SERVICES,
} from './data';

const SITE_JS = resolve(process.cwd(), 'public/demo/heritage-grooming/js');

type SiteModule = Record<string, unknown>;

async function loadSite(file: string): Promise<SiteModule> {
  return (await import(/* @vite-ignore */ pathToFileURL(resolve(SITE_JS, file)).href)) as SiteModule;
}

describe('Heritage Grooming data mirrors the static site', () => {
  it('keeps the barbers in step with data.js', async () => {
    const site = await loadSite('data.js');
    const barbers = site.BARBERS as Array<{ id: string; name: string; first: string; role: string; since: number; days: number[]; tags: string[]; photo: string }>;
    expect(HERITAGE_BARBERS.map((row) => row.siteId)).toEqual(barbers.map((row) => row.id));
    for (const barber of barbers) {
      const mirror = HERITAGE_BARBERS.find((row) => row.siteId === barber.id)!;
      expect(mirror).toMatchObject({
        name: barber.name,
        first: barber.first,
        role: barber.role,
        since: barber.since,
        days: barber.days,
        tags: barber.tags,
        avatarSrc: `/demo/heritage-grooming/${barber.photo}-500.webp`,
      });
      expect(existsSync(resolve(process.cwd(), 'public', mirror.avatarSrc.slice(1)))).toBe(true);
    }
  });

  it('keeps the full price list and categories in step with data.js', async () => {
    const site = await loadSite('data.js');
    const menu = site.MENU as Array<{ id: string; cat: string; name: string; mins: number; price: number; desc: string }>;
    const categories = site.CATEGORIES as Array<{ id: string; name: string }>;
    const home = site.SERVICES as Array<{ id: string }>;

    expect(HERITAGE_SERVICE_CATEGORIES).toEqual(categories.map((row) => ({ siteId: row.id, name: row.name })));
    expect(HERITAGE_SERVICES.map((row) => row.siteId)).toEqual(menu.map((row) => row.id));
    for (const item of menu) {
      expect(HERITAGE_SERVICES.find((row) => row.siteId === item.id)).toMatchObject({
        cat: item.cat,
        name: item.name,
        mins: item.mins,
        price: item.price,
        pricePence: item.price * 100,
        desc: item.desc,
      });
    }
    expect([...HERITAGE_HOME_SERVICE_SITE_IDS]).toEqual(home.map((row) => row.id));
  });

  it('keeps the retail shelf in step with shop-data.js', async () => {
    const site = await loadSite('shop-data.js');
    const counter = site.COUNTER as Array<{ id: string; cat: string; brand: string; name: string; size: string; price: number; line: string; desc?: string; photo?: boolean }>;
    expect(counter.every((row) => row.photo !== false)).toBe(true);
    expect(HERITAGE_PRODUCTS.map((row) => row.siteId)).toEqual(counter.map((row) => row.id));
    for (const item of counter) {
      const mirror = HERITAGE_PRODUCTS.find((row) => row.siteId === item.id)!;
      expect(mirror).toMatchObject({
        cat: item.cat,
        brand: item.brand,
        productName: item.name,
        name: `${item.brand} ${item.name}`,
        size: item.size,
        price: item.price,
        line: item.line,
      });
      if (item.desc) expect(mirror.description).toBe(item.desc);
      expect(existsSync(resolve(process.cwd(), 'public', mirror.imageSrc.slice(1)))).toBe(true);
    }
    expect([...HERITAGE_FEATURED_PRODUCT_SITE_IDS]).toEqual(site.FEATURED);
  });

  it('keeps the opening hours in step with house.js', async () => {
    const site = await loadSite('house.js');
    expect(HERITAGE_HOURS).toEqual(site.HOURS);
  });
});
